import { ankleOpening, distancePx, hipFlexion, KNEE_INDICES, kneeFlexion, shinInclination, torsoLean, visible } from './geometry.mjs'

const missingMetrics = Object.freeze({
  kneeFlexionDeg: null,
  torsoLeanDeg: null,
  hipFlexionDeg: null,
  shinInclinationDeg: null,
  ankleClosureChangeDeg: null,
  hipDescentLegLengths: null,
  hipAboveKneeLegLengths: null,
})

function startReference(frame, side, { widthPx, heightPx }) {
  if (!side || frame?.quality !== 'usable') return null
  const { landmarks } = frame
  const [hip, knee, ankle] = KNEE_INDICES[side].map(index => landmarks[index])
  if (![hip, knee, ankle].every(visible)) return null
  const thighPx = distancePx(hip, knee, widthPx, heightPx)
  const shinPx = distancePx(knee, ankle, widthPx, heightPx)
  if (thighPx < 1 || shinPx < 1) return null
  return {
    legLengthPx: thighPx + shinPx,
    hipYPx: hip.y * heightPx,
    ankleOpeningDeg: ankleOpening(landmarks, side, widthPx, heightPx),
  }
}

function metricsAt(frame, side, { widthPx, heightPx }, start) {
  if (!side || frame?.quality !== 'usable') return { ...missingMetrics }
  const { landmarks } = frame
  const [hipIndex, kneeIndex] = KNEE_INDICES[side]
  const hip = landmarks[hipIndex]
  const knee = landmarks[kneeIndex]
  const ankleOpeningDeg = start?.ankleOpeningDeg != null ? ankleOpening(landmarks, side, widthPx, heightPx) : null
  return {
    kneeFlexionDeg: kneeFlexion(landmarks, side, widthPx, heightPx),
    torsoLeanDeg: torsoLean(landmarks, side, widthPx, heightPx),
    hipFlexionDeg: hipFlexion(landmarks, side, widthPx, heightPx),
    shinInclinationDeg: shinInclination(landmarks, side, widthPx, heightPx),
    ankleClosureChangeDeg: ankleOpeningDeg === null ? null : start.ankleOpeningDeg - ankleOpeningDeg,
    hipDescentLegLengths: start && visible(hip)
      ? (hip.y * heightPx - start.hipYPx) / start.legLengthPx
      : null,
    hipAboveKneeLegLengths: start && visible(hip) && visible(knee)
      ? (knee.y - hip.y) * heightPx / start.legLengthPx
      : null,
  }
}

function frameReference(frame) {
  if (frame?.quality !== 'usable') return null
  const { timestampMs } = frame
  return { id: `frame-${timestampMs}ms`, timestampMs }
}

/** Local timestamped screen-plane estimates from AnalysisReport v1. */
export function getMotionTrace(report) {
  const { clip, frames, protocol: { side }, reps } = report
  const framesByTime = new Map(frames.map(frame => [frame.timestampMs, frame]))
  const references = new Map(reps.map(rep => [rep.id, startReference(framesByTime.get(rep.startMs), side, clip)]))
  let repIndex = 0
  return frames.map(frame => {
    const { timestampMs } = frame
    while (reps[repIndex]?.endMs < timestampMs) repIndex++
    const candidate = reps[repIndex]
    const rep = candidate && timestampMs >= candidate.startMs ? candidate : null
    let phase = null
    if (rep) phase = timestampMs < rep.bottomMs ? 'descent' : timestampMs === rep.bottomMs ? 'bottom' : 'ascent'
    return {
      timestampMs,
      repId: rep?.id ?? null,
      phase,
      ...metricsAt(frame, side, clip, references.get(rep?.id)),
    }
  })
}

/** Local rep comparisons and the sampled frames that support them. */
export function getSquatProfile(report) {
  const { clip, frames, protocol: { side }, reps } = report
  const framesByTime = new Map(frames.map(frame => [frame.timestampMs, frame]))
  return {
    schemaVersion: 1,
    clipId: clip.id,
    side,
    reps: reps.map(({ id, startMs, bottomMs, endMs }) => {
      const startFrame = framesByTime.get(startMs)
      const bottomFrame = framesByTime.get(bottomMs)
      const start = frameReference(startFrame)
      const bottom = frameReference(bottomFrame)
      const end = frameReference(framesByTime.get(endMs))
      return {
        repId: id,
        startMs,
        bottomMs,
        endMs,
        descentMs: start && bottom ? bottomMs - startMs : null,
        ascentMs: bottom && end ? endMs - bottomMs : null,
        bottom: metricsAt(bottomFrame, side, clip, startReference(startFrame, side, clip)),
        evidence: { start, bottom, end },
      }
    }),
  }
}
