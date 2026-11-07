import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareRecordings } from './compare-recordings.mjs';
import { bindReportSource, reportSourceMatches, sourceBindingStatus } from './source-identity.mjs';

const clear = JSON.parse(await readFile(new URL('../results/clear-squat.analysis-report.v1.json', import.meta.url)));
const supported = JSON.parse(await readFile(new URL('../results/supported-squat.analysis-report.v1.json', import.meta.url)));
function inputs() {
  const a = { report: structuredClone(clear), source: new URL('https://fixtures.example/clear.mp4'), sourceSha256: 'a'.repeat(64) };
  const b = { report: structuredClone(supported), source: new URL('https://fixtures.example/supported.mp4'), sourceSha256: 'b'.repeat(64) };
  bindReportSource(a.report, a.source); bindReportSource(b.report, b.source);
  return [a, b];
}
const row = (result, key) => result.metrics.find(metric => metric.key === key);

test('two saved fixture reports compare independent selected reps and exact source anchors', () => {
  const [a, b] = inputs(); b.repId = 'rep-2';
  const before = JSON.stringify([a.report, b.report]);
  const comparison = compareRecordings(a, b);
  assert.equal(comparison.eligibility.comparable, true);
  assert.equal(comparison.eligibility.identityEvidence, 'different_supplied_sha256');
  assert.equal(comparison.sources[0].sourceBinding, 'live-bound');
  assert.equal(comparison.sources[0].bottomMs, 1067);
  assert.equal(comparison.sources[1].bottomMs, 4333);
  const knee = row(comparison, 'kneeFlexionDeg');
  assert.equal(knee.unit, 'deg');
  assert.equal(knee.a.value, a.report.measurements.find(m => m.repId === 'rep-1' && m.metric === 'knee_flexion').value);
  assert.equal(knee.b.value, b.report.measurements.find(m => m.repId === 'rep-2' && m.metric === 'knee_flexion').value);
  assert.equal(knee.delta, knee.b.value - knee.a.value);
  assert.deepEqual(knee.a.evidenceRefs.map(ref => [ref.sourceSlot, ref.clipId, ref.timestampMs]), [['a', 'clear-squat', 1067]]);
  assert.deepEqual(knee.b.evidenceRefs.map(ref => [ref.sourceSlot, ref.clipId, ref.timestampMs]), [['b', 'supported-squat', 4333]]);
  assert.deepEqual(row(comparison, 'descentMs').b.evidenceRefs.map(ref => ref.timestampMs), [3400, 4333]);
  assert.equal(JSON.stringify([a.report, b.report]), before);
});

test('source binding mismatch withholds misattributed values; imports remain explicitly unverified', () => {
  const [a, b] = inputs(); a.source = new URL('https://fixtures.example/not-the-analyzed-file.mp4');
  let result = compareRecordings(a, b);
  assert.equal(result.eligibility.reason, 'source_mismatch');
  assert.equal(result.sources[0].sourceBinding, 'mismatch');
  assert.ok(result.metrics.every(metric => metric.a.value === null && metric.delta === null));
  a.report = structuredClone(clear);
  result = compareRecordings(a, b);
  assert.equal(result.sources[0].sourceBinding, 'unverified-import');
  assert.ok(result.cautions.some(message => message.includes('caller-supplied and unverified')));
  assert.equal(sourceBindingStatus(a.report), 'unverified-import');
  assert.equal(reportSourceMatches(a.report, b.source), true, 'Existing imported-report matching semantics are unchanged');
  bindReportSource(a.report, a.source);
  assert.equal(sourceBindingStatus(a.report), 'live-bound');
  assert.equal(reportSourceMatches(a.report, b.source), false);
});

test('duplicate URL, Blob object, supplied content hash or reused report cannot masquerade as two recordings', () => {
  const [a, b] = inputs();
  b.source = new URL(a.source); bindReportSource(b.report, b.source);
  assert.equal(compareRecordings(a, b).eligibility.reason, 'duplicate_source');
  const [c, d] = inputs(); d.sourceSha256 = c.sourceSha256;
  assert.equal(compareRecordings(c, d).eligibility.identityEvidence, 'same_supplied_sha256');
  assert.ok(compareRecordings(c, d).metrics.every(metric => metric.delta === null));
  const blob = new Blob(['same video bytes']); c.source = blob; d.source = blob;
  bindReportSource(c.report, blob); bindReportSource(d.report, blob);
  assert.equal(compareRecordings(c, d).eligibility.reason, 'duplicate_source');
  const imported = structuredClone(clear);
  assert.equal(compareRecordings({ report: imported, source: 'https://fixtures.example/a.mp4' }, { report: imported, source: 'https://fixtures.example/b.mp4' }).eligibility.reason, 'same_report');
  const [e, f] = inputs(); delete e.sourceSha256; delete f.sourceSha256;
  assert.equal(compareRecordings(e, f).eligibility.identityEvidence, 'different_references_bytes_unchecked');
});

test('explicit unavailable measurements and missing tracking remain null, never zero or bad-form scores', () => {
  const [a, b] = inputs();
  Object.assign(a.report.measurements.find(m => m.repId === 'rep-1' && m.metric === 'knee_flexion'), { quality: 'unavailable', value: null, evidenceTimestampMs: null });
  let result = compareRecordings(a, b);
  assert.equal(row(result, 'kneeFlexionDeg').a.value, null);
  assert.equal(row(result, 'kneeFlexionDeg').a.reason, 'measurement_unavailable');
  assert.equal(row(result, 'kneeFlexionDeg').delta, null);
  assert.notEqual(row(result, 'torsoLeanDeg').delta, null);
  a.report.frames.find(frame => frame.timestampMs === a.report.reps[0].bottomMs).quality = 'unavailable';
  result = compareRecordings(a, b);
  assert.equal(result.sources[0].anchors.bottom, null);
  assert.ok(result.metrics.every(metric => metric.a.value === null && metric.a.evidenceRefs.length === 0 && metric.delta === null));
  assert.equal(result.eligibility.comparable, false);
  assert.equal(Object.hasOwn(result, 'score'), false);
  assert.ok(result.cautions.some(message => message.includes('not good/bad form scores')));
});

test('missing start evidence affects start-relative metrics, not independently visible bottom measurements', () => {
  const [a, b] = inputs();
  a.report.frames = a.report.frames.filter(frame => frame.timestampMs !== a.report.reps[0].startMs);
  const result = compareRecordings(a, b);
  assert.equal(row(result, 'hipDescentLegLengths').a.value, null);
  assert.equal(row(result, 'ankleClosureChangeDeg').a.value, null);
  assert.equal(row(result, 'descentMs').a.value, null);
  assert.notEqual(row(result, 'kneeFlexionDeg').a.value, null);
  assert.notEqual(row(result, 'ascentMs').a.value, null);
});

test('malformed stored angles and durations cannot generate nonsensical deltas', () => {
  const [a, b] = inputs();
  a.report.measurements.find(m => m.repId === 'rep-1' && m.metric === 'knee_flexion').value = 1e308;
  a.report.measurements.find(m => m.repId === 'rep-1' && m.metric === 'rep_duration').value = 1;
  const result = compareRecordings(a, b);
  for (const key of ['kneeFlexionDeg', 'repDurationMs']) {
    assert.equal(row(result, key).a.reason, 'invalid_measurement');
    assert.equal(row(result, key).delta, null);
  }
});

test('model/protocol mismatch and absent complete reps withhold deltas with explicit reasons', () => {
  const [a, b] = inputs(); b.report.poseModel.id = 'mediapipe-pose-landmarker-full';
  let result = compareRecordings(a, b);
  assert.equal(result.eligibility.reason, 'model_mismatch');
  assert.notEqual(row(result, 'kneeFlexionDeg').b.value, null);
  assert.ok(result.metrics.every(metric => metric.delta === null));
  b.report.protocol.version = 'different-definition';
  assert.equal(compareRecordings(a, b).eligibility.reason, 'protocol_mismatch');
  b.report.reps = []; b.report.measurements = [];
  assert.equal(compareRecordings(a, b).eligibility.reason, 'no_complete_rep');
  b.repId = 'rep-9';
  assert.equal(compareRecordings(a, b).sources[1].selectionReason, 'rep_not_found');
});
