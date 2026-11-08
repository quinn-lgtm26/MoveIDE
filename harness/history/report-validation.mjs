/** Storage-boundary validation for AnalysisReport v1, including source-reference consistency.
 * This checks structure and internal references, not whether the model measured the video accurately.
 */
const fields = (value, names) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const text = value => typeof value === 'string' && value.trim().length > 0;
const time = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => Number.isSafeInteger(value) && value > 0;
const quality = value => ['usable', 'unavailable'].includes(value);
export function validateHistoryReport(report) {
  if (!fields(report, ['schemaVersion', 'clip', 'protocol', 'poseModel', 'frames', 'reps', 'measurements', 'warnings']) || report.schemaVersion !== 1 ||
      !fields(report.clip, ['id', 'widthPx', 'heightPx', 'durationMs']) || !text(report.clip.id) || !positive(report.clip.widthPx) || !positive(report.clip.heightPx) || !positive(report.clip.durationMs) ||
      !fields(report.protocol, ['id', 'version', 'side']) || report.protocol.id !== 'squat-side' || !text(report.protocol.version) || !['left', 'right', null].includes(report.protocol.side) ||
      !fields(report.poseModel, ['id', 'version']) || !text(report.poseModel.id) || !text(report.poseModel.version) ||
      !['frames', 'reps', 'measurements', 'warnings'].every(name => Array.isArray(report[name]))) return false;
  const frames = new Map(), reps = new Map(), measurementIds = new Set();
  let lastTime = -1;
  for (const frame of report.frames) {
    if (!fields(frame, ['timestampMs', 'landmarks', 'quality']) || !time(frame.timestampMs) || frame.timestampMs <= lastTime || frame.timestampMs > report.clip.durationMs || !quality(frame.quality) ||
        !Array.isArray(frame.landmarks) || frame.landmarks.length !== 33 || !frame.landmarks.every(point => point === null ||
          (fields(point, ['x', 'y', 'visibility']) && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.visibility) && point.visibility >= 0 && point.visibility <= 1))) return false;
    frames.set(frame.timestampMs, frame); lastTime = frame.timestampMs;
  }
  for (const rep of report.reps) {
    if (!fields(rep, ['id', 'startMs', 'bottomMs', 'endMs']) || !text(rep.id) || reps.has(rep.id) || ![rep.startMs, rep.bottomMs, rep.endMs].every(time) ||
        !(rep.startMs <= rep.bottomMs && rep.bottomMs <= rep.endMs && rep.endMs <= report.clip.durationMs) || ![rep.startMs, rep.bottomMs, rep.endMs].every(timestamp => frames.has(timestamp))) return false;
    reps.set(rep.id, rep);
  }
  for (const metric of report.measurements) {
    if (!fields(metric, ['id', 'repId', 'metric', 'value', 'unit', 'quality', 'evidenceTimestampMs']) || !text(metric.id) || measurementIds.has(metric.id) ||
        !(metric.repId === null || reps.has(metric.repId)) || !quality(metric.quality) || !['knee_flexion', 'torso_lean', 'rep_duration'].includes(metric.metric) ||
        metric.unit !== (metric.metric === 'rep_duration' ? 'ms' : 'deg') || (metric.metric === 'rep_duration' && metric.repId === null)) return false;
    measurementIds.add(metric.id);
    if (metric.quality === 'unavailable') { if (metric.value !== null || metric.evidenceTimestampMs !== null) return false; continue; }
    const frame = frames.get(metric.evidenceTimestampMs), rep = reps.get(metric.repId);
    if (!Number.isFinite(metric.value) || metric.value < 0 || (metric.metric !== 'rep_duration' && metric.value > 180) || !frame ||
        (metric.metric !== 'rep_duration' && frame.quality !== 'usable') || (rep && (metric.evidenceTimestampMs < rep.startMs || metric.evidenceTimestampMs > rep.endMs))) return false;
  }
  return report.warnings.every(warning => fields(warning, ['code', 'message']) && text(warning.code) && text(warning.message));
}
