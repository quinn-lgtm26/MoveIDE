/** Preserve local model outputs without treating estimated depth as calibrated 3D. */
export const RAW_POSE_COORDINATES = Object.freeze({
  normalized: 'Image-normalized x/y; z is model-estimated depth relative to hip midpoint, scaled approximately like x.',
  world: 'MediaPipe model-estimated coordinates in meters, with origin at the hip midpoint. Not a calibrated OpenSim coordinate system.',
})

function points(values) {
  return Array.from({ length: 33 }, (_, index) => {
    const point = values?.[index]
    if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return null
    const probability = value => Number.isFinite(value) && value >= 0 && value <= 1 ? value : null
    return { x: point.x, y: point.y, z: point.z,
      visibility: probability(point.visibility), presence: probability(point.presence) }
  })
}

export function rawPoseFrame(timestampMs, result, poseModel) {
  return {
    timestampMs,
    poseModel: { ...poseModel },
    normalizedLandmarks: points(result.landmarks),
    worldLandmarks: points(result.worldLandmarks),
  }
}
