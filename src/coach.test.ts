import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AnalysisReport, Measurement } from './contract.ts';
import { CHARTER_VERSION, buildPacket, delta, packetText, repRow } from './coach.ts';

const m = (id: string, repId: string, metric: Measurement['metric'], value: number | null, t: number | null): Measurement => ({
  id, repId, metric, value, unit: metric === 'rep_duration' ? 'ms' : 'deg', quality: value === null ? 'unavailable' : 'usable', evidenceTimestampMs: t,
});

const report: AnalysisReport = {
  schemaVersion: 1,
  clip: { id: 'clip', widthPx: 640, heightPx: 480, durationMs: 6000 },
  protocol: { id: 'squat-side', version: '1.0.0', side: 'right' },
  poseModel: { id: 'x', version: '1' },
  frames: [],
  reps: [
    { id: 'r1', startMs: 0, bottomMs: 1000, endMs: 2000 },
    { id: 'r2', startMs: 2000, bottomMs: 3000, endMs: 4200 },
    { id: 'r3', startMs: 4200, bottomMs: 5000, endMs: 6000 },
  ],
  measurements: [
    m('k1', 'r1', 'knee_flexion', 100.04, 1000), m('d1', 'r1', 'rep_duration', 2000, 1000),
    m('k2', 'r2', 'knee_flexion', 110.5, 3000), m('d2', 'r2', 'rep_duration', 2200, 3000),
    m('k3', 'r3', 'knee_flexion', null, null), m('d3', 'r3', 'rep_duration', 1800, 5000),
  ],
  warnings: [],
};

test('a pair yields its own measurements, deltas, and rep-bottom evidence', () => {
  const a = repRow(report, 'r1')!, b = repRow(report, 'r2')!;
  assert.equal(delta(a.knee, b.knee), 10.5);
  assert.equal(delta(a.duration, b.duration), 200);
  const p = buildPacket(report, a, b, '  deeper squat ');
  assert.deepEqual(p.repIds, ['r1', 'r2']);
  assert.deepEqual(p.measurements.map((x) => x.id), ['k1', 'd1', 'k2', 'd2']);
  assert.deepEqual(p.evidence.map((e) => [e.id, e.timestampMs, e.imageName]), [
    ['frame-1000', 1000, 'clip-1000ms.jpg'], ['frame-3000', 3000, 'clip-3000ms.jpg'],
  ]);
  assert.equal(p.goal, 'deeper squat');
  assert.equal(p.charterVersion, CHARTER_VERSION);
  assert.match(p.summary, /r1 and r2: knee flexion at bottom 100\.0° vs 110\.5° \(\+10\.5°\); rep duration 2000 ms vs 2200 ms \(\+200 ms\)/);
  const text = packetText(p);
  assert.match(text, /Magna Carta/);
  assert.match(text, /frame-3000: clip-3000ms\.jpg @ 3000 ms/);
});

test('an unavailable value is excluded from the packet but kept in the comparison', () => {
  const a = repRow(report, 'r1')!, c = repRow(report, 'r3')!;
  assert.equal(delta(a.knee, c.knee), null);
  const p = buildPacket(report, c, a);
  assert.deepEqual(p.measurements.map((x) => x.id), ['d3', 'k1', 'd1']);
  assert.equal(p.goal, undefined);
  assert.match(p.summary, /knee flexion at bottom unavailable vs 100\.0°;/);
  assert.equal(repRow(report, 'nope'), null);
});
