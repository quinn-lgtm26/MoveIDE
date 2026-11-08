const ANCHORS = [11, 12, 23, 24]; // shoulders + hips; waving hands must not imply camera movement
const SWAPPED = [1, 0, 3, 2];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Prototype continuity heuristic on normalized image landmarks, NOT camera-motion or view estimation.
 * `stable` means no configured abrupt geometry break within the dwell; it cannot prove a fixed camera,
 * identify front/side, distinguish athlete motion from camera motion, or recover 3D biomechanics.
 *
 * Every epoch change invalidates relative baselines. Callers must clear front/side-specific baselines,
 * decline cross-epoch comparisons, and establish new baselines only after stable + independently
 * eligible framing. Explicitly reset on a source/session/protocol/front/side change even if geometry
 * happens to look similar. No integration with measurements or live session state is performed here.
 */
export function createViewGuard({
  stableForMs = 500, maxGapMs = 250, minVisibility = .5,
  // Clean side-view squats swing projected torso length up to ~1.6x per frame (hip landmark at depth); angles are scale-invariant.
  translationJump = .1, scaleRatioJump = 1.75, jointJump = .16,
  identityFlipRatio = .55, minSideSeparation = .015, minTorsoScale = .015,
  cadenceAware = true, maxCadenceGapMs = 1000,
} = {}) {
  if (![stableForMs, maxGapMs].every(value => Number.isFinite(value) && value > 0) ||
      !Number.isFinite(minVisibility) || minVisibility < 0 || minVisibility > 1 ||
      ![translationJump, jointJump, minSideSeparation, minTorsoScale].every(value => Number.isFinite(value) && value > 0 && value <= 1) ||
      !Number.isFinite(scaleRatioJump) || scaleRatioJump <= 1 ||
      !Number.isFinite(identityFlipRatio) || identityFlipRatio <= 0 || identityFlipRatio >= 1 ||
      typeof cadenceAware !== 'boolean' || !Number.isFinite(maxCadenceGapMs) || maxCadenceGapMs < maxGapMs || maxCadenceGapMs > 2000) {
    throw new RangeError('Invalid view-guard dwell, visibility or geometry threshold.');
  }
  let epoch = 0, state = 'unavailable', reason = 'initializing';
  let previous = null, stableSince = null, lastInputTime = null, reacquireReason = 'initializing';
  let observations = 0; const cadence = [];
  const snapshot = () => ({ state, reason, epoch });
  const unavailable = why => {
    if (state !== 'unavailable') epoch++;
    state = 'unavailable'; reason = why; previous = null; stableSince = null;
    cadence.length = 0; observations = 0;
    reacquireReason = 'tracking-restored';
    return snapshot();
  };
  const begin = (current, why, advanceEpoch) => {
    if (advanceEpoch) epoch++;
    previous = current; stableSince = current.timestampMs;
    observations = 1;
    state = 'reacquiring'; reason = why; reacquireReason = why;
    return snapshot();
  };
  const geometry = ({ landmarks, widthPx, heightPx, timestampMs }) => {
    if (!Array.isArray(landmarks) || landmarks.length !== 33) return null;
    const selected = ANCHORS.map(index => landmarks[index]);
    if (!selected.every(point => point && [point.x, point.y, point.visibility].every(Number.isFinite)
        && point.visibility >= minVisibility && point.visibility <= 1 && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)) return null;
    const diagonal = Math.hypot(widthPx, heightPx);
    const points = selected.map(point => ({ x: point.x * widthPx / diagonal, y: point.y * heightPx / diagonal }));
    const scale = (distance(points[0], points[2]) + distance(points[1], points[3])) / 2;
    if (scale < minTorsoScale) return null;
    return { timestampMs, widthPx, heightPx, points, scale,
      center: { x: mean(points.map(point => point.x)), y: mean(points.map(point => point.y)) },
      sideSeparation: (distance(points[0], points[1]) + distance(points[2], points[3])) / 2 };
  };
  return {
    update(sample) {
      if (!sample || !Number.isFinite(sample.timestampMs) || sample.timestampMs < 0 ||
          !Number.isFinite(sample.widthPx) || sample.widthPx <= 0 || !Number.isFinite(sample.heightPx) || sample.heightPx <= 0) {
        lastInputTime = null;
        return unavailable('invalid-frame');
      }
      const backwards = lastInputTime !== null && sample.timestampMs <= lastInputTime;
      lastInputTime = sample.timestampMs;
      if (backwards) return unavailable('non-monotonic-time');
      const current = geometry(sample);
      if (!current) return unavailable('tracking-unavailable');
      if (!previous) return begin(current, reacquireReason, false);
      if (current.widthPx !== previous.widthPx || current.heightPx !== previous.heightPx) return begin(current, 'image-size-changed', true);
      const interval = current.timestampMs - previous.timestampMs;
      const sorted = [...cadence].sort((a, b) => a - b);
      const typical = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
      const allowedGap = cadenceAware ? Math.max(maxGapMs, Math.min(maxCadenceGapMs, typical * 1.5)) : maxGapMs;
      cadence.push(interval); if (cadence.length > 8) cadence.shift();
      if (interval > allowedGap) return begin(current, 'tracking-gap', true);
      const same = mean(current.points.map((point, index) => distance(point, previous.points[index])));
      const swapped = mean(current.points.map((point, index) => distance(point, previous.points[SWAPPED[index]])));
      if (Math.min(current.sideSeparation, previous.sideSeparation) >= minSideSeparation && same >= minSideSeparation && swapped < same * identityFlipRatio) {
        return begin(current, 'landmark-identity-change', true);
      }
      if (distance(current.center, previous.center) > translationJump) return begin(current, 'abrupt-translation', true);
      if (Math.max(current.scale / previous.scale, previous.scale / current.scale) > scaleRatioJump) return begin(current, 'abrupt-scale-change', true);
      if (current.points.some((point, index) => distance(point, previous.points[index]) > jointJump)) return begin(current, 'abrupt-joint-jump', true);
      previous = current;
      observations++;
      state = observations >= 3 && current.timestampMs - stableSince >= stableForMs ? 'stable' : 'reacquiring';
      reason = state === 'stable' ? 'stable-window' : reacquireReason;
      return snapshot();
    },
    reset() {
      epoch++; state = 'reacquiring'; reason = 'manual-reset'; reacquireReason = reason;
      previous = null; stableSince = null; lastInputTime = null;
      cadence.length = 0; observations = 0;
      return snapshot();
    },
  };
}
