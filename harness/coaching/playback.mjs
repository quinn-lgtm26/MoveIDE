import { validateCoachingResponse } from './packet.mjs';

/** Resolve a completed response to the timestamps from the exact approved packet. */
export function getCoachingTimeline(response, packet) {
  validateCoachingResponse(response, packet);
  const times = new Map([
    ...packet.measurements.map(({ id, evidenceTimestampMs }) => [id, evidenceTimestampMs]),
    ...packet.evidence.map(({ id, timestampMs }) => [id, timestampMs]),
  ]);
  const markers = new Map();

  function markerAt(timestampMs) {
    if (!markers.has(timestampMs)) markers.set(timestampMs, { timestampMs, observationIndices: [], hasNextFocus: false });
    return markers.get(timestampMs);
  }

  function evidenceTimes(evidenceIds) {
    return new Set(evidenceIds.map((id) => times.get(id)));
  }

  response.observations.forEach(({ evidenceIds }, index) => {
    for (const time of evidenceTimes(evidenceIds)) markerAt(time).observationIndices.push(index);
  });
  for (const time of evidenceTimes(response.nextFocus.evidenceIds)) markerAt(time).hasNextFocus = true;
  return [...markers.values()].sort((a, b) => a.timestampMs - b.timestampMs);
}

/** Replaying a clip selects a stored cue; it never requests inference. */
export function coachingMarkerAt(timeline, timestampMs, windowMs = 150) {
  if (!Number.isFinite(timestampMs) || !Number.isFinite(windowMs) || windowMs < 0) return null;
  let nearest = null;
  let delta = Infinity;
  for (const marker of timeline) {
    const candidate = Math.abs(marker.timestampMs - timestampMs);
    if (candidate <= windowMs && candidate < delta) {
      nearest = marker;
      delta = candidate;
    }
  }
  return nearest;
}
