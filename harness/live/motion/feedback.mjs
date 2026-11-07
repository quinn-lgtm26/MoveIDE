function checkTarget(target) {
  if (target !== null && (!Number.isFinite(target) || target < 30 || target > 150)) {
    throw new RangeError('Choose a projected knee-flexion target between 30 and 150 degrees, or null.');
  }
}

export function completedRepFeedback(report, repId, targetKneeFlexionDeg = null) {
  checkTarget(targetKneeFlexionDeg);
  const rep = report.reps.find(item => item.id === repId);
  const measure = report.measurements.find(item => item.repId === repId && item.metric === 'knee_flexion');
  const frame = report.frames.find(item => item.timestampMs === measure?.evidenceTimestampMs);
  const valid = rep && measure?.quality === 'usable' && Number.isFinite(measure.value)
    && measure.evidenceTimestampMs === rep.bottomMs && frame?.quality === 'usable';
  const value = valid ? measure.value : null;
  const state = !valid || targetKneeFlexionDeg === null ? 'unknown'
    : value >= targetKneeFlexionDeg ? 'target-met' : 'attention';
  return {
    state, targetKneeFlexionDeg, measuredKneeFlexionDeg: value,
    evidenceTimestampMs: valid ? measure.evidenceTimestampMs : null,
    label: !valid ? 'Not enough reliable evidence to compare this rep.'
      : targetKneeFlexionDeg === null ? 'No projected knee-flexion target selected.'
        : `${value.toFixed(1)}° at the rep bottom ${state === 'target-met' ? 'meets' : 'is below'} the chosen ${targetKneeFlexionDeg}° projected knee-flexion target.`,
  };
}

/** Dwell plus release hysteresis prevents a threshold flicker from turning the line green. */
export function createDepthFeedback({ targetKneeFlexionDeg = null, dwellMs = 150, releaseMarginDeg = 5, maxGapMs = 250 } = {}) {
  checkTarget(targetKneeFlexionDeg);
  if (![dwellMs, releaseMarginDeg, maxGapMs].every(value => Number.isFinite(value) && value >= 0)) throw new RangeError('Feedback timings must be nonnegative.');
  let since = null, lastTime = null, met = false;
  return {
    update({ timestampMs, kneeFlexionDeg, quality }) {
      const valid = Number.isFinite(timestampMs) && quality === 'usable' && Number.isFinite(kneeFlexionDeg);
      if (!valid || (lastTime !== null && (timestampMs <= lastTime || timestampMs - lastTime > maxGapMs))) {
        since = null; met = false;
      }
      lastTime = valid ? timestampMs : null;
      if (!valid) return { state: 'unknown', label: 'Tracking unavailable. Reposition the camera.', evidenceTimestampMs: null };
      if (targetKneeFlexionDeg === null) return { state: 'tracking', label: 'Tracking only; no depth target selected.', evidenceTimestampMs: timestampMs };
      if (met && kneeFlexionDeg < targetKneeFlexionDeg - releaseMarginDeg) { met = false; since = null; }
      if (!met) {
        if (kneeFlexionDeg >= targetKneeFlexionDeg) {
          since ??= timestampMs;
          met = timestampMs - since >= dwellMs;
        } else since = null;
      }
      return { state: met ? 'target-met' : 'tracking',
        label: met ? `Chosen ${targetKneeFlexionDeg}° projected knee-flexion target reached.` : 'Tracking movement; assess depth after the rep.',
        evidenceTimestampMs: timestampMs };
    },
  };
}
