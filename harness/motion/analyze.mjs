import { buildAnalysisReport } from './squat.mjs'
import { openVideo, seekVideoFrame } from './video.mjs'

const SAMPLE_RATE_HZ = 15
const baseUrl = import.meta.env?.BASE_URL ?? '/'

function workerRequest(worker, data, { signal, transfer = [], timeoutMs = 30_000 }) {
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('The pose engine took too long to respond.')), timeoutMs)
    function finish(error, result) {
      clearTimeout(timeout)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.removeEventListener('messageerror', onError)
      signal?.removeEventListener('abort', onAbort)
      error ? reject(error) : resolve(result)
    }
    const onMessage = ({ data: result }) => {
      result.error ? finish(new Error(result.error)) : finish(null, result.landmarks)
    }
    const onError = (event) => finish(new Error(event.message || 'The pose worker could not start.'))
    const onAbort = () => finish(signal.reason)
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.addEventListener('messageerror', onError)
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      worker.postMessage(data, transfer)
    } catch (error) {
      finish(error)
    }
  })
}

function poseAssetUrl(value) {
  const url = new URL(value, location.href)
  if (url.origin !== location.origin) throw new Error('Serve the pose model and WebAssembly from this app.')
  return url.href
}

async function collectFrames(video, worker, { signal, onFrame }) {
  const frames = []
  for (let index = 0; index / SAMPLE_RATE_HZ < video.duration; index++) {
    // Seek just inside the intended sample. Read the actual decoded frame time
    // so lower-frame-rate and variable-rate clips retain real evidence anchors.
    const targetSeconds = Math.min(index / SAMPLE_RATE_HZ + 0.001, video.duration * 0.999999)
    const timestampMs = await seekVideoFrame(video, targetSeconds, signal)
    if (timestampMs <= (frames.at(-1)?.timestampMs ?? -1)) continue
    const bitmap = await createImageBitmap(video)
    try {
      const landmarks = await workerRequest(worker, { type: 'frame', timestampMs, bitmap }, {
        signal,
        transfer: [bitmap],
      })
      frames.push({ timestampMs, landmarks })
      onFrame(timestampMs, frames.length)
    } finally {
      bitmap.close()
    }
  }
  return frames
}

/**
 * Decode a local Blob/File or same-origin fixture and return AnalysisReport v1.
 * Each invocation owns its decoder and worker, so callers can abort on clip change.
 */
export async function analyzeSquat(source, {
  clipId,
  signal,
  onProgress = () => {},
  assets = {},
} = {}) {
  if (!globalThis.HTMLVideoElement?.prototype.requestVideoFrameCallback ||
      !globalThis.OffscreenCanvas || !globalThis.createImageBitmap || !globalThis.Worker) {
    throw new Error('This browser cannot analyze video locally. Try a current desktop Chrome.')
  }
  const { video, close } = await openVideo(source, { signal })
  let worker
  try {
    const durationMs = Math.max(1, Math.round(video.duration * 1000))
    const clip = {
      id: clipId || globalThis.crypto.randomUUID(),
      widthPx: video.videoWidth,
      heightPx: video.videoHeight,
      durationMs,
    }
    onProgress({ stage: 'loading-model', progress: 0, frameCount: 0 })
    worker = new Worker(new URL('./pose-worker.mjs', import.meta.url), { type: 'module' })
    await workerRequest(worker, {
      type: 'init',
      wasmRoot: poseAssetUrl(assets.wasmRoot ?? `${baseUrl}pose/wasm`),
      modelUrl: poseAssetUrl(assets.modelUrl ?? `${baseUrl}pose/pose_landmarker_full.task`),
    }, { signal, timeoutMs: 60_000 })

    signal?.throwIfAborted()
    onProgress({ stage: 'analyzing', progress: 0, frameCount: 0 })
    const frames = await collectFrames(video, worker, {
      signal,
      onFrame(timestampMs, frameCount) {
        onProgress({ stage: 'analyzing', progress: Math.min(1, timestampMs / durationMs), frameCount })
      },
    })
    signal?.throwIfAborted()
    const report = buildAnalysisReport(clip, frames)
    onProgress({ stage: 'complete', progress: 1, frameCount: frames.length })
    return report
  } finally {
    worker?.terminate()
    close()
  }
}
