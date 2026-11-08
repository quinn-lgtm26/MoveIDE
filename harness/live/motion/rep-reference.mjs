import { getMotionTrace } from '../../motion/squat-profile.mjs';

/** Align time only: start=0, bottom=50, end=100. Degrees retain their original amplitude.
 * Linear interpolation is allowed only between adjacent valid samples <=250ms apart.
 * Missing samples and long gaps remain null; no extrapolation or phase extrapolation. */
export function normalizeRepSamples(samples, rep) {
  if (!rep || ![rep.startMs, rep.bottomMs, rep.endMs].every(Number.isFinite)
    || rep.startMs < 0 || rep.startMs >= rep.bottomMs || rep.bottomMs >= rep.endMs) return null;
  const selected = samples.filter(sample => sample.timestampMs >= rep.startMs && sample.timestampMs <= rep.endMs);
  if (selected.some((sample, index) => !Number.isFinite(sample.timestampMs) || (index > 0 && sample.timestampMs <= selected[index - 1].timestampMs))) return null;
  const value = sample => Number.isFinite(sample?.kneeFlexionDeg) && sample.kneeFlexionDeg >= 0 && sample.kneeFlexionDeg <= 180 ? sample.kneeFlexionDeg : null;
  let segment = 0;
  const segments = selected.map((sample, index) => {
    if (value(sample) === null) return null;
    if (index === 0 || value(selected[index - 1]) === null || sample.timestampMs - selected[index - 1].timestampMs > 250) segment++;
    return segment;
  });
  let index = 0;
  return Array.from({ length: 61 }, (_, step) => {
    const phasePercent = step * 100 / 60;
    const timestampMs = step <= 30 ? rep.startMs + (rep.bottomMs - rep.startMs) * step / 30
      : rep.bottomMs + (rep.endMs - rep.bottomMs) * (step - 30) / 30;
    while (index < selected.length && selected[index].timestampMs < timestampMs - 1e-6) index++;
    const after = selected[index], before = selected[index - 1];
    let kneeFlexionDeg = null, segmentId = null;
    if (after && Math.abs(after.timestampMs - timestampMs) < 1e-6) { kneeFlexionDeg = value(after); segmentId = segments[index]; }
    else if (before && after && value(before) !== null && value(after) !== null && after.timestampMs - before.timestampMs <= 250) {
      kneeFlexionDeg = value(before) + (value(after) - value(before)) * (timestampMs - before.timestampMs) / (after.timestampMs - before.timestampMs);
      segmentId = segments[index];
    }
    return { phasePercent, timestampMs, kneeFlexionDeg, segmentId };
  });
}

/** Bounded completed-rep diagnostic, derived from the shared metric engine. */
export function createRepReference(event) {
  try {
    const { report, rep, epoch } = event;
    const sourceRep = report.reps.find(item => item.id === rep.id);
    if (!Number.isSafeInteger(epoch) || epoch < 0 || !sourceRep
      || ['startMs', 'bottomMs', 'endMs'].some(key => sourceRep[key] !== rep[key])) return null;
    if (![rep.startMs, rep.bottomMs, rep.endMs].every(time => report.frames.some(frame => frame.timestampMs === time && frame.quality === 'usable'))) return null;
    const points = normalizeRepSamples(getMotionTrace(report), rep);
    // A sparse/unsupported rep may still exist, but cannot establish a useful reference curve.
    if (!points || points[0].kneeFlexionDeg === null || points[30].kneeFlexionDeg === null || points[60].kneeFlexionDeg === null
      || points.filter(point => point.kneeFlexionDeg !== null).length < 41) return null;
    return { key: event.key, epoch, provenance: JSON.stringify([report.protocol, report.poseModel]),
      startMs: rep.startMs, bottomMs: rep.bottomMs, endMs: rep.endMs, points };
  } catch { return null; }
}
