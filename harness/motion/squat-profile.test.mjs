import assert from 'node:assert/strict'
import test from 'node:test'
import { getMotionTrace, getSquatProfile } from './analyze.mjs'

const points = {
  start: [[0.4, 0.3], [0.4, 0.4], [0.4, 0.5], [0.4, 0.6], [0.35, 0.65], [0.55, 0.65]],
  bottom: [[0.6, 0.45], [0.4, 0.55], [0.6, 0.55], [0.4, 0.65], [0.35, 0.7], [0.55, 0.7]],
  opening: [[0.4, 0.3], [0.4, 0.4], [0.4, 0.5], [0.6, 0.6], [0.55, 0.65], [0.75, 0.65]],
}

function syntheticReport(side = 'left') {
  const indices = side === 'left' ? [11, 23, 25, 27, 29, 31] : [12, 24, 26, 28, 30, 32]
  const frames = ['start', 'start', 'bottom', 'opening', 'start', 'start'].map((name, index) => {
    const landmarks = Array(33).fill(null)
    points[name].forEach(([x, y], position) => {
      landmarks[indices[position]] = { x: side === 'left' ? x : 1 - x, y, visibility: 1 }
    })
    return { timestampMs: index * 100, landmarks, quality: 'usable' }
  })
  return {
    schemaVersion: 1,
    clip: { id: 'projection-fixture', widthPx: 500, heightPx: 1000, durationMs: 500 },
    protocol: { id: 'squat-side', version: '1.0.0', side },
    poseModel: { id: 'synthetic-fixture', version: '1' },
    frames,
    reps: [{ id: 'rep-1', startMs: 0, bottomMs: 200, endMs: 400 }],
    measurements: [],
    warnings: [],
  }
}

function near(actual, expected) {
  assert(actual !== null && Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`)
}

test('derives projection metrics and preserves their values under a horizontal mirror', () => {
  for (const side of ['left', 'right']) {
    const report = syntheticReport(side)
    const trace = getMotionTrace(report)
    const [start, , bottom, ascent, , outside] = trace
    near(start.ankleClosureChangeDeg, 0)
    near(start.hipDescentLegLengths, 0)
    near(start.hipAboveKneeLegLengths, 0.5)
    near(bottom.hipFlexionDeg, 135)
    near(bottom.shinInclinationDeg, 45)
    near(bottom.ankleClosureChangeDeg, 45)
    near(bottom.hipDescentLegLengths, 0.75)
    near(bottom.hipAboveKneeLegLengths, 0)
    near(ascent.ankleClosureChangeDeg, -45)
    assert.equal(outside.ankleClosureChangeDeg, null)
    assert.equal(outside.hipDescentLegLengths, null)
    assert.equal(outside.hipAboveKneeLegLengths, null)

    const profile = getSquatProfile(report)
    assert.equal(profile.side, side)
    assert.equal(profile.clipId, report.clip.id)
    const [rep] = profile.reps
    assert.equal(rep.descentMs, 200)
    assert.equal(rep.ascentMs, 200)
    assert.deepEqual(rep.evidence, {
      start: { id: 'frame-0ms', timestampMs: 0 },
      bottom: { id: 'frame-200ms', timestampMs: 200 },
      end: { id: 'frame-400ms', timestampMs: 400 },
    })
    near(rep.bottom.hipFlexionDeg, bottom.hipFlexionDeg)
    near(rep.bottom.ankleClosureChangeDeg, bottom.ankleClosureChangeDeg)
  }
})

test('uses null for ankle closure when the current foot or baseline foot is unreliable', () => {
  const report = syntheticReport()
  const bottom = report.frames[2].landmarks
  bottom[29].visibility = 0.49
  bottom[30] = { ...bottom[29], visibility: 1 }
  assert.equal(getSquatProfile(report).reps[0].bottom.ankleClosureChangeDeg, null)
  near(getMotionTrace(report)[2].shinInclinationDeg, 45)

  bottom[29].visibility = 1
  const start = report.frames[0].landmarks
  start[31] = { ...start[29], x: start[29].x + 0.002 }
  assert.equal(getMotionTrace(report)[2].ankleClosureChangeDeg, null)
  near(getSquatProfile(report).reps[0].bottom.hipDescentLegLengths, 0.75)
})

test('retains sample times and yields null angles or source references across gaps', () => {
  const report = syntheticReport()
  report.frames[2].quality = 'unavailable'
  const bottom = getMotionTrace(report)[2]
  assert.equal(bottom.timestampMs, 200)
  assert.equal(bottom.phase, 'bottom')
  const rep = getSquatProfile(report).reps[0]
  assert.equal(rep.evidence.bottom, null)
  assert.equal(rep.descentMs, null)
  assert.equal(rep.ascentMs, null)
  assert(Object.values(rep.bottom).every(value => value === null))
})
