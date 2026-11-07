import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { validateCoachingResponse } from '../coaching/index.mjs';

// Uses real Heavy/video analysis with a deterministic mocked interpretation.
// All /api requests are intercepted; no account, paid inference, or Seldon is used.
const server = await preview({
  configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)),
  preview: { host: '127.0.0.1', port: 0 },
});
let browser;
try {
  if (!server.httpServer.listening) await once(server.httpServer, 'listening');
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: process.env.MOVEIDE_CHROMIUM_CHANNEL || 'chrome' });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const externalRequests = [];
  const calls = [];
  const firstText = 'Mock review: inspect the first rep bottom.';
  const secondText = 'Mock review: inspect the second rep bottom.';
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin && url.protocol !== 'blob:') {
      externalRequests.push(url.origin);
      return route.abort();
    }
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/connection') return json({ state: 'connected', enabled: true });
    if (url.pathname === '/api/models') return json([
      { id: 'mock-coaching', label: 'Mock coaching' },
      { id: 'mock-alternative', label: 'Mock alternative' },
    ]);
    if (url.pathname === '/api/interpret') {
      assert.equal(request.method(), 'POST');
      const body = request.postDataJSON();
      calls.push(body);
      assert(['mock-coaching', 'mock-alternative'].includes(body.model));
      assert.equal(body.images.length, 2);
      assert(body.images.every(image => image.dataUrl.startsWith('data:image/jpeg;base64,')));
      assert(!JSON.stringify(body).includes('worldLandmarks'));
      const [firstRep, secondRep] = body.packet.repIds;
      const first = body.packet.measurements.find(item => item.repId === firstRep && item.metric === 'knee_flexion');
      const second = body.packet.measurements.find(item => item.repId === secondRep && item.metric === 'knee_flexion');
      assert(first && second);
      const response = {
        observations: [
          { text: firstText, evidenceIds: [first.id] },
          { text: secondText, evidenceIds: [second.id] },
        ],
        uncertainty: 'Deterministic UI fixture, not an actual AI or accuracy result.',
        nextFocus: { text: 'Mock focus: revisit the first evidence frame.', evidenceIds: [first.id] },
      };
      validateCoachingResponse(response, body.packet);
      return json(response);
    }
    if (url.pathname.startsWith('/api/')) {
      throw new Error(`Unexpected provider route: ${url.pathname}`);
    }
    return route.continue();
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin);
  await page.locator('#connection').getByText('Using ChatGPT plan').waitFor({ state: 'attached' });
  await page.getByRole('button', { name: 'Start coached squat', exact: true }).click();
  await page.getByText('2 complete reps · 2 evidence JPEGs', { exact: true }).waitFor({ timeout: 90_000 });
  await page.locator('#coaching-observations').getByText(firstText, { exact: true }).waitFor({ state: 'attached' });
  assert.equal(calls.length, 1, 'One Start must automatically analyze and coach');
  assert.equal(await page.locator('#interpret').isVisible(), false);
  await page.locator('#developer-details > summary').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('link', { name: 'Download report', exact: true }).click(),
  ]);
  const report = JSON.parse(await readFile(await download.path()));
  assert.equal(report.poseModel.id, 'mediapipe-pose-landmarker-heavy');
  assert.equal(report.reps.length, 2);

  await page.locator('#coaching-observations').getByText(firstText, { exact: true }).waitFor({ state: 'attached' });
  await page.locator('#coaching-observations').getByText(secondText, { exact: true }).waitFor({ state: 'attached' });
  assert.equal(calls.length, 1);

  async function seek(timestampMs) {
    await page.locator('#clip').evaluate((video, time) => {
      video.pause();
      video.currentTime = Math.min((time + .501) / 1000, video.duration - .000001);
    }, timestampMs);
    await page.waitForFunction(time => {
      const video = document.querySelector('#clip');
      return !video.seeking && Math.abs(video.currentTime * 1000 - time) < 2;
    }, timestampMs);
  }

  const [firstRep, secondRep] = report.reps;
  const sampleBetween = (start, end) => report.frames.find(frame =>
    frame.quality === 'usable' && frame.timestampMs > start && frame.timestampMs < end)?.timestampMs;
  const descentTime = sampleBetween(firstRep.startMs, firstRep.bottomMs - 150);
  const ascentTime = sampleBetween(firstRep.bottomMs + 150, firstRep.endMs);
  const secondTime = sampleBetween(secondRep.startMs, secondRep.bottomMs - 150);
  assert(Number.isFinite(descentTime) && Number.isFinite(ascentTime) && Number.isFinite(secondTime));
  const firstCue = 'Mock focus: revisit the first evidence frame.';
  for (const time of [descentTime, ascentTime]) {
    await seek(time);
    await page.locator('#cue-history').getByText(firstCue, { exact: true }).waitFor();
  }
  await seek(secondTime);
  await page.locator('#cue-history > li > p').getByText(secondText, { exact: true }).waitFor();
  assert.equal(await page.locator('#cue-history > li').count(), 2);
  for (const time of [0, report.clip.durationMs - 2, descentTime, secondTime]) {
    await seek(time);
    assert.equal(await page.locator('#cue').isVisible(), true, 'Cue area must not collapse between reps');
    assert.equal(await page.locator('#cue-history > li').count(), 2, 'Replaying must not duplicate or remove coaching cards');
  }
  await page.locator('#coaching-reasoning > summary').click();

  const evidenceButton = page.locator('#coaching-observations').getByRole('button', {
    name: new RegExp(String(firstRep.bottomMs)),
  }).first();
  await evidenceButton.click();
  await page.waitForFunction(time => Math.abs(document.querySelector('#clip').currentTime * 1000 - time) < 2, firstRep.bottomMs);
  await page.locator('#phase').getByText(/rep-1 bottom/).waitFor();

  await seek(descentTime);
  await page.locator('#clip').evaluate(video => video.play());
  await page.waitForFunction(time => document.querySelector('#clip').currentTime * 1000 > time, ascentTime);
  await page.locator('#clip').evaluate(video => video.pause());
  assert.equal(calls.length, 1, 'Playback must reuse the completed response without new requests');
  await page.locator('#settings > summary').click();
  await page.locator('#model').selectOption('mock-alternative');
  assert.equal(await page.locator('#coaching-observations').textContent(), '');
  assert.equal(await page.locator('#cue-history > li').count(), 0);
  assert.equal(await page.locator('#cue').isVisible(), true);
  assert.equal(calls.length, 1, 'Changing model must not implicitly request interpretation');
  await page.getByRole('button', { name: 'Start coached squat', exact: true }).click();
  assert.equal(await page.locator('#coaching-observations').textContent(), '');
  assert.equal(await page.locator('#cue-history > li').count(), 0);
  assert.equal(await page.locator('#cue').isVisible(), true);
  await page.locator('#coaching-observations').getByText(firstText, { exact: true }).waitFor({ state: 'attached', timeout: 90_000 });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].model, 'mock-alternative');
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(pageErrors, []);
  console.log('Readable coaching playback passed: one Start automatically analyzes and coaches, persistent stacked cards, no duplicates on seek or replay, no disappearing cue panel, evidence seek, no repeated inference, model-change reset, and reanalysis reset. Provider response was mocked; no live AI/Seldon request.');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
