import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLiveArchive, createLiveRecorder } from './live-recorder.mjs';

class Recorder {
  static isTypeSupported(type) { return type === 'video/webm'; }
  constructor(stream, options) { this.mimeType = options.mimeType; Recorder.last = this; }
  start() { this.state = 'recording'; }
  emit(size) { this.ondataavailable({ data: new Blob([new Uint8Array(size)], { type: this.mimeType }) }); }
  stop() { this.state = 'inactive'; queueMicrotask(() => this.onstop()); }
}

test('recording finalizes once and records explicitly approximate first-sample timing', async () => {
  let clock = 100;
  const recorder = createLiveRecorder({}, { Recorder, now: () => clock });
  clock = 300; recorder.markSample({ timestampMs: 50, sourceMediaTimeMs: 500, processingLatencyMs: 40 });
  recorder.markSample({ timestampMs: 100, sourceMediaTimeMs: 550, processingLatencyMs: 0 });
  Recorder.last.emit(200); clock = 800;
  const result = await recorder.stop();
  assert.equal(result, await recorder.stop());
  assert.equal(result.videoBlob.size, 200);
  assert.equal(result.recording.durationMs, 700);
  assert.equal(result.recording.alignment, 'approximate');
  assert.deepEqual(result.recording.firstSampleMapping, { analysisTimestampMs: 50, sourceMediaTimeMs: 500, recordingElapsedMs: 160 });
});

test('an oversized encoder chunk never creates a blob beyond the hard cap', async () => {
  const recorder = createLiveRecorder({}, { Recorder, maxBytes: 100 });
  Recorder.last.emit(50); Recorder.last.emit(60);
  const result = await recorder.stop();
  assert.equal(result.videoBlob, null);
  assert.equal(result.recording.stopReason, 'size-limit');
  assert.match(result.recording.error, /storage limit/);
});

test('duration limit preserves a bounded prefix and unsupported codecs preserve metadata fallback', async () => {
  const statuses = [];
  const recorder = createLiveRecorder({}, { Recorder, maxDurationMs: 10, onStatus: status => statuses.push(status) });
  Recorder.last.emit(30);
  await new Promise(resolve => setTimeout(resolve, 30));
  const result = await recorder.stop();
  assert.equal(result.recording.stopReason, 'duration-limit');
  assert.equal(result.videoBlob.size, 30);
  assert.equal(statuses.at(-1).state, 'finished');
  const unsupported = await createLiveRecorder({}, { Recorder: null }).stop();
  assert.equal(unsupported.videoBlob, null);
  assert.equal(unsupported.recording.stopReason, 'unsupported');
});

test('archive bounds samples, reps, notes and accepted evidence while retaining validity and epoch', () => {
  const archive = createLiveArchive({ source: 'phone' });
  const sample = { sourceMediaTimeMs: 40, viewGuard: { epoch: 3 }, metrics: { kneeFlexionDeg: null }, metricValidity: { kneeFlexionDeg: { status: 'unavailable' } }, analysisEligible: false, phase: 'unknown', trackingConfidence: .4 };
  for (let i = 0; i < 1300; i++) archive.sample({ ...sample, timestampMs: i * 250 });
  assert.equal(archive.live.samples.length, 1200); assert.equal(archive.live.samplesTruncated, true);
  assert.equal(archive.live.samples[0].viewEpoch, 3); assert.equal(archive.live.samples[0].metricValidity.kneeFlexionDeg.status, 'unavailable');
  const event = { key: 'one', epoch: 2, rep: { id: 'rep-1', bottomMs: 1000 }, feedback: { state: 'unknown' }, evidenceImages: [{ timestampMs: 1000, phase: 'bottom', blob: new Blob(['jpeg']) }] };
  const result = { nextFocus: { text: 'Keep moving' }, observations: [], uncertainty: 'Limited view' };
  for (let i = 0; i < 160; i++) { archive.rep({ ...event, key: String(i) }); archive.note({ ...event, key: String(i) }, result); }
  assert.equal(archive.live.reps.length, 150); assert.equal(archive.live.repsTruncated, true);
  assert.equal(archive.live.notes.length, 6); assert.equal(archive.live.evidence.length, 6);
  archive.note({ ...event, key: '0' }, result); assert.equal(archive.live.notes.length, 6);
});

test('real browser video-only recorder yields a replayable local blob without camera access', async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const source = await readFile(new URL('./live-recorder.mjs', import.meta.url), 'utf8');
    const result = await page.evaluate(async moduleSource => {
      const moduleUrl = URL.createObjectURL(new Blob([moduleSource], { type: 'text/javascript' }));
      const { createLiveRecorder } = await import(moduleUrl); URL.revokeObjectURL(moduleUrl);
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
      const context = canvas.getContext('2d'), stream = canvas.captureStream(15);
      const recorder = createLiveRecorder(stream); let count = 0;
      const timer = setInterval(() => { context.fillStyle = count++ % 2 ? 'green' : 'blue'; context.fillRect(0, 0, 320, 240); }, 60);
      await new Promise(resolve => setTimeout(resolve, 1200));
      const saved = await recorder.stop(); clearInterval(timer);
      const sourceStillLive = stream.getVideoTracks()[0].readyState === 'live';
      stream.getTracks().forEach(track => track.stop());
      const video = document.createElement('video'); video.muted = true;
      const url = URL.createObjectURL(saved.videoBlob); video.src = url;
      await video.play(); await new Promise(resolve => video.addEventListener('timeupdate', resolve, { once: true }));
      const replay = { width: video.videoWidth, height: video.videoHeight, currentTime: video.currentTime };
      video.pause(); URL.revokeObjectURL(url);
      return { bytes: saved.videoBlob.size, type: saved.videoBlob.type, sourceStillLive, replay };
    }, source);
    assert.ok(result.bytes > 0); assert.match(result.type, /^video\//); assert.equal(result.sourceStillLive, true);
    assert.equal(result.replay.width, 320); assert.equal(result.replay.height, 240); assert.ok(result.replay.currentTime > 0);
  } finally { await browser.close(); }
});
