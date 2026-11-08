/** Bounded, video-only local recording. Does not stop the source's tracks. */
export function createLiveRecorder(stream, {
  Recorder = globalThis.MediaRecorder, now = () => performance.now(),
  maxBytes = 100 * 1024 * 1024, maxDurationMs = 5 * 60 * 1000,
  onStatus = () => {},
} = {}) {
  let recorder, timer, timeout, chunks = [], bytes = 0, reason = 'stopped', error = null;
  let startedAtMs = now(), endedAtMs = null, settled = false, stopping = false, mapping = null;
  let resolve;
  const done = new Promise(complete => { resolve = complete; });
  const finish = () => {
    if (settled) return;
    settled = true; clearTimeout(timer); clearTimeout(timeout); endedAtMs ??= now();
    const blob = error || !bytes ? null : new Blob(chunks, { type: recorder?.mimeType || chunks[0]?.type || 'video/webm' });
    chunks = [];
    const result = { videoBlob: blob, recording: { mimeType: blob?.type ?? null, bytes: blob?.size ?? 0,
      durationMs: Math.max(0, endedAtMs - startedAtMs), stopReason: reason, error,
      alignment: 'approximate', timingNote: 'Recording time and analysis source time are separate clocks. The first-sample mapping is approximate; no frame-exact replay overlay is provided.',
      firstSampleMapping: mapping } };
    onStatus({ state: error ? 'unavailable' : 'finished', reason, error }); resolve(result);
  };
  const stop = (why = 'stopped') => {
    if (stopping || settled) return done;
    stopping = true; reason = why; endedAtMs = now(); clearTimeout(timer);
    if (recorder?.state !== 'inactive') {
      // Some browsers fail to emit stop after an encoder error. Never wait forever.
      timeout = setTimeout(() => { error = 'Recording could not be finalized. Measurements can still be saved.'; finish(); }, 5000);
      try { recorder.stop(); } catch { error = 'Recording could not be finalized.'; finish(); }
    } else finish();
    return done;
  };
  try {
    if (!Recorder) throw new Error('This browser cannot record video. Measurements and notes will still be saved.');
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4', 'video/webm'].find(type => Recorder.isTypeSupported(type));
    if (!mimeType) throw new Error('No supported recording format. Measurements and notes will still be saved.');
    // A separate stream wrapper excludes audio without owning or stopping the video track.
    const videoStream = typeof MediaStream === 'undefined' ? stream : new MediaStream(stream.getVideoTracks());
    recorder = new Recorder(videoStream, { mimeType, videoBitsPerSecond: 2_000_000 });
    recorder.ondataavailable = event => {
      if (settled || !event.data?.size || error) return;
      if (bytes + event.data.size > maxBytes) {
        error = 'Video reached its storage limit. Measurements and notes can still be saved.';
        chunks = []; bytes = 0; void stop('size-limit'); return;
      }
      chunks.push(event.data); bytes += event.data.size;
      if (bytes >= maxBytes * .95) void stop('size-limit');
    };
    recorder.onerror = () => { error = 'Video recording failed. Measurements and notes can still be saved.'; void stop('encoder-error'); };
    recorder.onstop = finish;
    startedAtMs = now(); recorder.start(1000);
    timer = setTimeout(() => void stop('duration-limit'), maxDurationMs);
    onStatus({ state: 'recording' });
  } catch (failure) { error = failure.message; reason = 'unsupported'; finish(); }
  return {
    stop,
    markSample(sample) {
      if (!mapping && !settled) mapping = { analysisTimestampMs: sample.timestampMs, sourceMediaTimeMs: sample.sourceMediaTimeMs,
        recordingElapsedMs: Math.max(0, now() - startedAtMs - (sample.processingLatencyMs || 0)) };
    },
  };
}

/** Bounded session data, retaining validity and view epoch with every sample. */
export function createLiveArchive({ source, startedAt = new Date().toISOString() }) {
  const live = { source, startedAt, samples: [], reps: [], notes: [], evidence: [], samplesTruncated: false, repsTruncated: false };
  let lastSample = -Infinity;
  const finiteNonnegative = value => Number.isFinite(value) && value >= 0 ? value : null;
  const counter = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  return {
    live,
    sample(sample) {
      if (sample.timestampMs - lastSample < 250) return;
      lastSample = sample.timestampMs;
      if (live.samples.length >= 1200) { live.samplesTruncated = true; return; }
      live.samples.push({ timestampMs: sample.timestampMs, sourceMediaTimeMs: sample.sourceMediaTimeMs, viewEpoch: sample.viewGuard.epoch,
        metrics: structuredClone(sample.metrics), metricValidity: structuredClone(sample.metricValidity), analysisEligible: sample.analysisEligible,
        phase: sample.phase, trackingConfidence: sample.trackingConfidence,
        // Retain why tracking was withheld. Video duration alone never proves analysis ran.
        // Only bounded scalar diagnostics enter history; never worker payloads or raw poses.
        viewGuard: { state: ['stable', 'reacquiring', 'unavailable'].includes(sample.viewGuard.state) ? sample.viewGuard.state : null,
          reason: typeof sample.viewGuard.reason === 'string' ? sample.viewGuard.reason.slice(0, 80) : null,
          epoch: sample.viewGuard.epoch },
        processingLatencyMs: finiteNonnegative(sample.processingLatencyMs),
        stats: { analyzedHz: finiteNonnegative(sample.stats?.analyzedHz), processedFrames: counter(sample.stats?.processedFrames), droppedBusy: counter(sample.stats?.droppedBusy) } });
    },
    rep(event) {
      if (live.reps.length >= 150) { live.repsTruncated = true; return; }
      live.reps.push({ ...structuredClone(event.rep), key: event.key, viewEpoch: event.epoch, feedback: structuredClone(event.feedback) });
    },
    note(event, result, packet) {
      if (live.notes.length >= 6 || live.notes.some(note => note.repKey === event.key)) return;
      live.notes.push({ text: result.nextFocus.text, repId: event.rep.id, repKey: event.key, timestampMs: event.rep.bottomMs,
        viewEpoch: event.epoch, result: structuredClone(result), ...(packet ? { packet: structuredClone(packet) } : {}) });
      for (const image of event.evidenceImages.slice(0, 32)) {
        if (image.blob?.size <= 1024 * 1024) live.evidence.push({ ...image, repKey: event.key, viewEpoch: event.epoch });
      }
    },
  };
}
