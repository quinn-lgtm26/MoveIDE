import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createViewGuard } from './view-guard.mjs';
const report = JSON.parse(await readFile(new URL('../../results/clear-squat.analysis-report.v1.json', import.meta.url)));
const sample = (timestampMs, landmarks = report.frames[0].landmarks) => ({ timestampMs, landmarks, widthPx: report.clip.widthPx, heightPx: report.clip.heightPx });
const transformed = fn => report.frames[0].landmarks.map(point => point && fn({ ...point }));
function stabilize(guard, landmarks) { let result; for (let time = 0; time <= 500; time += 100) result = guard.update(sample(time, landmarks)); return result; }

test('static measured fixture needs a full dwell and keeps its epoch during stable tracking', () => {
  const guard = createViewGuard();
  assert.deepEqual(guard.update(sample(0)), { state: 'reacquiring', reason: 'initializing', epoch: 0 });
  for (const t of [100, 200, 300, 400]) assert.equal(guard.update(sample(t)).state, 'reacquiring');
  assert.deepEqual(guard.update(sample(500)), { state: 'stable', reason: 'stable-window', epoch: 0 });
  for (const t of [600, 700, 800]) assert.equal(guard.update(sample(t)).epoch, 0);
});
test('abrupt global translation invalidates the epoch and restarts the dwell', () => {
  const guard = createViewGuard(); stabilize(guard);
  const moved = transformed(point => ({ ...point, x: point.x + .25 }));
  assert.deepEqual(guard.update(sample(600, moved)), { state: 'reacquiring', reason: 'abrupt-translation', epoch: 1 });
  for (const t of [700, 800, 900, 1000]) assert.equal(guard.update(sample(t, moved)).state, 'reacquiring');
  assert.deepEqual(guard.update(sample(1100, moved)), { state: 'stable', reason: 'stable-window', epoch: 1 });
});
test('projected scale changes, left/right continuity flips and large anchor jumps are withheld', () => {
  const scaled = createViewGuard(); stabilize(scaled);
  const zoom = transformed(point => ({ ...point, x: .5 + (point.x - .5) * 1.4, y: .5 + (point.y - .5) * 1.4 }));
  assert.equal(scaled.update(sample(600, zoom)).reason, 'abrupt-scale-change');
  const flipped = createViewGuard(); stabilize(flipped);
  const swapped = structuredClone(report.frames[0].landmarks);
  for (const [left, right] of [[11, 12], [23, 24]]) [swapped[left], swapped[right]] = [swapped[right], swapped[left]];
  assert.equal(flipped.update(sample(600, swapped)).reason, 'landmark-identity-change');
  const jumped = createViewGuard({ jointJump: .06, scaleRatioJump: 3 }); stabilize(jumped);
  const altered = structuredClone(report.frames[0].landmarks); altered[11].x += .2;
  assert.equal(jumped.update(sample(600, altered)).reason, 'abrupt-joint-jump');
});
test('low anchor confidence remains unavailable without epoch churn and requires reacquisition', () => {
  const guard = createViewGuard(); stabilize(guard);
  const missing = structuredClone(report.frames[0].landmarks); missing[23].visibility = .2;
  assert.deepEqual(guard.update(sample(600, missing)), { state: 'unavailable', reason: 'tracking-unavailable', epoch: 1 });
  assert.equal(guard.update(sample(700, missing)).epoch, 1);
  assert.deepEqual(guard.update(sample(800)), { state: 'reacquiring', reason: 'tracking-restored', epoch: 1 });
  for (const t of [900, 1000, 1100, 1200]) guard.update(sample(t));
  assert.equal(guard.update(sample(1300)).state, 'stable');
});
test('time gaps, clock rollback and image-size changes cannot inherit old baselines', () => {
  const guard = createViewGuard(); stabilize(guard);
  assert.deepEqual(guard.update(sample(1000)), { state: 'reacquiring', reason: 'tracking-gap', epoch: 1 });
  assert.equal(guard.update(sample(900)).reason, 'non-monotonic-time');
  assert.equal(guard.update(sample(1000)).state, 'reacquiring');
  assert.equal(guard.update({ ...sample(1100), widthPx: 1440, heightPx: 810 }).reason, 'image-size-changed');
});
test('explicit reset advances generation and clears time origin and previous front/side baseline eligibility', () => {
  const guard = createViewGuard({ stableForMs: 300 }); stabilize(guard);
  assert.deepEqual(guard.reset(), { state: 'reacquiring', reason: 'manual-reset', epoch: 1 });
  assert.equal(guard.update(sample(0)).state, 'reacquiring');
  guard.update(sample(100)); guard.update(sample(200));
  assert.deepEqual(guard.update(sample(300)), { state: 'stable', reason: 'stable-window', epoch: 1 });
});
test('moving hands do not imply a camera change and malformed geometry is unavailable', () => {
  const guard = createViewGuard(); stabilize(guard);
  const hands = structuredClone(report.frames[0].landmarks); hands[15] = { x: .1, y: .1, visibility: 1 };
  assert.equal(guard.update(sample(600, hands)).state, 'stable');
  assert.equal(guard.update(sample(700, [] )).state, 'unavailable');
  assert.equal(guard.update({ ...sample(800), widthPx: NaN }).reason, 'invalid-frame');
  assert.throws(() => createViewGuard({ stableForMs: -1 }), RangeError);
});

test('the complete recorded clear-squat landmark fixture preserves continuity through normal squat motion', () => {
  const guard = createViewGuard();
  const results = report.frames.map(frame => guard.update({ ...frame, widthPx: report.clip.widthPx, heightPx: report.clip.heightPx }));
  assert.deepEqual([...new Set(results.map(result => result.epoch))], [0]);
  assert.equal(results.at(-1).state, 'stable');
  assert.equal(results.filter(result => result.state === 'stable').length, 49);
});

test('bounded cadence adaptation permits steady 300–500ms observations without endless epoch churn', () => {
  for (const interval of [300, 500]) {
    const guard = createViewGuard();
    const results = Array.from({ length: 20 }, (_, index) => guard.update(sample(index * interval)));
    assert.equal(results.at(-1).state, 'stable');
    assert.equal(results.at(-1).epoch, 1);
    assert.ok(results.filter(result => result.state === 'stable').length >= 15);
    assert.equal(guard.update(sample(20 * interval + 1500)).reason, 'tracking-gap');
  }
});
test('cadence adaptation remains bounded and optional, reset discards its learned interval', () => {
  for (const options of [{}, { cadenceAware: false }]) {
    const guard = createViewGuard(options), interval = options.cadenceAware === false ? 300 : 1100;
    for (let i = 0; i < 20; i++) assert.notEqual(guard.update(sample(i * interval)).state, 'stable');
  }
  const guard = createViewGuard();
  for (let i = 0; i < 10; i++) guard.update(sample(i * 500));
  guard.reset(); guard.update(sample(0));
  assert.equal(guard.update(sample(500)).reason, 'tracking-gap');
});
