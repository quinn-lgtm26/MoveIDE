// README-only capture: isolated browser, public homepage assets, mocked disconnected coach.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const destination = new URL('../../docs/images/', import.meta.url);
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 820 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); const errors = []; let mockedConnectionReads = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    if (new URL(route.request().url()).pathname === '/api/connection') {
      mockedConnectionReads++; return route.fulfill({ json: { state: 'disconnected' } });
    }
    return route.fulfill({ status: 503, json: { error: 'README screenshot does not access account services.' } });
  });
  await page.route('**/rooms**', route => route.abort());
  const response = await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  const html = await response.text();
  await page.getByRole('heading', { name: 'Measure every squat rep from a phone video.' }).waitFor();
  await page.getByRole('button', { name: 'Connect ChatGPT', exact: true }).waitFor();
  const dismiss = page.getByRole('button', { name: 'Not now', exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image=>image.decode().catch(()=>{}))); scrollTo(0,0); });
  const state = await page.evaluate(() => ({
    heading: document.querySelector('h1')?.textContent,
    coach: document.querySelector('header [aria-label="ChatGPT connection"] [role="status"]')?.textContent,
    asset: document.querySelector('.home-shot img')?.getAttribute('src'),
    assetLoaded: document.querySelector('.home-shot img')?.naturalWidth > 0,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.match(state.coach, /Not connected/); assert.equal(state.assetLoaded, true); assert.equal(state.overflow, false); assert.deepEqual(errors, []);
  const screenshot = await page.screenshot({ path: new URL('homepage.png', destination).pathname, fullPage: false });
  await writeFile(new URL('homepage.capture.json', destination), JSON.stringify({
    capturedAtUtc: new Date().toISOString(), surface: 'Existing localhost4173 production homepage; no service restart',
    mode: 'Fresh isolated Chrome context; public bundled homepage image; disconnected coach status mocked before any account request',
    viewport: { width:1440,height:820 }, htmlSha256: createHash('sha256').update(html).digest('hex'),
    screenshotSha256: createHash('sha256').update(screenshot).digest('hex'), mockedConnectionReads,
    containsPersonalHistory: false, cameraActivated: false, inferenceRequests: 0, ...state,
  },null,2)+'\n');
  console.log(JSON.stringify({ screenshot:'docs/images/homepage.png', ...state, mockedConnectionReads }));
} finally { await browser.close(); }
