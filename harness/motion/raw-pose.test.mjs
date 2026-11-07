import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rawPoseFrame } from './raw-pose.mjs'

test('raw pose preserves estimated depth and optional probabilities without sharing mutable landmarks', () => {
  const point = { x: 1.1, y: -.1, z: -.4, visibility: .7 }
  const model = { id: 'test-model', version: '1' }
  const result = rawPoseFrame(67, { landmarks: [point], worldLandmarks: [{ ...point, z: .2, presence: .9 }] }, model)
  assert.equal(result.normalizedLandmarks.length, 33)
  assert.equal(result.worldLandmarks.length, 33)
  assert.equal(result.normalizedLandmarks[0].x, 1.1)
  assert.equal(result.normalizedLandmarks[0].z, -.4)
  assert.equal(result.normalizedLandmarks[0].presence, null)
  assert.equal(result.worldLandmarks[0].presence, .9)
  result.normalizedLandmarks[0].x = 20
  result.poseModel.id = 'mutated'
  assert.equal(point.x, 1.1)
  assert.equal(model.id, 'test-model')
})

test('raw pose keeps 33 missing slots and refuses nonfinite coordinates without inventing confidence', () => {
  const absent = rawPoseFrame(0, {}, { id: 'test', version: '1' })
  assert(absent.normalizedLandmarks.every(point => point === null))
  assert(absent.worldLandmarks.every(point => point === null))
  const invalid = rawPoseFrame(1, { landmarks: [
    { x: 0, y: 0, z: NaN }, { x: 0, y: 0, z: 0, visibility: 2, presence: -1 },
  ] }, {})
  assert.equal(invalid.normalizedLandmarks[0], null)
  assert.equal(invalid.normalizedLandmarks[1].visibility, null)
  assert.equal(invalid.normalizedLandmarks[1].presence, null)
})
