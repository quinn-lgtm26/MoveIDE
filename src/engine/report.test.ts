import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Frame, Landmark } from '../contract.ts';
import type { AnalysisReport } from '../contract.ts';
import { buildReport, pickSide } from './report.ts';
import { buildPacket } from './packet.ts';

const clip = { id: 'c', widthPx: 100, heightPx: 100, durationMs: 1000 };
const L = (x: number, y: number, visibility = 0.9): Landmark => ({ x, y, visibility });

/** Right side bent at `kneeX` (0.5 = straight leg); left side invisible. */
function frame(t: number, kneeX: number, rightVis = 0.9): Frame {
  const lm: (Landmark | null)[] = Array.from({ length: 33 }, () => L(0, 0, 0.1));
  lm[24] = L(0.5, 0.2, rightVis); lm[26] = L(kneeX, 0.5, rightVis); lm[28] = L(0.5, 0.8, rightVis);
  return { timestampMs: t, landmarks: lm, quality: 'usable' };
}

// Knee x offset giving `deg` flexion for the right-leg frame() above: flexion = 2·atan(dx / 0.3).
const bend = (deg: number) => 0.5 + 0.3 * Math.tan((deg / 2) * Math.PI / 180);

test('picks the visible side and reports the deepest frame as evidence', () => {
  const r = buildReport(clip, [frame(0, bend(20)), frame(67, bend(40)), frame(133, bend(30))]);
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
  const r = buildReport(clip, [front]);
  assert.ok(r.warnings.some((w) => w.code === 'not_side_view'));
  assert.equal(r.measurements[0].quality, 'unavailable', 'front-view knee angle is projection, not flexion');
  const side = frame(0, 0.7);
  side.landmarks[23] = L(0.48, 0.2); side.landmarks[27] = L(0.48, 0.8);
  assert.ok(!buildReport(clip, [side]).warnings.some((w) => w.code === 'not_side_view'));
});

// Realistic 15 fps squat: ≤ 25° per frame. Reps: start 2 / bottom 6 / end 10, then 12 / 17 / 22.
const TWO_REPS = [5, 5, 25, 50, 75, 100, 110, 95, 70, 45, 20, 5, 10, 30, 55, 80, 105, 125, 115, 90, 65, 40, 15, 5];
const ms = (i: number) => Math.round(i * 1000 / 15);
const trace = (degs: (number | null)[]) => degs.map((d, i) => (d === null ? frame(Math.round(i * 1000 / 15), 0.7, 0.2) : frame(Math.round(i * 1000 / 15), bend(d))));

/** AnalysisReport v1 invariants the JSON schema and contract prose require. */
function assertValid(r: AnalysisReport) {
  const ids = new Set(r.reps.map((x) => x.id));
  assert.equal(ids.size, r.reps.length, 'unique rep ids');
  for (const rep of r.reps) assert.ok(rep.startMs <= rep.bottomMs && rep.bottomMs <= rep.endMs && rep.startMs < rep.endMs);
  for (const m of r.measurements) {
    assert.equal(m.quality === 'usable', m.value !== null && m.evidenceTimestampMs !== null);
    if (m.metric === 'rep_duration') assert.ok(m.unit === 'ms' && m.repId);
    else assert.ok(m.unit === 'deg' && (m.value ?? 0) <= 180);
    if (m.evidenceTimestampMs !== null) assert.ok(r.frames.some((f) => f.timestampMs === m.evidenceTimestampMs));
    if (m.repId === null) continue;
    const rep = r.reps.find((x) => x.id === m.repId);
    assert.ok(rep, `${m.id} rep resolves`);
    if (m.evidenceTimestampMs !== null) assert.ok(rep.startMs <= m.evidenceTimestampMs && m.evidenceTimestampMs <= rep.endMs);
  }
}

test('segments two reps with bottoms, durations, and consistent ids', () => {
  const r = buildReport(clip, trace(TWO_REPS));
  assertValid(r);
  assert.deepEqual(r.reps.map((x) => [x.id, x.startMs, x.bottomMs, x.endMs]), [['rep-1', ms(2), ms(6), ms(10)], ['rep-2', ms(12), ms(17), ms(22)]]);
  assert.deepEqual(r.measurements.map((m) => [m.id, m.repId, m.quality]), [
    ['m-knee-1', 'rep-1', 'usable'], ['m-duration-1', 'rep-1', 'usable'], ['m-knee-2', 'rep-2', 'usable'], ['m-duration-2', 'rep-2', 'usable'],
  ]);
  assert.ok(Math.abs(r.measurements[2].value! - 125) < 1);
  assert.equal(r.measurements[3].value, ms(22) - ms(12));
  assert.ok(!r.warnings.some((w) => w.code === 'no_complete_reps'));
});

test('a one-frame spike neither wins the bottom nor makes a rep', () => {
  const r = buildReport(clip, trace([5, 10, 30, 55, 80, 100, 170, 95, 70, 45, 20, 5]));
  assert.equal(r.reps.length, 1);
  assert.ok(Math.abs(r.measurements[0].value! - 100) < 1, 'spike 170 dropped');
  assert.equal(buildReport(clip, trace([5, 5, 5, 90, 5, 5])).reps.length, 0);
});

test('a tracking gap over the bottom tolerance → that rep is unavailable, not guessed', () => {
  const r = buildReport(clip, trace([5, 10, 30, 55, 80, null, null, null, 85, 60, 35, 10, 5]));
  assertValid(r);
  assert.equal(r.reps.length, 1);
  assert.ok(r.measurements.every((m) => m.quality === 'unavailable' && m.repId === 'rep-1'));
  assert.ok(r.warnings.some((w) => w.code === 'rep_untracked'));
});

test('starting in a squat or ending mid-rep is not a complete rep', () => {
  const r = buildReport(clip, trace([100, 90, 70, 50, 30, 10, 5, 25, 50, 75, 95]));
  assertValid(r);
  assert.equal(r.reps.length, 0);
  assert.equal(r.measurements[0].repId, null);
  assert.ok(r.warnings.some((w) => w.code === 'no_complete_reps'));
});

test('coach packet: selected reps only, whitelisted keys, ≤ 4 evidence frames, no trace', () => {
  const r = buildReport(clip, trace(TWO_REPS));
  const p = buildPacket(r, ['rep-1', 'rep-2'], { charterVersion: 'test-1', goal: 'deeper squat' });
  assert.deepEqual(Object.keys(p).sort(), ['charterVersion', 'evidence', 'goal', 'measurements', 'protocolVersion', 'repIds', 'schemaVersion', 'summary']);
  assert.ok(p.measurements.every((m) => !('quality' in m)) && p.measurements.length === 4);
  assert.deepEqual(p.evidence.map((e) => e.timestampMs), [ms(6), ms(17)], 'both rep bottoms');
  assert.ok(p.evidence.length <= 4 && p.evidence.every((e) => e.imageName === `frame-${e.timestampMs}ms.jpg`));
  assert.ok(!JSON.stringify(p).includes('visibility') && !JSON.stringify(p).includes('landmarks'));
  assert.match(p.summary, /2 complete rep/);
  assert.deepEqual(buildPacket(r, ['rep-2'], { charterVersion: 'c' }).measurements.map((m) => m.id), ['m-knee-2', 'm-duration-2']);
  assert.throws(() => buildPacket(r, ['rep-9'], { charterVersion: 'c' }), /Unknown rep/);
});
