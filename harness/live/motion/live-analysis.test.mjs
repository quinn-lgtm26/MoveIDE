import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createLiveAnalysis } from './live-analysis.mjs';
import { buildLiveCoachBundle } from './phase-evidence.mjs';
const fixture = JSON.parse(await readFile(new URL('../../results/clear-squat.analysis-report.v1.json', import.meta.url)));
const jpeg = time => new Blob([`fixture-image-at-${time}`], { type: 'image/jpeg' }); // cache identity only, not real JPEG pixels
const output = landmarks => ({ landmarks: landmarks.map(point => point && ({ ...point, z: 0, presence: 1 })), worldLandmarks: [] });
const setup = options => createLiveAnalysis({ clipId: 'guard-fixture', poseModel: fixture.poseModel, targetKneeFlexionDeg: 110, ...options });
const push = (analysis, time, landmarks = fixture.frames[0].landmarks, dimensions = fixture.clip) => analysis.process({
  timestampMs: time, result: output(landmarks), jpeg: jpeg(time), widthPx: dimensions.widthPx, heightPx: dimensions.heightPx,
});
function warm(analysis, start = 0, landmarks) { let last; for (let t = start; t <= start + 900; t += 100) last = push(analysis, t, landmarks); return last; }
function runClip(analysis, start) {
  const observations = fixture.frames.map(frame => push(analysis, start + frame.timestampMs, frame.landmarks));
  for (const dt of [0, 100, 200]) observations.push(push(analysis, start + fixture.clip.durationMs + dt, fixture.frames.at(-1).landmarks));
  return observations;
}

test('startup withholds current metrics until stable and confirmed, then emits bounded multi-phase evidence', async () => {
  const analysis = setup();
  let first = push(analysis, 0);
  assert.equal(first.viewGuard.state, 'reacquiring'); assert.equal(first.analysisEligible, false);
  assert.equal(first.metrics.kneeFlexionDeg, null); assert.equal(first.metricValidity.kneeFlexionDeg.reason, 'view_reacquiring');
  assert.ok(Object.values(first.multiView.metrics).every(metric => metric.value === null));
  for (let t = 100; t <= 900; t += 100) first = push(analysis, t);
  assert.equal(first.analysisEligible, true); assert.equal(first.metricValidity.kneeFlexionDeg.status, 'estimated');
  const observed = runClip(analysis, 1000), events = observed.flatMap(item => item.events);
  assert.equal(events.length, 2); assert.equal(new Set(events.map(event => event.key)).size, 2);
  for (const event of events) {
    assert.equal(event.epoch, 0); assert.ok(event.evidenceImages.length>7 && event.evidenceImages.length<=32);assert.equal(event.imageSampling.selectedImageCount,event.evidenceImages.length);
    for (const image of event.evidenceImages) assert.equal(await image.blob.text(), `fixture-image-at-${image.timestampMs}`);
    assert.equal(buildLiveCoachBundle(event.report, event.rep.id, event.evidenceImages).images.length, event.evidenceImages.length);
  }
});

test('a view discontinuity clears old evidence, target dwell and unfinished rep baselines', () => {
  const analysis = setup(); warm(analysis);
  const before = runClip(analysis, 1000); const historical = before.flatMap(item => item.events)[0];
  const oldImage = historical.rep.bottomMs;
  assert.ok(analysis.getEvidence(oldImage));
  const shifted = fixture.frames[0].landmarks.map(point => point && ({ ...point, y: point.y - .15 }));
  const changed = push(analysis, 5100, shifted);
  assert.equal(changed.viewGuard.epoch, 1); assert.equal(changed.analysisEligible, false);
  assert.equal(changed.feedback.state, 'unknown'); assert.equal(changed.metrics.kneeFlexionDeg, null);
  assert.equal(changed.events.length, 0); assert.equal(changed.report.reps.length, 0); assert.equal(analysis.getEvidence(oldImage), null);
  assert.ok(historical.report.reps.length, 'Accepted historical report is not mutated');
  for (const time of [5200, 5300, 5400, 5500]) assert.equal(push(analysis, time, shifted).analysisEligible, false);
});

test('explicit front/unknown views reset baselines and keep experimental diagnostics distinct from side metrics', () => {
  const analysis = setup(); warm(analysis);
  assert.equal(analysis.setView('front'), true); assert.equal(analysis.getReport(), null); assert.equal(analysis.getStats().retainedEvidenceImages, 0);
  const last = warm(analysis, 1000);
  assert.equal(last.viewGuard.declaredView, 'front'); assert.equal(last.viewGuard.epoch, 1);
  assert.equal(last.analysisEligible, false); assert.equal(last.metricValidity.kneeFlexionDeg.reason, 'side_view_required');
  assert.equal(last.poseDisplayFrame.quality, 'usable', 'A stable full-body drawing remains separate from unsupported side metrics');
  assert.ok(last.poseDisplayFrame.landmarks[11]);
  assert.equal(last.multiView.experimental, true); assert.equal(last.multiView.metrics.leftKneeFlexion3d.status, 'unavailable');
  assert.equal(last.multiView.metrics.leftKneeFlexion3d.reason, 'missing_world_landmark');
  assert.equal(analysis.setView('front'), false);
  analysis.setView('unknown'); const unknown = warm(analysis, 2000);
  assert.ok(Object.values(unknown.multiView.metrics).every(metric => metric.value === null && metric.reason === 'unknown_view'));
});

test('dimensions, confidence gaps and source reset cannot reuse a prior epoch', () => {
  const analysis = setup(); warm(analysis);
  const resized = push(analysis, 1000, undefined, { widthPx: 1440, heightPx: 810 });
  assert.equal(resized.viewGuard.reason, 'image-size-changed'); assert.equal(resized.viewGuard.epoch, 1);
  const obscured = structuredClone(fixture.frames[0].landmarks); obscured[23].visibility = .1;
  const lost = push(analysis, 1100, obscured, { widthPx: 1440, heightPx: 810 });
  assert.equal(lost.viewGuard.state, 'unavailable'); assert.equal(lost.metrics.kneeFlexionDeg, null);
  const reset = analysis.reset(); assert.ok(reset.epoch > lost.viewGuard.epoch);
  assert.equal(push(analysis, 0).viewGuard.state, 'reacquiring');
});

test('cache remains bounded and low-confidence limb loss clears a previously eligible side report', () => {
  const analysis = setup({ maxFrames: 10 }); warm(analysis);
  runClip(analysis, 1000); assert.ok(analysis.getStats().retainedFrames <= 10); assert.ok(analysis.getStats().retainedEvidenceImages <= 10);
  const obscured = structuredClone(fixture.frames.at(-1).landmarks); obscured[27].visibility = .1; obscured[28].visibility = .1;
  const lost = push(analysis, 5100, obscured);
  assert.equal(lost.analysisEligible, false); assert.equal(lost.report.reps.length, 0); assert.equal(lost.metrics.kneeFlexionDeg, null);
  analysis.clearEvidence(); assert.equal(analysis.getStats().retainedEvidenceImages, 0);
});

test('slow steady observations recover individual angles without inventing continuous completed reps', () => {
  const analysis = setup();
  const observations = [];
  for (let index = 0; index < 12; index++) observations.push(push(analysis, index * 300));
  assert.equal(observations.at(-1).viewGuard.state, 'stable');
  assert.equal(observations.at(-1).analysisEligible, true);
  assert.ok(Number.isFinite(observations.at(-1).metrics.kneeFlexionDeg));
  for (const [index, frame] of fixture.frames.entries()) observations.push(push(analysis, 3600 + index * 300, frame.landmarks));
  assert.equal(observations.flatMap(item => item.events).length, 0, 'The strict rep evidence gap remains enforced separately from view continuity');
});

test('three complete cycles plus a final descent remain three events until the fourth returns to standing', () => {
  const analysis = setup(); warm(analysis);
  const first = runClip(analysis, 1000), events = first.flatMap(item => item.events);
  const nextStart = first.at(-1).timestampMs + 100;
  const finalBottom = fixture.reps.at(-1).bottomMs;
  for (const frame of fixture.frames.filter(frame => frame.timestampMs <= finalBottom)) {
    events.push(...push(analysis, nextStart + frame.timestampMs, frame.landmarks).events);
  }
  assert.equal(events.length, 3, 'A visible final descent/bottom is still an unfinished cycle');
  for (const frame of fixture.frames.filter(frame => frame.timestampMs > finalBottom)) {
    events.push(...push(analysis, nextStart + frame.timestampMs, frame.landmarks).events);
  }
  for (const dt of [0, 100, 200]) events.push(...push(analysis, nextStart + fixture.clip.durationMs + dt, fixture.frames.at(-1).landmarks).events);
  assert.equal(events.length, 4);
  assert.equal(new Set(events.map(event => event.key)).size, 4);
});
