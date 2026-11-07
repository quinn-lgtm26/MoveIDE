import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMultiViewFrame } from './multiview.mjs';

const point = (x, y, z = 0) => ({ x, y, z, visibility: .95, presence: .9 });
function fixture() {
  const normalizedLandmarks = Array(33).fill(null), worldLandmarks = Array(33).fill(null);
  for (const [shoulder, hip, knee, ankle, x, kneeX, worldOffset] of [[11, 23, 25, 27, .65, .6, 0], [12, 24, 26, 28, .35, .4, 2]]) {
    normalizedLandmarks[shoulder] = point(x, .1); normalizedLandmarks[hip] = point(x, .2);
    normalizedLandmarks[knee] = point(kneeX, .5); normalizedLandmarks[ankle] = point(x, .8);
    worldLandmarks[shoulder] = point(worldOffset + 1, 1); worldLandmarks[hip] = point(worldOffset, 1);
    worldLandmarks[knee] = point(worldOffset, 0); worldLandmarks[ankle] = point(worldOffset + 1, 0);
  }
  return { timestampMs: 1200, poseModel: { id: 'mediapipe-heavy-test', version: '1' }, normalizedLandmarks, worldLandmarks };
}
const options = { width: 1000, height: 600, view: 'front' };
const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`);

test('known geometry yields bilateral world angles and signed front offsets with provenance', () => {
  const raw = fixture(), before = structuredClone(raw);
  const result = analyzeMultiViewFrame(raw, options);
  for (const side of ['left', 'right']) {
    near(result.metrics[`${side}KneeFlexion3d`].value, 90);
    near(result.metrics[`${side}HipFlexion3d`].value, 90);
    near(result.metrics[`${side}KneeMedialOffsetHipSpans`].value, 50 / 300);
    near(result.metrics[`${side}KneeMedialOffsetLegLengths`].value, 50 / (2 * Math.hypot(50, 180)));
    assert.equal(result.metrics[`${side}KneeFlexion3d`].confidence, .9);
    assert.equal(result.metrics[`${side}KneeFlexion3d`].status, 'estimated');
    assert.deepEqual(result.metrics[`${side}KneeFlexion3d`].provenance.poseModel, raw.poseModel);
  }
  assert.deepEqual(raw, before, 'Adapter does not mutate raw/report data');
});

test('world joint angles survive 3D rotation, translation, uniform scale and reflection', () => {
  for (const scale of [.01, 1, 100]) {
    const raw = fixture();
    raw.worldLandmarks = raw.worldLandmarks.map(value => {
      if (!value) return null;
      const a = Math.PI / 3, b = Math.PI / 5;
      const x = value.x * Math.cos(a) - value.y * Math.sin(a);
      const y = value.x * Math.sin(a) + value.y * Math.cos(a);
      return { ...value, x: -x * scale + 5, y: (y * Math.cos(b) - value.z * Math.sin(b)) * scale - 3, z: (y * Math.sin(b) + value.z * Math.cos(b)) * scale + 7 };
    });
    const result = analyzeMultiViewFrame(raw, { ...options, view: 'oblique' });
    for (const side of ['left', 'right']) {
      near(result.metrics[`${side}KneeFlexion3d`].value, 90);
      near(result.metrics[`${side}HipFlexion3d`].value, 90);
      assert.equal(result.metrics[`${side}KneeMedialOffsetLegLengths`].reason, 'oblique_uncalibrated');
    }
  }
});

test('front offset signs survive horizontal mirroring and correct dimension changes', () => {
  const raw = fixture(), mirrored = structuredClone(raw);
  mirrored.normalizedLandmarks = mirrored.normalizedLandmarks.map(value => value && { ...value, x: 1 - value.x });
  const baseline = analyzeMultiViewFrame(raw, options), mirror = analyzeMultiViewFrame(mirrored, options);
  const resized = analyzeMultiViewFrame(raw, { ...options, width: 2000, height: 1200 });
  for (const side of ['left', 'right']) for (const suffix of ['LegLengths', 'HipSpans']) {
    const key = `${side}KneeMedialOffset${suffix}`;
    near(baseline.metrics[key].value, mirror.metrics[key].value);
    near(baseline.metrics[key].value, resized.metrics[key].value);
  }
  raw.normalizedLandmarks[25].x = .7; // Toward lateral side, away from opposite hip.
  assert.ok(analyzeMultiViewFrame(raw, options).metrics.leftKneeMedialOffsetHipSpans.value < 0);
});

test('missing world output, confidence, occlusion and crop withhold only affected metrics', () => {
  const raw = fixture(); raw.worldLandmarks = [];
  let result = analyzeMultiViewFrame(raw, options);
  assert.equal(result.metrics.leftKneeFlexion3d.reason, 'missing_world_landmark');
  assert.equal(result.metrics.leftKneeFlexion3d.value, null);
  assert.equal(result.metrics.leftKneeMedialOffsetLegLengths.status, 'estimated');
  const low = fixture(); low.worldLandmarks[25].visibility = .2;
  result = analyzeMultiViewFrame(low, options);
  assert.equal(result.metrics.leftKneeFlexion3d.reason, 'low_confidence');
  assert.equal(result.metrics.rightKneeFlexion3d.status, 'estimated');
  const unknown = fixture(); unknown.normalizedLandmarks[25].presence = null;
  assert.equal(analyzeMultiViewFrame(unknown, options).metrics.leftKneeFlexion3d.status, 'estimated');
  const cropped = fixture(); cropped.normalizedLandmarks[27].y = 1.1;
  assert.equal(analyzeMultiViewFrame(cropped, options).metrics.leftKneeFlexion3d.reason, 'landmark_out_of_frame');
  const occluded = fixture(); occluded.normalizedLandmarks[24] = null;
  assert.equal(analyzeMultiViewFrame(occluded, options).metrics.leftKneeMedialOffsetHipSpans.reason, 'missing_image_landmark');
});

test('optional SDK confidence fields use only observed scores and never invent full confidence', () => {
  const raw = fixture();
  for (const point of raw.normalizedLandmarks.filter(Boolean)) { point.visibility = .8; point.presence = null; }
  for (const point of raw.worldLandmarks.filter(Boolean)) { point.visibility = null; point.presence = null; }
  let result = analyzeMultiViewFrame(raw, options);
  assert.equal(result.metrics.leftKneeFlexion3d.status, 'estimated');
  assert.equal(result.metrics.leftKneeFlexion3d.confidence, .8);
  raw.worldLandmarks[25].visibility = .7;
  assert.equal(analyzeMultiViewFrame(raw, options).metrics.leftKneeFlexion3d.confidence, .7);
  raw.worldLandmarks[25].presence = .3;
  assert.equal(analyzeMultiViewFrame(raw, options).metrics.leftKneeFlexion3d.reason, 'low_confidence');
  raw.normalizedLandmarks[25].visibility = null; raw.worldLandmarks[25].visibility = null;
  raw.worldLandmarks[25].presence = .95;
  result = analyzeMultiViewFrame(raw, options);
  assert.equal(result.metrics.leftKneeFlexion3d.reason, 'missing_confidence', 'Presence alone does not replace visibility');
  assert.equal(result.metrics.leftKneeFlexion3d.value, null);
  assert.equal(result.metrics.leftKneeMedialOffsetLegLengths.reason, 'missing_confidence');
  raw.worldLandmarks[25].presence = null;
  assert.equal(analyzeMultiViewFrame(raw, options).metrics.leftKneeFlexion3d.reason, 'missing_confidence');
});

test('unknown/nonfront view and degenerate geometry never invent a fault score', () => {
  const raw = fixture();
  assert.ok(Object.values(analyzeMultiViewFrame(raw, { ...options, view: 'unknown' }).metrics).every(metric => metric.value === null && metric.reason === 'unknown_view'));
  assert.equal(analyzeMultiViewFrame(raw, { ...options, view: 'side' }).metrics.leftKneeMedialOffsetLegLengths.reason, 'front_view_required');
  assert.throws(() => analyzeMultiViewFrame(raw, { ...options, view: 'back' }), RangeError);
  const collapsed = fixture(); collapsed.worldLandmarks[25] = { ...collapsed.worldLandmarks[23] };
  assert.equal(analyzeMultiViewFrame(collapsed, options).metrics.leftKneeFlexion3d.reason, 'degenerate_world_segment');
  const hips = fixture(); hips.normalizedLandmarks[24] = { ...hips.normalizedLandmarks[23] };
  assert.equal(analyzeMultiViewFrame(hips, options).metrics.leftKneeMedialOffsetLegLengths.reason, 'collapsed_projected_hip_span');
  assert.equal(analyzeMultiViewFrame(raw, { ...options, width: 0 }).metrics.leftKneeMedialOffsetLegLengths.reason, 'invalid_frame_dimensions');
});
