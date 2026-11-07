import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildCoachPacket, coachingMarkerAt, getCoachingTimeline, coachingSegmentAt, getCoachingSegments } from './index.mjs';

const packet = JSON.parse(await readFile(new URL('../results/supported-squat.coach-packet.v1.json', import.meta.url)));
const report = JSON.parse(await readFile(new URL('../results/supported-squat.analysis-report.v1.json', import.meta.url)));
const [first, second] = packet.evidence;
const response = {
  observations: [
    { text: 'Compare both bottoms.', evidenceIds: [first.id, second.id, packet.measurements[0].id] },
    { text: 'Inspect the second bottom.', evidenceIds: [second.id] },
  ],
  uncertainty: 'The two frames show projected positions.',
  nextFocus: { text: 'Repeat the chosen movement.', evidenceIds: [first.id] },
};

test('playback maps approved observations and focus to unique ordered source timestamps', () => {
  const timeline = getCoachingTimeline(response, packet);
  assert.deepEqual(timeline, [
    { timestampMs: first.timestampMs, observationIndices: [0], hasNextFocus: true },
    { timestampMs: second.timestampMs, observationIndices: [0, 1], hasNextFocus: false },
  ]);
  assert.equal(coachingMarkerAt(timeline, first.timestampMs + 75), timeline[0]);
  assert.equal(coachingMarkerAt(timeline, first.timestampMs + 151), null);
  assert.equal(coachingMarkerAt(timeline, second.timestampMs), timeline[1]);
});

test('playback rejects unknown evidence before building a timeline', () => {
  const invalid = { ...response, nextFocus: { ...response.nextFocus, evidenceIds: ['other-clip'] } };
  assert.throws(() => getCoachingTimeline(invalid, packet), { code: 'invalid_response' });
});

test('rep cues persist beyond the brief evidence window and retain their source anchors', () => {
  const segments = getCoachingSegments(response, packet, report);
  assert.equal(segments.length, 2);
  assert.equal(coachingSegmentAt(segments, report.reps[0].startMs), segments[0]);
  assert.equal(coachingSegmentAt(segments, report.reps[0].endMs), segments[0]);
  assert.deepEqual(segments[0].evidenceTimestampsMs, [first.timestampMs]);
  assert.deepEqual(segments[1].observationIndices, [0, 1]);
  assert.equal(coachingSegmentAt(segments, report.reps[1].endMs + 1), null);
  assert.equal(coachingSegmentAt(segments, NaN), null);
});

test('rep cues refuse a packet whose values or source-frame availability changed', () => {
  const wrong = structuredClone(report);
  wrong.measurements[0].value += 1;
  assert.throws(() => getCoachingSegments(response, packet, wrong), /does not match/);
  const missing = structuredClone(report);
  missing.frames.find(frame => frame.timestampMs === first.timestampMs).quality = 'unavailable';
  assert.throws(() => getCoachingSegments(response, packet, missing), /does not match/);
  const imageFree = { ...packet, evidence: [] };
  const cited = { text: 'Inspect this measurement.', evidenceIds: [packet.measurements[0].id] };
  assert.throws(() => getCoachingSegments({ observations: [cited], uncertainty: 'Limited evidence.', nextFocus: cited }, imageFree, missing), /does not match/);
});

test('a valid single-frame interpretation can render without inventing a rep segment', () => {
  const single = structuredClone(report);
  single.reps = [];
  single.measurements = [{ ...single.measurements.find(item => item.metric === 'knee_flexion'), repId: null }];
  const approved = buildCoachPacket(single);
  const cited = { text: 'Inspect this frame.', evidenceIds: [approved.measurements[0].id] };
  assert.deepEqual(getCoachingSegments({ observations: [cited], uncertainty: 'No complete rep.', nextFocus: cited }, approved, single), []);
});
