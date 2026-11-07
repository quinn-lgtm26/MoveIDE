import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentRect, frameAt } from './overlay.ts';
import type { Frame } from './contract.ts';

test('contentRect letterboxes a portrait clip in a landscape box', () => {
  assert.deepEqual(contentRect(540, 960, 1000, 480), { x: 365, y: 0, w: 270, h: 480 });
  assert.deepEqual(contentRect(1280, 720, 640, 640), { x: 0, y: 140, w: 640, h: 360 });
});

const f = (timestampMs: number, quality: Frame['quality'] = 'usable'): Frame => ({ timestampMs, landmarks: [], quality });

test('frameAt picks the nearest usable frame within 100 ms, else a gap', () => {
  const frames = [f(0), f(67), f(133, 'unavailable'), f(400)];
  assert.equal(frameAt(frames, 60)?.timestampMs, 67);
  assert.equal(frameAt(frames, 20)?.timestampMs, 0);
  assert.equal(frameAt(frames, 130), null); // nearest is unavailable: no reuse of the prior frame
  assert.equal(frameAt(frames, 250), null); // >100 ms from any sample
  assert.equal(frameAt(frames, 999), null);
  assert.equal(frameAt([], 0), null);
});
