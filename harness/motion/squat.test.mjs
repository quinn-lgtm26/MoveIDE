import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAnalysisReport, kneeFlexion, KNEE_INDICES } from './squat.mjs'

const clip = { id: 'geometry-fixture', widthPx: 500, heightPx: 1000, durationMs: 1600 }
const point = (x, y, visibility = 1) => ({ x, y, visibility })

function sample(timestampMs, angle, hipYPx, visibility = 1) {
  const landmarks = Array(33).fill(null)
  const radians = angle * Math.PI / 180
  const hip = point(0.4 + Math.sin(radians) * 100 / clip.widthPx, hipYPx / clip.heightPx, visibility)
  const kneeYPx = hipYPx + Math.cos(radians) * 100
  const knee = point(0.4, kneeYPx / clip.heightPx, visibility)
  const ankle = point(0.4, (kneeYPx + 100) / clip.heightPx, visibility)
  KNEE_INDICES.left.forEach((index, position) => { landmarks[index] = [hip, knee, ankle][position] })
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

test('anchors a complete rep to a real frame and uses its unsmoothed knee angle', () => {
  const angles = [10, 15, 25, 45, 65, 95, 100, 95, 65, 45, 25, 15, 10]
  const hips = [500, 510, 520, 560, 600, 630, 650, 630, 600, 560, 520, 510, 500]
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
