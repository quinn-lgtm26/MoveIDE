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

/** Keep a cited observation readable over its rep, while retaining its source timestamps. */
export function getCoachingSegments(response, packet, report) {
  const timeline = getCoachingTimeline(response, packet);
  const measurements = new Map(report.measurements.map(item => [item.id, item]));
  const frames = new Map(report.frames.map(frame => [frame.timestampMs, frame]));
  const fields = ['id', 'repId', 'metric', 'value', 'unit', 'evidenceTimestampMs'];
  if (packet.protocolVersion !== report.protocol.version || packet.measurements.some(item => {
    const source = measurements.get(item.id);
    return source?.quality !== 'usable' || frames.get(item.evidenceTimestampMs)?.quality !== 'usable'
      || fields.some(field => item[field] !== source[field]);
  })) throw new Error('Coaching does not match this analysis report.');
  const selected = packet.repIds.map(id => report.reps.find(rep => rep.id === id));
  if (selected.some(rep => !rep) || packet.evidence.some(ref =>
    frames.get(ref.timestampMs)?.quality !== 'usable' ||
    (selected.length > 0 && !selected.some(rep => ref.timestampMs >= rep.startMs && ref.timestampMs <= rep.endMs)))) {
    throw new Error('Coaching evidence does not match the selected rep timeline.');
  }
  return selected.map(rep => {
    const markers = timeline.filter(marker => marker.timestampMs >= rep.startMs && marker.timestampMs <= rep.endMs);
    return {
      repId: rep.id, startMs: rep.startMs, endMs: rep.endMs,
      evidenceTimestampsMs: markers.map(marker => marker.timestampMs),
      observationIndices: [...new Set(markers.flatMap(marker => marker.observationIndices))],
      hasNextFocus: markers.some(marker => marker.hasNextFocus),
    };
  }).filter(segment => segment.evidenceTimestampsMs.length > 0).sort((a, b) => a.startMs - b.startMs);
}

export function coachingSegmentAt(segments, timestampMs) {
  if (!Number.isFinite(timestampMs)) return null;
  return segments.find(segment => timestampMs >= segment.startMs && timestampMs <= segment.endMs) ?? null;
}
