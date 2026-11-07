/** Experimental diagnostics only. These do not change AnalysisReport v1 or its side-view protocol. */
const SIDES = { left: { shoulder: 11, hip: 23, knee: 25, ankle: 27, oppositeHip: 24 }, right: { shoulder: 12, hip: 24, knee: 26, ankle: 28, oppositeHip: 23 } };
const THRESHOLD = 0.5;
const probability = value => Number.isFinite(value) && value >= 0 && value <= 1;
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const length = vector => Math.hypot(...vector);

function evidence(raw, indices, world = false) {
  const confidence = [];
  for (const index of indices) {
    const image = raw?.normalizedLandmarks?.[index];
    if (!image || ![image.x, image.y].every(Number.isFinite)) return { reason: 'missing_image_landmark' };
    if (image.x < 0 || image.x > 1 || image.y < 0 || image.y > 1) return { reason: 'landmark_out_of_frame' };
    const points = world ? [image, raw?.worldLandmarks?.[index]] : [image];
    if (world && (!points[1] || ![points[1].x, points[1].y, points[1].z].every(Number.isFinite))) return { reason: 'missing_world_landmark' };
    // SDK fields are optional: require measured visibility for this landmark from at
    // least one coordinate output; include every available presence/visibility in the
    // minimum, but never impute missing values as 1. Presence alone is insufficient.
    if (!points.some(point => probability(point.visibility))) return { reason: 'missing_confidence' };
    for (const point of points) for (const value of [point.visibility, point.presence]) {
      if (value === null || value === undefined) continue;
      if (!probability(value)) return { reason: 'missing_confidence' };
      confidence.push(value);
    }
  }
  const minimum = Math.min(...confidence);
  return minimum < THRESHOLD ? { reason: 'low_confidence', confidence: minimum } : { confidence: minimum };
}

/** Declared view is supplied by the caller, never inferred as a validated camera calibration. */
export function analyzeMultiViewFrame(raw, { width, height, view = 'unknown' } = {}) {
  if (!['side', 'front', 'oblique', 'unknown'].includes(view)) throw new RangeError('Choose side, front, oblique or unknown view.');
  const provenance = {
    adapterVersion: 'experimental-multiview-1',
    poseModel: { id: raw?.poseModel?.id ?? null, version: raw?.poseModel?.version ?? null },
    worldCoordinates: 'model-estimated hip-centered XYZ; not calibrated motion capture',
    confidenceBasis: 'minimum available visibility/presence; each landmark requires observed visibility; not measurement accuracy',
  };
  const result = { schemaVersion: 1, experimental: true, timestampMs: Number.isFinite(raw?.timestampMs) ? raw.timestampMs : null, view, provenance, metrics: {} };
  const metric = (unit, value, reason, confidence = null) => ({
    value, unit, status: value === null ? 'unavailable' : 'estimated', reason, confidence, provenance,
  });
  const worldFlexion = indices => {
    if (view === 'unknown') return metric('deg', null, 'unknown_view');
    const checked = evidence(raw, indices, true);
    if (checked.reason) return metric('deg', null, checked.reason, checked.confidence ?? null);
    const [a, vertex, b] = indices.map(index => {
      const point = raw.worldLandmarks[index]; return [point.x, point.y, point.z];
    });
    const first = subtract(a, vertex), second = subtract(b, vertex);
    const firstLength = length(first), secondLength = length(second);
    if (![firstLength, secondLength].every(Number.isFinite) || firstLength <= Number.EPSILON || secondLength <= Number.EPSILON) return metric('deg', null, 'degenerate_world_segment', checked.confidence);
    // Unit-vector dot product avoids scale-dependent magnitude multiplication.
    const cosine = dot(first.map(value => value / firstLength), second.map(value => value / secondLength));
    return metric('deg', 180 - Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI, 'monocular_world_estimate', checked.confidence);
  };
  for (const [side, indices] of Object.entries(SIDES)) {
    result.metrics[`${side}KneeFlexion3d`] = worldFlexion([indices.hip, indices.knee, indices.ankle]);
    result.metrics[`${side}HipFlexion3d`] = worldFlexion([indices.shoulder, indices.hip, indices.knee]);
    const assignOffsets = (value, reason, confidence = null, hipValue = value) => {
      result.metrics[`${side}KneeMedialOffsetLegLengths`] = metric('projected_leg_lengths', value, reason, confidence);
      result.metrics[`${side}KneeMedialOffsetHipSpans`] = metric('projected_hip_spans', hipValue, reason, confidence);
    };
    if (view !== 'front') { assignOffsets(null, view === 'unknown' ? 'unknown_view' : view === 'oblique' ? 'oblique_uncalibrated' : 'front_view_required'); continue; }
    if (![width, height].every(value => Number.isFinite(value) && value > 0)) { assignOffsets(null, 'invalid_frame_dimensions'); continue; }
    const checked = evidence(raw, [indices.hip, indices.knee, indices.ankle, indices.oppositeHip]);
    if (checked.reason) { assignOffsets(null, checked.reason, checked.confidence ?? null); continue; }
    const [hip, knee, ankle, oppositeHip] = [indices.hip, indices.knee, indices.ankle, indices.oppositeHip].map(index => {
      const point = raw.normalizedLandmarks[index]; return [point.x * width, point.y * height];
    });
    const axis = subtract(ankle, hip), hipAxis = subtract(oppositeHip, hip);
    const axisLength = length(axis), hipSpan = length(hipAxis);
    const legLength = length(subtract(knee, hip)) + length(subtract(ankle, knee));
    if (![axisLength, hipSpan, legLength].every(Number.isFinite)) { assignOffsets(null, 'invalid_frame_dimensions'); continue; }
    if (axisLength < 1 || legLength < 1) { assignOffsets(null, 'degenerate_projected_leg', checked.confidence); continue; }
    if (hipSpan < 1 || hipSpan / legLength < 0.05) { assignOffsets(null, 'collapsed_projected_hip_span', checked.confidence); continue; }
    const perpendicular = [-axis[1] / axisLength, axis[0] / axisLength];
    const towardOppositeHip = dot(perpendicular, hipAxis);
    if (Math.abs(towardOppositeHip) / hipSpan < 0.05) { assignOffsets(null, 'ambiguous_medial_direction', checked.confidence); continue; }
    const signedDistance = dot(subtract(knee, hip), perpendicular) * Math.sign(towardOppositeHip);
    assignOffsets(signedDistance / legLength, 'projected_front_proxy', checked.confidence, signedDistance / hipSpan);
  }
  return result;
}
