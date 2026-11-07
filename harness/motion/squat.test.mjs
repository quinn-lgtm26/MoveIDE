import assert from 'node:assert/strict'
import test from 'node:test'
import { getMotionTrace } from './analyze.mjs'
import { buildAnalysisReport, kneeFlexion, KNEE_INDICES } from './squat.mjs'

const clip = { id: 'geometry-fixture', widthPx: 500, heightPx: 1000, durationMs: 1600 }
const point = (x, y, visibility = 1) => ({ x, y, visibility })
const angles = [10, 15, 25, 45, 65, 95, 100, 95, 65, 45, 25, 15, 10]
const hips = [500, 510, 520, 560, 600, 630, 650, 630, 600, 560, 520, 510, 500]

function sample(timestampMs, angle, hipYPx, visibility = 1, side = 'left') {
  const landmarks = Array(33).fill(null)
  const radians = angle * Math.PI / 180
  const hip = point(0.4 + Math.sin(radians) * 100 / clip.widthPx, hipYPx / clip.heightPx, visibility)
  const kneeYPx = hipYPx + Math.cos(radians) * 100
  const knee = point(0.4, kneeYPx / clip.heightPx, visibility)
  const ankle = point(0.4, (kneeYPx + 100) / clip.heightPx, visibility)
  KNEE_INDICES[side].forEach((index, position) => { landmarks[index] = [hip, knee, ankle][position] })
  return { timestampMs, landmarks }
}

test('computes straight, right and asymmetric pixel-space angles', () => {
  assert.ok(Math.abs(kneeFlexion(sample(0, 0, 500).landmarks, 'left', 500, 1000)) < 1e-10)
  assert.ok(Math.abs(kneeFlexion(sample(0, 90, 500).landmarks, 'left', 500, 1000) - 90) < 1e-10)
  const { landmarks } = sample(0, 0, 500)
  landmarks[23] = point(0.5, 0.5)
  const angle = kneeFlexion(landmarks, 'left', 500, 1000)
  assert.ok(Math.abs(angle - Math.atan(0.5) * 180 / Math.PI) < 1e-10)
})

test('marks an occluded joint unavailable without borrowing the opposite joint', () => {
  const frame = sample(0, 90, 600)
  frame.landmarks[27].visibility = 0.49
  frame.landmarks[28] = point(0.4, 0.7)
  const report = buildAnalysisReport(clip, [frame])
  assert.equal(report.frames[0].quality, 'unavailable')
  assert.equal(report.frames[0].landmarks.length, 33)
  assert.equal(report.measurements[0].quality, 'unavailable')
  assert.equal(report.measurements[0].value, null)
  assert.equal(report.measurements[0].evidenceTimestampMs, null)
  assert.equal(report.protocol.side, null)
})

test('keeps candidate landmarks without publishing an isolated metric from low-coverage tracking', () => {
  const visible = sample(0, 90, 600)
  const report = buildAnalysisReport(clip, [visible, { timestampMs: 100, landmarks: [] }])
  assert.equal(report.frames[0].quality, 'usable')
  assert.deepEqual(report.frames[0].landmarks, visible.landmarks)
  assert.equal(report.measurements[0].quality, 'unavailable')
  assert.equal(report.measurements[0].value, null)
  assert(report.warnings.some(({ code }) => code === 'intermittent_pose'))
})

test('anchors a complete rep to a real frame and uses its unsmoothed knee angle', () => {
  const frames = angles.map((angle, index) => sample(index * 100, angle, hips[index]))
  const report = buildAnalysisReport(clip, frames)
  assert.deepEqual(report.reps, [{ id: 'rep-1', startMs: 200, bottomMs: 600, endMs: 1000 }])
  const [knee, duration] = report.measurements
  assert.ok(Math.abs(knee.value - 100) < 1e-10)
  assert.equal(knee.evidenceTimestampMs, 600)
  assert.equal(duration.value, 800)
  assert.equal(duration.evidenceTimestampMs, 600)
  assert.equal(buildAnalysisReport(clip, frames.slice(3)).reps.length, 0)
  assert.equal(buildAnalysisReport(clip, frames.slice(0, 9)).reps.length, 0)
  const gap = frames.map((frame, index) => index === 7 ? { ...frame, landmarks: [] } : frame)
  assert.equal(buildAnalysisReport(clip, gap).reps.length, 0)
})

test('chooses the continuous right leg over intermittent high-visibility left landmarks', () => {
  const frames = angles.map((angle, index) => {
    const timestamp = index * 100
    const right = sample(timestamp, angle, hips[index], 0.55, 'right')
    if (index >= 8) return right
    const left = sample(timestamp, angle, hips[index])
    KNEE_INDICES.left.forEach(joint => { right.landmarks[joint] = left.landmarks[joint] })
    return right
  })
  const report = buildAnalysisReport(clip, frames)
  assert.equal(report.protocol.side, 'right')
  assert.equal(report.reps.length, 1)
  assert.equal(report.reps[0].bottomMs, 600)
  assert(report.frames.every(frame => frame.quality === 'usable'))
})

test('uses a 7 fps cadence and still breaks a rep across a missing frame', () => {
  const slowClip = { ...clip, durationMs: 1900 }
  const frames = angles.map((angle, index) => sample(Math.round(index * 1000 / 7), angle, hips[index]))
  const report = buildAnalysisReport(slowClip, frames)
  assert.deepEqual(report.reps, [{ id: 'rep-1', startMs: 286, bottomMs: 857, endMs: 1429 }])
  assert.deepEqual(report.warnings, [])

  const gap = frames.map((frame, index) => index === 7 ? { ...frame, landmarks: [] } : frame)
  const gappedReport = buildAnalysisReport(slowClip, gap)
  assert.equal(gappedReport.reps.length, 0)
  assert(gappedReport.warnings.some(({ code }) => code === 'intermittent_pose'))
})

test('measures the same-side torso at the bottom and exposes sampled angles and phases', () => {
  const frames = angles.map((angle, index) => sample(index * 100, angle, hips[index]))
  const bottomFrame = frames[6]
  const hip = bottomFrame.landmarks[23]
  bottomFrame.landmarks[11] = point(hip.x + 0.2, hip.y - 0.1)
  const report = buildAnalysisReport(clip, frames)
  const torso = report.measurements.find(measure => measure.metric === 'torso_lean')
  assert.equal(torso.id, 'rep-1-torso-lean')
  assert.equal(torso.evidenceTimestampMs, 600)
  assert.ok(Math.abs(torso.value - 45) < 1e-10)

  const trace = getMotionTrace(report)
  assert.deepEqual(trace.map(frame => frame.timestampMs), frames.map(frame => frame.timestampMs))
  assert.equal(trace[0].repId, null)
  assert.equal(trace[0].phase, null)
  assert.equal(trace[5].phase, 'descent')
  assert.equal(trace[6].phase, 'bottom')
  assert.equal(trace[6].repId, 'rep-1')
  assert.equal(trace[6].torsoLeanDeg, torso.value)
  assert.ok(Math.abs(trace[6].kneeFlexionDeg - 100) < 1e-10)
  assert.equal(trace[7].phase, 'ascent')
  assert.equal(trace[7].torsoLeanDeg, null)
  assert.equal(trace.at(-1).phase, null)

  bottomFrame.landmarks[12] = bottomFrame.landmarks[11]
  bottomFrame.landmarks[11] = { ...bottomFrame.landmarks[11], visibility: 0.49 }
  const occluded = buildAnalysisReport(clip, frames)
  assert.deepEqual(occluded.measurements.find(measure => measure.metric === 'torso_lean'), {
    id: 'rep-1-torso-lean', repId: 'rep-1', metric: 'torso_lean', value: null,
    unit: 'deg', quality: 'unavailable', evidenceTimestampMs: null,
  })
  assert.equal(getMotionTrace(occluded)[6].torsoLeanDeg, null)
})
