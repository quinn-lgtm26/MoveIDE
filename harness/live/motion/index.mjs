import { DEFAULT_POSE_PRESET, POSE_PRESETS } from '../../motion/pose-model.mjs';
import { createLiveAnalysis } from './live-analysis.mjs';
import { createFrameGate } from './frame-gate.mjs';
export { completedRepFeedback, createDepthFeedback } from './feedback.mjs';

function workerRequest(worker, data, signal, transfer = [], timeoutMs = 30_000) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    let finished = false;
    const end = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.removeEventListener('message', message);
      worker.removeEventListener('error', failed);
      worker.removeEventListener('messageerror', failed);
      signal.removeEventListener('abort', aborted);
      error ? reject(error) : resolve(value);
    };
    const message = ({ data: result }) => result.error ? end(new Error(result.error)) : end(null, result);
    const failed = event => end(new Error(event.message || 'The live pose worker failed.'));
    const aborted = () => end(signal.reason);
    const timer = setTimeout(() => end(new Error('The live pose worker timed out.')), timeoutMs);
    worker.addEventListener('message', message);
    worker.addEventListener('error', failed);
    worker.addEventListener('messageerror', failed);
    signal.addEventListener('abort', aborted, { once: true });
    try { worker.postMessage(data, transfer); } catch (error) { end(error); }
  });
}

function asset(value) {
  const url = new URL(value, location.href);
  if (url.origin !== location.origin) throw new Error('Live pose assets must be served from this app.');
  return url.href;
}

/** Attach after a camera/WebRTC video is loaded. This API never opens or stops caller-owned media tracks. */
export async function startLiveSquat(video, {
  model = DEFAULT_POSE_PRESET, targetKneeFlexionDeg = null, maxHz = 15,
  historyMs = 30_000, maxFrames = 450, captureEvidence = false, declaredView = 'side', viewGuardOptions,
  clipId = crypto.randomUUID(), assets = {}, signal,
  onSample = () => {}, onRepComplete = () => {}, onError = () => {}, onPoseFrame,
} = {}) {
  signal?.throwIfAborted();
  if (!Object.hasOwn(POSE_PRESETS, model)) throw new Error('Choose Heavy or Full.');
  if (!video?.requestVideoFrameCallback || !video.videoWidth || !video.videoHeight || video.readyState < 2) {
    throw new Error('Wait for the camera or received video to load before starting live analysis.');
  }
  if (!Number.isFinite(historyMs) || historyMs < 2000 || historyMs > 60_000 || !Number.isInteger(maxFrames) || maxFrames < 10 || maxFrames > 900) {
    throw new RangeError('Choose a 2–60 second history and 10–900 retained frames.');
  }
  const gate = createFrameGate({ maxHz });
  const preset = POSE_PRESETS[model];
  const controller = new AbortController();
  const accumulator = createLiveAnalysis({ clipId, poseModel: preset.report, targetKneeFlexionDeg, historyMs, maxFrames, declaredView, viewGuardOptions });
  let worker, callback, originMs = null, stopped = false;
  let processedFrames = 0, discardedDimensionResults = 0, latencySum = 0, maxLatencyMs = 0, startedAt = null, stoppedAt = null, lastPresentedMediaMs = null;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    stoppedAt = performance.now();
    gate.stop();
    controller.abort();
    if (callback !== undefined) video.cancelVideoFrameCallback(callback);
    worker?.terminate();
    signal?.removeEventListener('abort', stop);
    accumulator.clearEvidence();
  };
  const getStats = () => ({ ...gate.stats(), processedFrames, discardedDimensionResults,
    elapsedMs: startedAt === null ? 0 : (stoppedAt ?? performance.now()) - startedAt,
    analyzedHz: startedAt === null ? 0 : processedFrames / Math.max(.001, ((stoppedAt ?? performance.now()) - startedAt) / 1000),
    meanProcessingLatencyMs: processedFrames ? latencySum / processedFrames : null,
    maxProcessingLatencyMs: processedFrames ? maxLatencyMs : null,
    ...accumulator.getStats(),
  });
  signal?.addEventListener('abort', stop, { once: true });
  const fail = error => { stop(); onError(error); };
  try {
    worker = new Worker(new URL('../../motion/pose-worker.mjs', import.meta.url), { type: 'module' });
    const base = import.meta.env?.BASE_URL ?? '/';
    await workerRequest(worker, { type: 'init', model,
      wasmRoot: asset(assets.wasmRoot ?? `${base}pose/wasm`),
      modelUrl: asset(assets.modelUrl ?? `${base}pose/${preset.fileName}`),
    }, controller.signal, [], 60_000);
    controller.signal.throwIfAborted();
    startedAt = performance.now();
    const presented = (_now, metadata) => {
      if (stopped) return;
      callback = video.requestVideoFrameCallback(presented);
      // captureStream may present an empty terminal frame with a reset clock.
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return;
      const mediaMs = Math.round(metadata.mediaTime * 1000);
      if (!Number.isFinite(mediaMs) || (lastPresentedMediaMs !== null && mediaMs < lastPresentedMediaMs)) return fail(new Error('Video media clock reset. Restart live analysis.'));
      lastPresentedMediaMs = mediaMs;
      originMs ??= mediaMs;
      const timestampMs = mediaMs - originMs;
      const widthPx = video.videoWidth, heightPx = video.videoHeight;
      void gate.offer(timestampMs, async () => {
        const began = performance.now();
        let bitmap;
        let jpeg = null;
        try {
          if (captureEvidence) {
            const canvas = new OffscreenCanvas(widthPx, heightPx);
            canvas.getContext('2d').drawImage(video, 0, 0);
            bitmap = await createImageBitmap(canvas);
            const scale = Math.min(1, 640 / Math.max(widthPx, heightPx));
            const preview = new OffscreenCanvas(Math.max(1, Math.round(widthPx * scale)), Math.max(1, Math.round(heightPx * scale)));
            preview.getContext('2d').drawImage(canvas, 0, 0, preview.width, preview.height);
            jpeg = await preview.convertToBlob({ type: 'image/jpeg', quality: .85 });
          } else bitmap = await createImageBitmap(video);
          controller.signal.throwIfAborted();
          const result = await workerRequest(worker, { type: 'frame', timestampMs, bitmap }, controller.signal, [bitmap]);
          return { result, jpeg, latencyMs: performance.now() - began };
        } finally { bitmap?.close(); }
      }, ({ result, jpeg, latencyMs }) => {
        if (video.videoWidth !== widthPx || video.videoHeight !== heightPx) { discardedDimensionResults++; return; }
        processedFrames++; latencySum += latencyMs; maxLatencyMs = Math.max(maxLatencyMs, latencyMs);
        const { events, raw, ...observation } = accumulator.process({ timestampMs, result, jpeg, widthPx, heightPx });
        const update = { ...observation, sourceMediaTimeMs: mediaMs, processingLatencyMs: latencyMs, stats: getStats() };
        if (onPoseFrame) onPoseFrame(raw);
        if (stopped) return;
        onSample(update);
        if (stopped) return;
        for (const event of events) {
          onRepComplete(event);
          if (stopped) return;
        }
      }, fail);
    };
    callback = video.requestVideoFrameCallback(presented);
    return { stop, getStats, getReport: accumulator.getReport, getEvidence: accumulator.getEvidence,
      setView(view) { if (stopped) throw new Error('The live session has stopped.'); return accumulator.setView(view); },
      resetView() { if (stopped) throw new Error('The live session has stopped.'); return accumulator.reset(); },
    };
  } catch (error) { stop(); throw error; }
}
