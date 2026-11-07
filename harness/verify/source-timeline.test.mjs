import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditSourceTimeline } from './source-timeline.mjs'

const report = times => ({ clip: { widthPx: 810, heightPx: 1440, durationMs: 1000 }, frames: times.map(timestampMs => ({ timestampMs })) })
const probe = times => ({ streams: [{ width: 810, height: 1440, start_time: '0.000000' }], frames: times.map(best_effort_timestamp_time => ({ best_effort_timestamp_time: String(best_effort_timestamp_time) })) })

test('source audit distinguishes a 15 Hz analysis from all 30 Hz source frames', () => {
  const result = auditSourceTimeline(report([0, 67, 133]), probe([0, 1 / 30, 2 / 30, 3 / 30, 4 / 30]))
  assert.equal(result.passed, true)
  assert.equal(result.everySourceTimestampRepresented, false)
  assert.deepEqual(result.omittedSourceFrameIndices, [1, 3])
  assert.equal(result.sourceFrameCoverage, 3 / 5)
})

test('source audit checks variable presentation times rather than inventing a constant cadence', () => {
  const result = auditSourceTimeline(report([0, 42, 115, 201]), probe([0, .041667, .115, .201]))
  assert.equal(result.everySourceTimestampRepresented, true)
  assert.deepEqual(result.matches.map(item => item.sourceFrameIndex), [0, 1, 2, 3])
  assert.equal(auditSourceTimeline(report([0, 67]), probe([0, .041667, .115])).passed, false)
})

test('source audit accepts a last PTS that rounds to the rounded duration', () => {
  const result = auditSourceTimeline(report([0, 1000]), probe([0, .9996]))
  assert.equal(result.everySourceTimestampRepresented, true)
  assert.throws(() => auditSourceTimeline(report([0, 1001]), probe([0, 1.001])), /within the clip/)
})

test('source audit refuses ambiguous timelines and unverified orientation', () => {
  assert.throws(() => auditSourceTimeline(report([0, 0]), probe([0, .067])), /strictly increase/)
  assert.throws(() => auditSourceTimeline(report([0]), probe([0, .0004])), /collide/)
  assert.throws(() => auditSourceTimeline(report([0]), probe([0, 'N/A'])), /strictly increase/)
  const shifted = probe([1, 1.067])
  shifted.streams[0].start_time = '1'
  assert.throws(() => auditSourceTimeline(report([0]), shifted), /zero-origin/)
  const rotated = probe([0, .067])
  rotated.streams[0].side_data_list = [{ rotation: 90 }]
  assert.throws(() => auditSourceTimeline(report([0]), rotated), /orientation/)
})
