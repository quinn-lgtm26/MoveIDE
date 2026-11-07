import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Frame, Landmark } from '../contract.ts';
import { buildReport, pickSide } from './report.ts';

const clip = { id: 'c', widthPx: 100, heightPx: 100, durationMs: 1000 };
const L = (x: number, y: number, visibility = 0.9): Landmark => ({ x, y, visibility });

/** Right side bent at `kneeX` (0.5 = straight leg); left side invisible. */
function frame(t: number, kneeX: number, rightVis = 0.9): Frame {
  const lm: (Landmark | null)[] = Array.from({ length: 33 }, () => L(0, 0, 0.1));
  lm[24] = L(0.5, 0.2, rightVis); lm[26] = L(kneeX, 0.5, rightVis); lm[28] = L(0.5, 0.8, rightVis);
  return { timestampMs: t, landmarks: lm, quality: 'usable' };
}

test('picks the visible side and reports the deepest frame as evidence', () => {
  const r = buildReport(clip, [frame(0, 0.5), frame(67, 0.7), frame(133, 0.6)]);
  assert.equal(r.protocol.side, 'right');
  const [m] = r.measurements;
  assert.equal(m.quality, 'usable');
  assert.equal(m.evidenceTimestampMs, 67);
  assert.ok(r.frames.some((f) => f.timestampMs === m.evidenceTimestampMs), 'evidence is a sampled frame');
  assert.ok(m.value! > 0 && m.value! <= 180);
});

test('low visibility everywhere → unavailable measurement with a warning, no fabricated value', () => {
  const r = buildReport(clip, [frame(0, 0.7, 0.2), frame(67, 0.7, 0.3)]);
  assert.equal(pickSide(r.frames), null);
  assert.deepEqual(r.measurements[0], {
    id: 'm-knee-1', repId: null, metric: 'knee_flexion', value: null, unit: 'deg', quality: 'unavailable', evidenceTimestampMs: null,
  });
  assert.ok(r.warnings.some((w) => w.code === 'knee_unavailable'));
});

test('no pose at all → no_pose warning', () => {
  const r = buildReport(clip, [{ timestampMs: 0, landmarks: Array(33).fill(null), quality: 'unavailable' }]);
  assert.ok(r.warnings.some((w) => w.code === 'no_pose'));
});

test('tracked in under half the frames → low_tracking warning', () => {
  const r = buildReport(clip, [frame(0, 0.7), frame(67, 0.7, 0.2), frame(133, 0.7, 0.2)]);
  assert.equal(r.measurements[0].quality, 'usable');
  assert.ok(r.warnings.some((w) => w.code === 'low_tracking'));
  assert.ok(!buildReport(clip, [frame(0, 0.7)]).warnings.some((w) => w.code === 'low_tracking'));
});

test('hips far apart relative to leg length → not_side_view warning', () => {
  const front = frame(0, 0.7);
  front.landmarks[23] = L(0.1, 0.2); front.landmarks[27] = L(0.1, 0.8); // hips 0.4 apart, leg 0.6 long
  assert.ok(buildReport(clip, [front]).warnings.some((w) => w.code === 'not_side_view'));
  const side = frame(0, 0.7);
  side.landmarks[23] = L(0.48, 0.2); side.landmarks[27] = L(0.48, 0.8);
  assert.ok(!buildReport(clip, [side]).warnings.some((w) => w.code === 'not_side_view'));
});
