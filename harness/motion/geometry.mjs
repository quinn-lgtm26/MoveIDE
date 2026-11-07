export const VISIBILITY_THRESHOLD = 0.5
export const KNEE_INDICES = Object.freeze({
  left: Object.freeze([23, 25, 27]),
  right: Object.freeze([24, 26, 28]),
})
const SHOULDER_INDEX = { left: 11, right: 12 }

export function validLandmark(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    Number.isFinite(point.visibility)
}

export function visible(point) {
  return validLandmark(point) && point.visibility >= VISIBILITY_THRESHOLD &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
}

export function distancePx(a, b, widthPx, heightPx) {
  return Math.hypot((a.x - b.x) * widthPx, (a.y - b.y) * heightPx)
}

export function kneeFlexion(landmarks, side, widthPx, heightPx) {
  const [hip, knee, ankle] = KNEE_INDICES[side].map(index => landmarks[index])
  if (![hip, knee, ankle].every(visible)) return null
  const hipX = (hip.x - knee.x) * widthPx
  const hipY = (hip.y - knee.y) * heightPx
  const ankleX = (ankle.x - knee.x) * widthPx
  const ankleY = (ankle.y - knee.y) * heightPx
  const denominator = Math.hypot(hipX, hipY) * Math.hypot(ankleX, ankleY)
  if (denominator < 1) return null
  const cosine = Math.min(1, Math.max(-1, (hipX * ankleX + hipY * ankleY) / denominator))
  return 180 - Math.acos(cosine) * 180 / Math.PI
}

export function torsoLean(landmarks, side, widthPx, heightPx) {
  const hip = landmarks[KNEE_INDICES[side][0]]
  const shoulder = landmarks[SHOULDER_INDEX[side]]
  if (!visible(hip) || !visible(shoulder)) return null
  const horizontal = Math.abs(shoulder.x - hip.x) * widthPx
  const upward = (hip.y - shoulder.y) * heightPx
  if (Math.hypot(horizontal, upward) < 1) return null
  return Math.atan2(horizontal, upward) * 180 / Math.PI
}

const FOOT_INDICES = { left: [29, 31], right: [30, 32] }
const MIN_PROJECTED_FOOT_AXIS_RATIO = 0.1
const RAD_TO_DEG = 180 / Math.PI

export function hipFlexion(landmarks, side, widthPx, heightPx) {
  const [hipIndex, kneeIndex] = KNEE_INDICES[side]
  const hip = landmarks[hipIndex]
  const knee = landmarks[kneeIndex]
  const shoulder = landmarks[SHOULDER_INDEX[side]]
  if (![hip, knee, shoulder].every(visible)) return null
  const angle = includedAngle(shoulder, hip, knee, hip, widthPx, heightPx)
  return angle === null ? null : 180 - angle
}

export function shinInclination(landmarks, side, widthPx, heightPx) {
  const [, kneeIndex, ankleIndex] = KNEE_INDICES[side]
  const knee = landmarks[kneeIndex]
  const ankle = landmarks[ankleIndex]
  if (![knee, ankle].every(visible)) return null
  const horizontal = Math.abs(knee.x - ankle.x) * widthPx
  const upward = (ankle.y - knee.y) * heightPx
  return Math.hypot(horizontal, upward) < 1 ? null : Math.atan2(horizontal, upward) * RAD_TO_DEG
}

export function ankleOpening(landmarks, side, widthPx, heightPx) {
  const [, kneeIndex, ankleIndex] = KNEE_INDICES[side]
  const [heelIndex, toeIndex] = FOOT_INDICES[side]
  const knee = landmarks[kneeIndex]
  const ankle = landmarks[ankleIndex]
  const heel = landmarks[heelIndex]
  const toe = landmarks[toeIndex]
  if (![knee, ankle, heel, toe].every(visible)) return null
  const shinLength = distancePx(knee, ankle, widthPx, heightPx)
  const footLength = distancePx(heel, toe, widthPx, heightPx)
  if (footLength < MIN_PROJECTED_FOOT_AXIS_RATIO * shinLength) return null
  return includedAngle(knee, ankle, toe, heel, widthPx, heightPx)
}

function includedAngle(a, originA, b, originB, widthPx, heightPx) {
  const ax = (a.x - originA.x) * widthPx
  const ay = (a.y - originA.y) * heightPx
  const bx = (b.x - originB.x) * widthPx
  const by = (b.y - originB.y) * heightPx
  const lengthA = Math.hypot(ax, ay)
  const lengthB = Math.hypot(bx, by)
  if (lengthA < 1 || lengthB < 1) return null
  const cosine = Math.min(1, Math.max(-1, (ax * bx + ay * by) / (lengthA * lengthB)))
  return Math.acos(cosine) * RAD_TO_DEG
}
