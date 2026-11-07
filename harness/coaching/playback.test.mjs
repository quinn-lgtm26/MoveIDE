import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { coachingMarkerAt, getCoachingTimeline } from './index.mjs';

const packet = JSON.parse(await readFile(new URL('../results/supported-squat.coach-packet.v1.json', import.meta.url)));
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
