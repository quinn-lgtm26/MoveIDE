import assert from 'node:assert/strict';
import test from 'node:test';
import { overlayFrameAt } from './overlay.mjs';

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
