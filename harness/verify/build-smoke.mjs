import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const labels = JSON.parse(await readFile(new URL('../../fixtures/squat/clear-squat.labels.json', import.meta.url)));
const server = await preview({
  configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)),
  preview: { host: '127.0.0.1', port: 0 },
});
try {
  if (!server.httpServer.listening) await once(server.httpServer, 'listening');
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const browser = await chromium.launch({ channel: process.env.MOVEIDE_CHROMIUM_CHANNEL || 'chrome' });
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const outbound = [];
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin || url.protocol === 'blob:') return route.continue();
      outbound.push(url.origin);
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin);
    await page.locator('#connection').getByText('unavailable').waitFor();
    await page.getByRole('button', { name: 'Analyze sample squat' }).click();
    await page.getByText('2 complete reps · 2 evidence JPEGs').waitFor({ timeout: 90_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Download report' }).click(),
    ]);
    const report = JSON.parse(await readFile(await download.path()));
    const bottoms = report.reps.map(({ bottomMs }) => bottomMs);
    assert.equal(bottoms.length, labels.expectedCompleteReps);
    bottoms.forEach((time, index) => assert(Math.abs(time - labels.bottomTimestampsMs[index]) <= labels.bottomToleranceMs));
    assert.deepEqual(await page.locator('#evidence img').evaluateAll((images) => images.map(({ alt }) => alt)),
      bottoms.map((time) => `Squat source frame at ${time} ms`));
    const video = page.locator('#clip');
    await video.evaluate(async (element, timestamp) => {
      if (element.readyState < 2) await new Promise((resolve) => element.addEventListener('loadeddata', resolve, { once: true }));
      element.currentTime = (timestamp + .501) / 1000;
    }, bottoms[0]);
    await page.locator('#phase').getByText(/rep-1 bottom/).waitFor();
    assert.match(await page.locator('#frame-metrics').innerText(), /Knee .*Hip .*Torso .*Shin .*Ankle change/);
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#overlay');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      return data.some((value, index) => index % 4 === 3 && value > 0);
    });
    await page.getByRole('button', { name: 'Next sample' }).click();
    await page.locator('#phase').getByText(/rep-1 ascent/).waitFor();
    await page.getByRole('button', { name: 'Previous sample' }).click();
    await page.locator('#phase').getByText(/rep-1 bottom/).waitFor();
    assert.equal(await page.getByText(/knee flexion · .*°/).count(), labels.expectedCompleteReps);
    assert.equal(await page.getByText(/torso lean · .*°/).count(), labels.expectedCompleteReps);
    await page.getByRole('button', { name: 'Copy coaching handoff' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(copied, /MoveIDE Magna Carta v1\.0\.0/);
    for (const time of bottoms) assert(copied.includes(`frame-${time}ms.jpg`));
    assert.equal(await page.getByRole('button', { name: 'Send previewed packet and images' }).isDisabled(), true);
    assert.deepEqual(outbound, []);
    assert.deepEqual(errors, []);
    console.log('Built harness · 2 reps, 2 source JPEGs, synchronized overlay and step controls, real clipboard handoff, no outbound requests');
  } finally {
    await browser.close();
  }
} finally {
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
