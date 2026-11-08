import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeRepSamples, createRepReference } from './rep-reference.mjs';
const curve = (down, up, extra = 0) => {
  const rep = { startMs: 0, bottomMs: down, endMs: down + up };
  const samples = Array.from({ length: (down + up) / 100 + 1 }, (_, index) => {
    const timestampMs = index * 100;
    return { timestampMs, kneeFlexionDeg: 20 + 100 * (timestampMs <= down ? timestampMs / down : 1 - (timestampMs - down) / up) + extra };
  });
  return { rep, samples };
};
test('phase alignment adapts independently to descent/return pace without hiding angle differences', () => {
  const a = curve(1000, 1000), b = curve(2000, 3000), c = curve(2000, 3000, 12);
  const first = normalizeRepSamples(a.samples, a.rep), slower = normalizeRepSamples(b.samples, b.rep), deeper = normalizeRepSamples(c.samples, c.rep);
  assert.equal(first.length, 61); assert.equal(first[30].phasePercent, 50);
  first.forEach((point, index) => { assert.ok(Math.abs(point.kneeFlexionDeg - slower[index].kneeFlexionDeg) < 1e-8); assert.ok(Math.abs(deeper[index].kneeFlexionDeg - point.kneeFlexionDeg - 12) < 1e-8); });
  assert.equal(slower[30].timestampMs, 2000); assert.equal(slower[60].timestampMs, 5000);
});
test('missing values, long gaps and missing boundaries never extrapolate into a complete curve', () => {
  const { rep, samples } = curve(1000, 1000);
  samples[5].kneeFlexionDeg = null;
  const points = normalizeRepSamples(samples.filter(point => point.timestampMs < 1300 || point.timestampMs > 1700), rep);
  assert.equal(points[15].kneeFlexionDeg, null); assert.equal(points[45].kneeFlexionDeg, null);
  assert.equal(normalizeRepSamples(samples.slice(1), rep)[0].kneeFlexionDeg, null);
  assert.equal(normalizeRepSamples(samples, { ...rep, bottomMs: 0 }), null);
  const slow = curve(30000,30000); slow.samples[5].kneeFlexionDeg = null;
  const coarse = normalizeRepSamples(slow.samples,slow.rep);
  assert.notEqual(coarse[0].segmentId,coarse[1].segmentId,'A missing source interval between gridpoints must still break rendered segments');
});
test('real fixture adapter uses shared report metrics and refuses mismatched source bounds', async () => {
  const report = JSON.parse(await readFile(new URL('../../results/clear-squat.analysis-report.v1.json', import.meta.url)));
  const event = { key: 'fixture-first', epoch: 0, rep: report.reps[0], report };
  const reference = createRepReference(event);
  assert.equal(reference.points.length, 61);
  const bottom = report.measurements.find(item => item.repId === event.rep.id && item.metric === 'knee_flexion').value;
  assert.ok(Math.abs(reference.points[30].kneeFlexionDeg - bottom) < 1e-8);
  assert.equal(createRepReference({ ...event, rep: { ...event.rep, bottomMs: event.rep.bottomMs + 1 } }), null);
});
