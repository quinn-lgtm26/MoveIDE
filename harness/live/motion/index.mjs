import { DEFAULT_POSE_PRESET, POSE_PRESETS } from '../../motion/pose-model.mjs';
import { buildAnalysisReport } from '../../motion/squat.mjs';
import { getMotionTrace } from '../../motion/squat-profile.mjs';
import { rawPoseFrame } from '../../motion/raw-pose.mjs';
import { createFrameGate } from './frame-gate.mjs';
import { completedRepFeedback, createDepthFeedback } from './feedback.mjs';
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
  historyMs = 30_000, maxFrames = 450, captureEvidence = false,
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
  const depth = createDepthFeedback({ targetKneeFlexionDeg });
  const gate = createFrameGate({ maxHz });
  const preset = POSE_PRESETS[model];
  const controller = new AbortController();
  const widthPx = video.videoWidth, heightPx = video.videoHeight;
  const samples = [], images = new Map(), completed = new Map();
  let worker, callback, originMs = null, stopped = false, previousAngle = null, latestReport = null;
  let processedFrames = 0, latencySum = 0, maxLatencyMs = 0, startedAt = null, stoppedAt = null, lastPresentedMediaMs = null;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    stoppedAt = performance.now();
    gate.stop();
    controller.abort();
    if (callback !== undefined) video.cancelVideoFrameCallback(callback);
    worker?.terminate();
    signal?.removeEventListener('abort', stop);
    images.clear();
  };
  const getStats = () => ({ ...gate.stats(), processedFrames,
    elapsedMs: startedAt === null ? 0 : (stoppedAt ?? performance.now()) - startedAt,
    analyzedHz: startedAt === null ? 0 : processedFrames / Math.max(.001, ((stoppedAt ?? performance.now()) - startedAt) / 1000),
    meanProcessingLatencyMs: processedFrames ? latencySum / processedFrames : null,
    maxProcessingLatencyMs: processedFrames ? maxLatencyMs : null,
    retainedFrames: samples.length, retainedEvidenceImages: images.size,
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
      if (video.videoWidth !== widthPx || video.videoHeight !== heightPx) return fail(new Error('Video dimensions changed. Restart live analysis.'));
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
        processedFrames++; latencySum += latencyMs; maxLatencyMs = Math.max(maxLatencyMs, latencyMs);
        samples.push({ timestampMs, landmarks: result.landmarks });
        if (jpeg) images.set(timestampMs, jpeg);
        while (samples.length > maxFrames || (samples.length > 1 && timestampMs - samples[0].timestampMs > historyMs)) images.delete(samples.shift().timestampMs);
        const clip = { id: clipId, widthPx, heightPx, durationMs: Math.max(1, timestampMs + 1) };
        const report = buildAnalysisReport(clip, samples, preset.report);
        latestReport = report;
        const frame = report.frames.at(-1), metrics = getMotionTrace(report).at(-1);
        const angle = metrics.kneeFlexionDeg;
        const sideIndices = report.protocol.side === 'left' ? [23, 25, 27] : [24, 26, 28];
        const trackingConfidence = frame.quality === 'usable' ? Math.min(...sideIndices.map(index => frame.landmarks[index].visibility)) : null;
        const continuous = previousAngle && timestampMs - previousAngle.timestampMs <= 250;
        const change = continuous && angle !== null ? angle - previousAngle.value : null;
        const phase = angle === null ? 'unknown' : angle <= 30 ? 'standing'
          : change === null ? 'moving' : change > 2 ? 'descent' : change < -2 ? 'ascent' : angle >= 60 ? 'near-bottom' : 'moving';
        previousAngle = angle === null ? null : { timestampMs, value: angle };
        const update = { timestampMs, sourceMediaTimeMs: mediaMs, report, frame, metrics,
          phase, phaseIsProvisional: true, trackingConfidence,
          feedback: depth.update({ timestampMs, kneeFlexionDeg: angle, quality: frame.quality }),
          windowStartMs: samples[0].timestampMs, processingLatencyMs: latencyMs, stats: getStats() };
        if (onPoseFrame) onPoseFrame(rawPoseFrame(timestampMs, result, preset.report));
        if (stopped) return;
        onSample(update);
        if (stopped) return;
        // Wait for two later samples so the non-causal phase smoother has settled.
        const finalizedUntil = samples.at(-3)?.timestampMs ?? -1;
        for (const rep of report.reps) {
          const key = `${clipId}:${rep.startMs}:${rep.endMs}`;
          if (rep.endMs > finalizedUntil || completed.has(key)) continue;
          completed.set(key, rep.endMs);
          onRepComplete({ key, rep, report, feedback: completedRepFeedback(report, rep.id, targetKneeFlexionDeg),
            evidenceImages: images.has(rep.bottomMs) ? [{ timestampMs: rep.bottomMs, blob: images.get(rep.bottomMs) }] : [] });
          if (stopped) return;
        }
        for (const [key, endMs] of completed) if (endMs < samples[0].timestampMs) completed.delete(key);
      }, fail);
    };
    callback = video.requestVideoFrameCallback(presented);
    return { stop, getStats, getReport: () => latestReport, getEvidence: timestampMs => images.get(timestampMs) ?? null };
  } catch (error) { stop(); throw error; }
}
