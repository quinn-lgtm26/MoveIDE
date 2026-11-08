import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateHistoryReport } from './report-validation.mjs';
const fixture = JSON.parse(await readFile(new URL('../results/clear-squat.analysis-report.v1.json', import.meta.url)));
test('both saved Heavy reports and Full baselines satisfy history validation', async () => {
  for (const file of ['clear-squat', 'supported-squat', 'full-baseline/clear-squat', 'full-baseline/supported-squat']) {
    const report = JSON.parse(await readFile(new URL(`../results/${file}.analysis-report.v1.json`, import.meta.url)));
    assert.equal(validateHistoryReport(report), true, file);
  }
});
test('malformed reports and unresolved source references cannot enter replay', () => {
  assert.equal(validateHistoryReport({schemaVersion:1}),false);
  for (const mutate of [
    report => {report.frames[1].timestampMs=report.frames[0].timestampMs;},
    report => {report.reps[0].bottomMs=report.clip.durationMs+1;},
    report => {report.measurements[0].repId='another-recording-rep';},
    report => {report.measurements[0].evidenceTimestampMs=1;},
    report => {report.measurements[0].quality='unavailable';},
    report => {report.measurements[0].value=181;},
    report => {report.frames[0].landmarks[0].visibility=1.1;},
  ]) {
    const report=structuredClone(fixture);mutate(report);assert.equal(validateHistoryReport(report),false);
  }
});
test('unavailable measurements preserve null values and missing pose landmarks', () => {
  const report=structuredClone(fixture);
  report.measurements[0]={...report.measurements[0],quality:'unavailable',value:null,evidenceTimestampMs:null};
  report.frames[0]={...report.frames[0],quality:'unavailable',landmarks:Array(33).fill(null)};
  assert.equal(validateHistoryReport(report),true);
});
