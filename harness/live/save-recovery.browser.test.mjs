import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ configFile: new URL('../vite.config.mjs', import.meta.url).pathname,
  server: { host: '127.0.0.1', port: 0, strictPort: false } });
let browser;
try {
  await server.listen(); await server.watcher.close();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  await context.route('**/harness/live/motion/index.mjs*', route => route.fulfill({ contentType: 'text/javascript', body: 'export async function startLiveSquat(){ return {stop(){}}; }' }));
  await context.route('**/harness/provider/client.mjs*', route => route.fulfill({ contentType: 'text/javascript', body: "export const chatGPTProvider={async getConnection(){return {state:'disconnected'}}};" }));
  await context.route('**/harness/history/index.mjs*', route => route.fulfill({ contentType: 'text/javascript', body: `let calls=0; export const createSessionId=()=>crypto.randomUUID(); export async function saveSession(data){if(++calls%2)throw new Error('Storage full');return {id:data.id};}` }));
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120;
      const ctx = canvas.getContext('2d'); let count = 0;
      setInterval(() => { ctx.fillStyle = count++ % 2 ? 'green' : 'blue'; ctx.fillRect(0, 0, 160, 120); }, 50);
      return canvas.captureStream(20);
    };
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/harness/live/`);
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#recording-status').textContent.startsWith('Recording on'));
  await page.waitForTimeout(1100); await page.locator('#stop').click();
  await page.getByRole('button', { name: 'Download unsaved video', exact: true }).waitFor();
  const videoWait = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download unsaved video', exact: true }).click();
  const video = await videoWait; assert.ok((await readFile(await video.path())).length > 0);
  const jsonWait = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download session JSON', exact: true }).click();
  const json = await jsonWait, data = JSON.parse(await readFile(await json.path(), 'utf8'));
  assert.equal(data.savedLocally, false); assert.equal(data.live.timing.alignment, 'approximate'); assert.ok(data.video.bytes > 0);
  assert.deepEqual(data.evidenceImages, []);
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await page.getByRole('link', { name: 'Open saved session' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Download unsaved video', exact: true }).count(), 0);
  await page.evaluate(() => { window.MediaRecorder = undefined; });
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#recording-status').textContent.includes('cannot record'));
  await page.locator('#stop').click();
  await page.getByRole('button', { name: 'Download session JSON', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Download unsaved video', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Discard unsaved session', exact: true }).click();
  assert.equal(await page.locator('#saved-sessions .save-result').count(), 1);
  console.log(JSON.stringify({ result: 'passed', quotaRecoveryDownloads: true, approximateProvenance: true, retryCleanup: true, unsupportedVideoNotOffered: true, discardCleanup: true, usesHeavy: false }));
} finally { await browser?.close(); await server.close(); }
