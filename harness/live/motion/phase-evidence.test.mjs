import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectPhaseEvidence, buildLiveCoachBundle } from './phase-evidence.mjs';
import { validateCoachingResponse } from '../../coaching/packet.mjs';

const report = JSON.parse(await readFile(new URL('../../results/clear-squat.analysis-report.v1.json', import.meta.url)));
const rep = report.reps[0];
const jpeg = new Blob(['fixture bytes; not decoded in this unit test'], { type: 'image/jpeg' });
const cache = new Map(report.frames.map(frame => [frame.timestampMs, jpeg]));

test('phase evidence contains three distinct cached samples inside one completed rep', () => {
  const samples = selectPhaseEvidence(report, rep, cache);
  assert.deepEqual(samples.map(item => item.phase), ['descent', 'bottom', 'ascent']);
  assert(samples[0].timestampMs > rep.startMs && samples[0].timestampMs < rep.bottomMs);
  assert.equal(samples[1].timestampMs, rep.bottomMs);
  assert(samples[2].timestampMs > rep.bottomMs && samples[2].timestampMs < rep.endMs);
  assert(samples.every(item => item.blob === cache.get(item.timestampMs)));
});

test('missing bottom never falls back to a nearby frame; missing phases are explicitly omitted', () => {
  const missingBottom = new Map(cache); missingBottom.delete(rep.bottomMs);
  assert.deepEqual(selectPhaseEvidence(report, rep, missingBottom), []);
  assert.deepEqual(selectPhaseEvidence(report, rep, new Map([[rep.bottomMs, jpeg]])).map(item => item.phase), ['bottom']);
  const unusable = { ...report, frames: report.frames.map(frame => ({ ...frame, quality: 'unavailable' })) };
  assert.deepEqual(selectPhaseEvidence(unusable, rep, cache), []);
});

test('live bundle remains v1-valid, cites measured phases, preserves original report and rejects uncached evidence', () => {
  const before = JSON.stringify(report);
  const { packet, images, phases } = buildLiveCoachBundle(report, rep.id, selectPhaseEvidence(report, rep, cache));
  assert.equal(packet.schemaVersion, 1);
  assert.equal(images.length, 3); assert.equal(phases.length, 3);
  assert.equal(packet.measurements.length, 7);
  assert(packet.evidence.every(ref => packet.measurements.some(item => item.evidenceTimestampMs === ref.timestampMs)));
  assert.equal(JSON.stringify(report), before);
  assert.match(packet.summary, /sparse images do not show the entire motion/);
  assert(packet.summary.length <= 512);
  const response = { observations: [], uncertainty: 'Estimated samples.', nextFocus: { text: 'Keep the next rep controlled.', evidenceIds: [packet.evidence[0].id] } };
  assert.doesNotThrow(() => validateCoachingResponse(response, packet));
  assert.throws(() => validateCoachingResponse({ ...response, nextFocus: { ...response.nextFocus, evidenceIds: ['invented-frame'] } }, packet));
  assert.throws(() => buildLiveCoachBundle(report, rep.id, []), /exact bottom/);
  assert.throws(() => buildLiveCoachBundle(report, rep.id, [{ timestampMs: rep.bottomMs, blob: jpeg }, { timestampMs: rep.bottomMs, blob: jpeg }]), /Duplicate/);
});

test('sparse-phase summary retains tracking caveats within the v1 length bound', () => {
  const uncertain = { ...report, warnings: ['unsupported_framing', 'pose_unavailable', 'intermittent_pose'].map(code => ({ code })),
    measurements: [...report.measurements, { id: 'unavailable-extra', repId: rep.id, metric: 'torso_lean', quality: 'unavailable', value: null, unit: 'deg', evidenceTimestampMs: null }] };
  const { packet } = buildLiveCoachBundle(uncertain, rep.id, selectPhaseEvidence(report, rep, cache));
  for (const text of ['Side framing unconfirmed.', 'Pose unavailable.', 'Tracking intermittent.', 'Some measurements unavailable.']) assert(packet.summary.includes(text));
  assert(packet.summary.length <= 512);
});

test('live coaching includes only the explicitly selected practice target and preserves v1 evidence binding', () => {
  const images = selectPhaseEvidence(report, rep, cache);
  const withGoal = buildLiveCoachBundle(report, rep.id, images, { targetKneeFlexionDeg: 110 });
  assert.match(withGoal.packet.goal, /110 degrees of projected knee flexion/);
  assert.match(withGoal.packet.goal, /not a universal definition of good form/);
  const withoutGoal = buildLiveCoachBundle(report, rep.id, images);
  assert.equal(withoutGoal.packet.goal, undefined, 'A disabled target must not invent an ideal');
  assert.deepEqual(withGoal.packet.measurements, withoutGoal.packet.measurements);
  assert.deepEqual(withGoal.packet.evidence, withoutGoal.packet.evidence);
  assert.throws(() => buildLiveCoachBundle(report, rep.id, images, { targetKneeFlexionDeg: NaN }), RangeError);
});
