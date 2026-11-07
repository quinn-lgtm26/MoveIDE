import { POSE_MODEL } from './pose-model.mjs'

import { distancePx, KNEE_INDICES, kneeFlexion, torsoLean, validLandmark, visible } from './geometry.mjs'

export { KNEE_INDICES, kneeFlexion, VISIBILITY_THRESHOLD } from './geometry.mjs'
export const SQUAT_PROTOCOL = Object.freeze({ id: 'squat-side', version: '1.0.0' })

const UPRIGHT_FLEXION = 30
const DESCENT_FLEXION = 45
const BOTTOM_FLEXION = 60
const DEFAULT_EVIDENCE_GAP_MS = 140
const MAX_SLOW_SOURCE_GAP_MS = 200
const CADENCE_JITTER_FACTOR = 1.15
const MIN_REP_DURATION_MS = 500
const MIN_TRACKING_COVERAGE = 0.75

function legSample({ timestampMs, landmarks }, side, { widthPx, heightPx }) {
  const angle = kneeFlexion(landmarks, side, widthPx, heightPx)
  if (angle === null || angle > 150) return null
  const [hip, knee, ankle] = KNEE_INDICES[side].map(index => landmarks[index])
  const thigh = distancePx(hip, knee, widthPx, heightPx)
  const shin = distancePx(knee, ankle, widthPx, heightPx)
  // Gross length imbalances indicate foreshortening or a displaced landmark.
  const ratio = thigh / shin
  if (ratio < 0.5 || ratio > 2) return null
  return {
    timestampMs,
    angle,
    hipYPx: hip.y * heightPx,
    legLengthPx: thigh + shin,
    visibility: Math.min(hip.visibility, knee.visibility, ankle.visibility),
  }
}

function median(values) {
  const ordered = values.toSorted((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return (ordered[Math.floor((ordered.length - 1) / 2)] + ordered[middle]) / 2
}

function isFrontal(samples, { widthPx, heightPx }) {
  const torsoRatios = []
  for (const { landmarks } of samples) {
    const [leftShoulder, rightShoulder, leftHip, rightHip] = [11, 12, 23, 24].map(index => landmarks[index])
    if (![leftShoulder, rightShoulder, leftHip, rightHip].every(visible)) continue
    const distance = (a, b) => distancePx(a, b, widthPx, heightPx)
    const breadth = distance(leftShoulder, rightShoulder) + distance(leftHip, rightHip)
    const length = distance(leftShoulder, leftHip) + distance(rightShoulder, rightHip)
    if (length >= 1) torsoRatios.push(breadth / length)
  }
  // This is capture guidance for clearly non-side framing, based on projected
  // torso breadth across the clip. It cannot verify camera angle.
  return torsoRatios.length >= Math.max(3, samples.length / 2) && median(torsoRatios) > 0.54
}

function selectSide(left, right) {
  const leftEvidence = left.filter(Boolean)
  const rightEvidence = right.filter(Boolean)
  if (leftEvidence.length === 0 && rightEvidence.length === 0) return null
  if (leftEvidence.length !== rightEvidence.length) {
    return leftEvidence.length > rightEvidence.length ? 'left' : 'right'
  }
  const visibility = samples => samples.reduce((score, sample) => score + sample.visibility, 0)
  return visibility(leftEvidence) >= visibility(rightEvidence) ? 'left' : 'right'
}

function evidenceWindows(samples) {
  const intervals = samples.slice(1).map((sample, index) => sample.timestampMs - samples[index].timestampMs)
  const typicalInterval = intervals.length ? median(intervals) : 0
  // Keep the regular gap tolerance, and allow one ordinary frame interval
  // on slower clips without treating a missing low-rate frame as evidence.
  const cadenceGapMs = Math.min(MAX_SLOW_SOURCE_GAP_MS, Math.ceil(typicalInterval * CADENCE_JITTER_FACTOR))
  return {
    gapMs: Math.max(DEFAULT_EVIDENCE_GAP_MS, cadenceGapMs),
    smoothingSpanMs: Math.max(DEFAULT_EVIDENCE_GAP_MS, 2 * cadenceGapMs),
  }
}

function smoothedSamples(samples, { gapMs, smoothingSpanMs }) {
  return samples.map((sample, index) => {
    const before = samples[index - 1]
    const after = samples[index + 1]
    if (!sample || !before || !after || after.timestampMs - before.timestampMs > smoothingSpanMs ||
        sample.timestampMs - before.timestampMs > gapMs || after.timestampMs - sample.timestampMs > gapMs) return sample
    return {
      ...sample,
      phaseAngle: median([before.angle, sample.angle, after.angle]),
      phaseHipYPx: median([before.hipYPx, sample.hipYPx, after.hipYPx]),
    }
  })
}

function detectReps(samples, windows) {
  const reps = []
  let standing
  let bottom
  let previous

  for (const sample of smoothedSamples(samples, windows).filter(Boolean)) {
    if (previous && sample.timestampMs - previous.timestampMs > windows.gapMs) {
      standing = undefined
      bottom = undefined
    }
    previous = sample
    const angle = sample.phaseAngle ?? sample.angle
    const hipYPx = sample.phaseHipYPx ?? sample.hipYPx
    if (angle <= UPRIGHT_FLEXION) {
      if (standing && bottom && sample.timestampMs - standing.timestampMs >= MIN_REP_DURATION_MS) {
        reps.push({
          id: `rep-${reps.length + 1}`,
          startMs: standing.timestampMs,
          bottomMs: bottom.timestampMs,
          endMs: sample.timestampMs,
        })
      }
      standing = sample
      bottom = undefined
    } else if (standing && angle >= DESCENT_FLEXION && sample.angle >= BOTTOM_FLEXION) {
      const hipDrop = hipYPx - (standing.phaseHipYPx ?? standing.hipYPx)
      const lowestHip = bottom ? bottom.phaseHipYPx ?? bottom.hipYPx : -Infinity
      // A knee-angle excursion needs a corresponding downward hip movement.
      if (hipDrop >= 0.15 * standing.legLengthPx &&
          (hipYPx > lowestHip || (hipYPx === lowestHip && sample.hipYPx > bottom.hipYPx))) {
        bottom = sample
      }
    }
  }
  return reps
}

function kneeMeasurement(id, repId, evidence) {
  return {
    id,
    repId,
    metric: 'knee_flexion',
    value: evidence?.angle ?? null,
    unit: 'deg',
    quality: evidence ? 'usable' : 'unavailable',
    evidenceTimestampMs: evidence?.timestampMs ?? null,
  }
}

export function buildAnalysisReport(clip, samples, poseModel = POSE_MODEL) {
  const frontal = isFrontal(samples, clip)
  const left = samples.map(sample => legSample(sample, 'left', clip))
  const right = samples.map(sample => legSample(sample, 'right', clip))
  const side = frontal ? null : selectSide(left, right)
  const tracked = side ? (side === 'left' ? left : right) : []
  const evidence = tracked.filter(Boolean)
  const frames = samples.map(({ timestampMs, landmarks }, index) => ({
    timestampMs,
    landmarks: Array.from({ length: 33 }, (_, landmarkIndex) => {
      const point = landmarks[landmarkIndex]
      return validLandmark(point)
        ? { x: point.x, y: point.y, visibility: Math.max(0, Math.min(1, point.visibility)) }
        : null
    }),
    quality: tracked[index] ? 'usable' : 'unavailable',
  }))
  const stableTracking = evidence.length > 0 && evidence.length >= samples.length * MIN_TRACKING_COVERAGE
  const windows = evidenceWindows(samples)
  const reps = stableTracking ? detectReps(tracked, windows) : []
  const evidenceByTime = new Map(evidence.map(sample => [sample.timestampMs, sample]))
  const framesByTime = new Map(frames.map(frame => [frame.timestampMs, frame]))
  const measurements = reps.flatMap(rep => {
    const bottomFrame = framesByTime.get(rep.bottomMs)
    const torsoLeanDeg = torsoLean(bottomFrame.landmarks, side, clip.widthPx, clip.heightPx)
    return [
      kneeMeasurement(`${rep.id}-knee-flexion`, rep.id, evidenceByTime.get(rep.bottomMs)),
      {
        id: `${rep.id}-duration`,
        repId: rep.id,
        metric: 'rep_duration',
        value: rep.endMs - rep.startMs,
        unit: 'ms',
        quality: 'usable',
        evidenceTimestampMs: rep.bottomMs,
      },
      {
        id: `${rep.id}-torso-lean`,
        repId: rep.id,
        metric: 'torso_lean',
        value: torsoLeanDeg,
        unit: 'deg',
        quality: torsoLeanDeg === null ? 'unavailable' : 'usable',
        evidenceTimestampMs: torsoLeanDeg === null ? null : rep.bottomMs,
      },
    ]
  })
  if (measurements.length === 0) {
    measurements.push(kneeMeasurement('knee-flexion', null, stableTracking ? evidence[0] : null))
  }
  const warnings = []
  if (frontal) {
    warnings.push({
      code: 'unsupported_framing',
      message: 'The torso appears front-facing or oblique. Record from the side for knee flexion estimates.',
    })
  } else if (evidence.length === 0) {
    warnings.push({
      code: 'pose_unavailable',
      message: 'Keep the whole lifter in frame with a clear side view and the hip, knee, and ankle visible.',
    })
  } else if (!stableTracking || evidence.some((sample, index) =>
    index > 0 && sample.timestampMs - evidence[index - 1].timestampMs > windows.gapMs)) {
    warnings.push({
      code: 'intermittent_pose',
      message: 'Some poses could not be tracked reliably. Improve lighting and keep the lifter clear of obstructions.',
    })
  }
  if (reps.length === 0) {
    warnings.push({
      code: 'no_complete_reps',
      message: 'Record a full squat from standing, through the bottom, and back to standing.',
    })
  }
  return {
    schemaVersion: 1,
    clip,
    protocol: { ...SQUAT_PROTOCOL, side },
    poseModel,
    frames,
    reps,
    measurements,
    warnings,
  }
}
