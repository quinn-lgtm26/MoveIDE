import test from 'node:test';
import assert from 'node:assert/strict';
import { seekVideoFrame } from './video.mjs';

function fakeVideo(mode = 'missing') {
  const video = new EventTarget();
  Object.assign(video, { duration: 2, readyState: 2, seeking: false, afterSeek: null, cancelledCallbacks: 0 });
  let time = 0, nextToken = 0;
  const callbacks = new Map();
  if (mode !== 'missing') {
    video.requestVideoFrameCallback = callback => { callbacks.set(++nextToken, callback); return nextToken; };
    video.cancelVideoFrameCallback = token => { callbacks.delete(token); video.cancelledCallbacks++; };
  }
  video.pendingCallbacks = () => callbacks.size;
  Object.defineProperty(video, 'currentTime', {
    get: () => time,
    set: value => {
      time = value; video.seeking = true;
      queueMicrotask(() => {
        video.seeking = false;
        if (mode === 'presented') for (const callback of callbacks.values()) callback(0, { mediaTime: Math.max(0, value - .04) });
        video.dispatchEvent(new Event('seeked'));
        video.afterSeek?.();
      });
    },
  });
  return video;
}

test('presented source timestamp takes precedence over the requested seek position', async () => {
  const video = fakeVideo('presented');
  assert.equal(await seekVideoFrame(video, .3), 260);
  assert.equal(video.pendingCallbacks(), 0);
  assert.equal(video.cancelledCallbacks, 1);
});

test('missing callback compatibility returns seek time without claiming presentation time', async () => {
  const video = fakeVideo();
  assert.equal(await seekVideoFrame(video, .3), 300);
});

test('abort immediately after seek event rejects even without a frame callback API', async () => {
  const video = fakeVideo(), controller = new AbortController();
  const reason = new Error('cancelled after seek event');
  video.afterSeek = () => controller.abort(reason);
  await assert.rejects(seekVideoFrame(video, .3, controller.signal), error => error === reason);
});

test('silent Safari-style callbacks fall back, then still honor cancellation on later seeks', async () => {
  const video = fakeVideo('silent');
  assert.equal(await seekVideoFrame(video, .2), 200);
  assert.equal(video.pendingCallbacks(), 0);
  const controller = new AbortController(), reason = new Error('cancelled silent decoder');
  video.afterSeek = () => controller.abort(reason);
  await assert.rejects(seekVideoFrame(video, .4, controller.signal), error => error === reason);
  assert.equal(video.pendingCallbacks(), 0);
  assert.equal(video.cancelledCallbacks, 2);
});

test('abort during the one-time callback grace period cancels its registered callback', async () => {
  const video = fakeVideo('silent'), controller = new AbortController();
  const request = seekVideoFrame(video, .2, controller.signal);
  const timer = setTimeout(() => controller.abort(new Error('cancelled during grace')), 15);
  try { await assert.rejects(request, /cancelled during grace/); }
  finally { clearTimeout(timer); }
  assert.equal(video.pendingCallbacks(), 0);
});
