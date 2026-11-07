import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ configFile: new URL('../vite.config.mjs', import.meta.url).pathname, server: { host: '127.0.0.1', port: 0, strictPort: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [], sends = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/connection', route => route.fulfill({ json: { state: 'connected' } }));
  await page.route('**/api/models', route => route.fulfill({ json: [{ id: 'mock-model', label: 'Mock test model' }] }));
  await page.route('**/api/interpret', async route => {
    const body = route.request().postDataJSON(); sends.push(body);
    assert.equal(body.packet.repIds.length, 1);
    assert.ok(body.images.length > 0);
    for (const image of body.images) assert.ok(body.packet.evidence.some(item => item.timestampMs === image.timestampMs && item.id === image.id));
    const evidenceIds = [body.packet.evidence[0].id];
    await route.fulfill({ json: { observations: [{ text: 'Synthetic test observation.', evidenceIds }], nextFocus: { text: 'Keep the same camera position.', evidenceIds }, uncertainty: 'Mock AI response for integration testing only.' } });
  });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const source = document.createElement('video'); source.src = '/fixtures/squat/clear-squat.mp4'; source.loop = true; source.muted = true;
      document.body.append(source); source.style.display = 'none';
      await source.play();
      window.syntheticVideo = source;
      window.syntheticStream = source.captureStream();
      return window.syntheticStream;
    };
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/harness/live/`);
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#knee').textContent !== '—', null, { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelector('#ai').textContent.includes('Synthetic test observation'), null, { timeout: 40_000 });
  assert.ok(sends.length > 0 && sends.length <= 6);
  const observed = await page.locator('#latency').innerText();
  // Freeze the analyzed element to simulate no newly presented camera frames.
  await page.evaluate(() => { window.syntheticVideo.pause(); document.querySelector('#video').pause(); });
  await page.waitForFunction(() => document.querySelector('#knee').textContent === '—' && document.querySelector('#feedback').dataset.state === 'unknown', null, { timeout: 3000 });
  await page.screenshot({ path: new URL('./app-qa.png', import.meta.url).pathname });
  await page.locator('#stop').click();
  assert.equal(await page.evaluate(() => window.syntheticStream.getTracks().every(track => track.readyState === 'ended')), true);
  assert.equal(await page.locator('#start').isEnabled(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile layout must fit the viewport');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'passed', observed, aiRequests: sends.length, syntheticCamera: true, stalePoseCleared: true, tracksStopped: true }));
} finally { await browser?.close(); await server.close(); }
