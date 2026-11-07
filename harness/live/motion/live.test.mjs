import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFrameGate } from './frame-gate.mjs';
import { createDepthFeedback, completedRepFeedback } from './feedback.mjs';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('slow inference has one in-flight frame, no pending queue, and resumes with freshest next callback', async () => {
  const gate = createFrameGate({ maxHz: 15 }); const task = deferred(); const delivered = [];
  const pending = gate.offer(0, () => task.promise, value => delivered.push(value), assert.fail);
  for (const time of [33, 66, 100, 133]) assert.equal(await gate.offer(time, assert.fail, assert.fail, assert.fail), false);
  assert.equal(gate.stats().inFlight, true); assert.equal(gate.stats().droppedBusy, 4);
  task.resolve('first'); await pending;
  await gate.offer(166, async () => 'fresh', value => delivered.push(value), assert.fail);
  assert.deepEqual(delivered, ['first', 'fresh']); assert.equal(gate.stats().acceptedFrames, 2);
});
test('cadence and media timestamp guards reject duplicates, regressions and excessive cadence', async () => {
  const gate = createFrameGate({ maxHz: 10 }); const seen = [];
  for (const t of [0, 0, -1, 33, 100, 200]) await gate.offer(t, async () => t, value => seen.push(value), assert.fail);
  assert.deepEqual(seen, [0, 100, 200]); assert.equal(gate.stats().droppedCadence, 1); assert.equal(gate.stats().droppedNonMonotonic, 2);
});
test('stop suppresses both late success and late failure and accepts no new work', async () => {
  for (const mode of ['resolve', 'reject']) {
    const gate = createFrameGate(); const task = deferred();
    const pending = gate.offer(0, () => task.promise, assert.fail, assert.fail);
    gate.stop(); task[mode](mode === 'resolve' ? 1 : new Error('late worker response')); await pending;
    assert.equal(await gate.offer(500, assert.fail, assert.fail, assert.fail), false);
    assert.equal(gate.stats().inFlight, false); assert.equal(gate.stats().stopped, true);
  }
});
test('valid tracking alone is neutral and low confidence is unknown', () => {
  const depth = createDepthFeedback();
  assert.equal(depth.update({ timestampMs: 0, kneeFlexionDeg: 120, quality: 'usable' }).state, 'tracking');
  assert.equal(depth.update({ timestampMs: 100, kneeFlexionDeg: 120, quality: 'unavailable' }).state, 'unknown');
});
test('chosen target needs sustained evidence, holds through small jitter, releases below margin, and resets on gaps', () => {
  const depth = createDepthFeedback({ targetKneeFlexionDeg: 110 });
  const at = (t, angle, quality='usable') => depth.update({ timestampMs:t, kneeFlexionDeg:angle, quality }).state;
  assert.equal(at(0, 111), 'tracking'); assert.equal(at(100, 112), 'tracking'); assert.equal(at(200, 111), 'target-met');
  assert.equal(at(300, 108), 'target-met'); assert.equal(at(400, 104), 'tracking');
  assert.equal(at(500, 112), 'tracking'); assert.equal(at(650, 112), 'target-met');
  assert.equal(at(1000, 112), 'tracking'); assert.equal(at(1100, 112, 'unavailable'), 'unknown');
  assert.equal(at(1200, 112), 'tracking'); assert.equal(at(1350, 112), 'target-met');
});
test('completed target classification is grounded in the measured rep bottom, never a universal posture label', async () => {
  const report = JSON.parse(await readFile(new URL('../../results/clear-squat.analysis-report.v1.json', import.meta.url)));
  const rep = report.reps[0];
  assert.equal(completedRepFeedback(report, rep.id).state, 'unknown');
  assert.equal(completedRepFeedback(report, rep.id, 110).state, 'target-met');
  assert.equal(completedRepFeedback(report, rep.id, 145).state, 'attention');
  assert.equal(completedRepFeedback(report, 'missing', 110).state, 'unknown');
  const wrongEvidence = structuredClone(report);
  wrongEvidence.measurements.find(m => m.repId === rep.id && m.metric === 'knee_flexion').evidenceTimestampMs++;
  assert.equal(completedRepFeedback(wrongEvidence, rep.id, 110).state, 'unknown');
});
