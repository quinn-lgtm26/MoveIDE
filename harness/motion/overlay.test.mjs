import assert from 'node:assert/strict';
import test from 'node:test';
import { overlayFrameAt, drawSquatOverlay } from './overlay.mjs';

test('playback chooses the nearest measured sample without carrying an overlay across a gap', () => {
  const frames = [
    { timestampMs: 0, quality: 'usable' },
    { timestampMs: 67, quality: 'unavailable' },
    { timestampMs: 134, quality: 'usable' },
  ];
  assert.equal(overlayFrameAt(frames, 20), frames[0]);
  assert.equal(overlayFrameAt(frames, 80), null);
  assert.equal(overlayFrameAt(frames, 120), frames[2]);
  assert.equal(overlayFrameAt(frames, 235), null);
  assert.equal(overlayFrameAt([], 0), null);
});

// Inspect canvas commands rather than pixels so visibility/geometry safeguards are exact.
function drawingContext() {
  const calls = [];
  const context = { globalAlpha: 1 };
  for (const method of ['clearRect', 'save', 'beginPath', 'rect', 'clip', 'moveTo', 'lineTo', 'stroke', 'arc', 'fill', 'restore']) {
    context[method] = (...args) => calls.push({ method, args, alpha: context.globalAlpha });
  }
  return { context, calls };
}
const options = { side: 'left', videoWidth: 400, videoHeight: 400, width: 400, height: 400, showKneeArc: false };
const pose = () => ({ quality: 'usable', timestampMs: 0, landmarks: Array.from({ length: 33 }, (_, index) => ({ x: .1 + index * .02, y: .1 + index * .015, visibility: 1 })) });
const coordinates = point => [point.x * 400, point.y * 400];
const containsPoint = (calls, point) => calls.some(call => call.method === 'arc' && call.args[0] === point[0] && call.args[1] === point[1]);

test('default projected overlay draws both arms, both legs, hands, torso and feet', () => {
  const { context, calls } = drawingContext(); const frame = pose();
  drawSquatOverlay(context, frame, options);
  for (const index of [0, 11, 12, 13, 14, 15, 16, 17, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]) {
    assert.ok(containsPoint(calls, coordinates(frame.landmarks[index])), `Visible joint ${index} should be drawn`);
  }
  assert.equal(calls.filter(call => call.method === 'lineTo').length, 52, '26 body links in shadow and foreground passes');
});

test('occluded or out-of-frame joints and their links are omitted; uncertain visible joints are dimmed', () => {
  const { context, calls } = drawingContext(); const frame = pose();
  frame.landmarks[13].visibility = .49;
  frame.landmarks[14].x = 1.1;
  frame.landmarks[25].visibility = .6;
  drawSquatOverlay(context, frame, options);
  assert.equal(containsPoint(calls, coordinates(frame.landmarks[13])), false);
  assert.equal(containsPoint(calls, coordinates(frame.landmarks[14])), false);
  for (const index of [13, 14]) {
    const point = coordinates(frame.landmarks[index]);
    assert.equal(calls.some(call => ['moveTo', 'lineTo'].includes(call.method) && call.args[0] === point[0] && call.args[1] === point[1]), false);
  }
  const dim = calls.find(call => call.method === 'arc' && call.args[0] === coordinates(frame.landmarks[25])[0]);
  assert.ok(dim.alpha >= .3 && dim.alpha < .5);
});

test('legacy side-only option is available and the optional knee arc belongs only to the selected side', () => {
  const { context, calls } = drawingContext(); const frame = pose();
  drawSquatOverlay(context, frame, { ...options, fullBody: false, showKneeArc: true });
  assert.equal(containsPoint(calls, coordinates(frame.landmarks[26])), false);
  assert.equal(calls.filter(call => call.method === 'lineTo').length, 10);
  const arcs = calls.filter(call => call.method === 'arc' && call.args[2] > 3);
  assert.equal(arcs.length, 1); assert.deepEqual(arcs[0].args.slice(0, 2), coordinates(frame.landmarks[25]));
});

test('unavailable frames are cleared without inventing a full-body pose', () => {
  const { context, calls } = drawingContext();
  drawSquatOverlay(context, { ...pose(), quality: 'unavailable' }, options);
  assert.deepEqual(calls.map(call => call.method), ['clearRect']);
});
