import assert from 'node:assert/strict'
import { test } from 'node:test'
import { importOpenCapResult, openCapFrameAt, OPENCAP_REVISION, parseOpenSimMotion, sha256 } from './import.mjs'

// Constructed parser fixtures. These are not model inference or accuracy evidence.
const text = `Coordinates\nversion=1\nnRows=2\nnColumns=4\ninDegrees=yes\nendheader\ntime knee_angle_r pelvis_ty custom_coordinate\n0 12 0.9 44\n0.03333333 14 0.89 45\n`
const source = new Blob(['constructed source bytes'])
const scaledModel = new Blob(['constructed model bytes'])
async function input() {
  return {
    motionText: text, source, scaledModel,
    manifest: {
      schemaVersion: 1, engine: 'opencap-monocular', upstreamRevision: OPENCAP_REVISION,
      source: { clipId: 'synthetic-parser-test', durationMs: 1000, sha256: await sha256(source) },
      motionSha256: await sha256(new TextEncoder().encode(text)), scaledModelSha256: await sha256(scaledModel),
      alignment: { method: 'explicit-source-frame-map', rows: [
        { sourceTimestampMs: 300, sourceFrameIndex: 9, motionTimeSeconds: 0 },
        { sourceTimestampMs: 367, sourceFrameIndex: 11, motionTimeSeconds: .03333333 },
      ] },
    },
  }
}

test('imports source-bound rows with explicitly mapped trim/gap timing and separate OpenSim units', async () => {
  const result = await importOpenCapResult(await input())
  assert.equal(result.status, 'imported-unverified')
  assert.equal(result.provenance.alignment, 'producer-declared')
  assert.deepEqual(result.frames.map(frame => frame.timestampMs), [300, 367])
  assert.deepEqual(result.frames.map(frame => frame.values.knee_angle_r), [12, 14])
  assert.deepEqual(result.coordinates, [{ name: 'knee_angle_r', unit: 'deg' }, { name: 'pelvis_ty', unit: 'm' }])
  assert.deepEqual(result.excludedCoordinates, ['custom_coordinate'])
})

test('converts declared rotational radians but preserves meter translation', () => {
  const parsed = parseOpenSimMotion(text.replace('inDegrees=yes', 'inDegrees=no'))
  assert.equal(parsed.coordinates[0].scale, 180 / Math.PI)
  assert.equal(parsed.coordinates[1].scale, 1)
})

test('imported radians are converted once and never applied to meter translation', async () => {
  const data = await input()
  data.motionText = text.replace('inDegrees=yes', 'inDegrees=no').replace('0 12 ', `0 ${Math.PI / 2} `)
  data.manifest.motionSha256 = await sha256(new TextEncoder().encode(data.motionText))
  const result = await importOpenCapResult(data)
  assert.equal(result.frames[0].values.knee_angle_r, 90)
  assert.equal(result.frames[0].values.pelvis_ty, .9)
})

test('rejects mismatched source, motion, and model bytes', async () => {
  for (const replace of [data => { data.source = new Blob(['wrong clip']) },
    data => { data.motionText = text.replace('0 12', '0 13') },
    data => { data.scaledModel = new Blob(['wrong model']) }]) {
    const data = await input()
    replace(data)
    await assert.rejects(importOpenCapResult(data), /hash mismatch/)
  }
})

test('rejects ambiguous, out-of-clip or reordered source mappings and unsupported provenance', async () => {
  for (const change of [
    value => { value.upstreamRevision = 'main' },
    value => { delete value.alignment },
    value => { value.alignment.rows[1].sourceTimestampMs = 300 },
    value => { value.alignment.rows[1].sourceTimestampMs = 1001 },
    value => { value.alignment.rows[1].sourceFrameIndex = 8 },
    value => { value.alignment.rows[1].motionTimeSeconds = .5 },
  ]) {
    const data = await input()
    change(data.manifest)
    await assert.rejects(importOpenCapResult(data), /OpenCap import/)
  }
})

test('rejects malformed counts, unknown units, duplicate coordinates, nonfinite and unordered rows', () => {
  for (const bad of [
    text.replace('nRows=2', 'nRows=3'),
    text.replace('nColumns=4', 'nColumns=5'),
    text.replace('inDegrees=yes', ''),
    text.replace('inDegrees=yes', 'inDegrees=maybe'),
    text.replace('pelvis_ty', 'knee_angle_r'),
    text.replace('0.9', 'NaN'),
    text.replace('0.03333333', '0'),
    text.replace('0.9', '1e999'),
  ]) assert.throws(() => parseOpenSimMotion(bad), /OpenCap import/)
})

test('accepts a final PTS rounded to clip duration but rejects duration plus one millisecond', async () => {
  const data = await input()
  data.manifest.source.durationMs = 367
  assert.equal((await importOpenCapResult(data)).frames.at(-1).timestampMs, 367)
  data.manifest.alignment.rows[1].sourceTimestampMs = 368
  await assert.rejects(importOpenCapResult(data), /source row mapping/)
})

test('accepts full OpenSim coordinate paths without executing or loading external references', () => {
  const parsed = parseOpenSimMotion(text.replace('knee_angle_r', '/jointset/knee_r/knee_angle_r/value'))
  assert.equal(parsed.coordinates[0].name, 'knee_angle_r')
})

test('playback lookup uses source times and refuses missing source indices or extrapolation', async () => {
  const result = await importOpenCapResult(await input())
  assert.equal(openCapFrameAt(result, 300)?.sourceFrameIndex, 9)
  assert.equal(openCapFrameAt(result, 333), null)
  assert.equal(openCapFrameAt(result, 367)?.sourceFrameIndex, 11)
  assert.equal(openCapFrameAt(result, 299), null)
  assert.equal(openCapFrameAt(result, 368), null)
  result.frames[1].sourceFrameIndex = 10
  assert.equal(openCapFrameAt(result, 333)?.sourceFrameIndex, 9)
  assert.equal(openCapFrameAt(result, 333, 10), null)
  assert.equal(openCapFrameAt(result, NaN), null)
})
