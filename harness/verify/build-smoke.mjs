import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

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
    await page.getByRole('button', { name: 'Analyze supported squat' }).click();
    await page.getByText('2 complete reps · 2 evidence JPEGs').waitFor({ timeout: 90_000 });
    assert.deepEqual(await page.locator('#evidence img').evaluateAll((images) => images.map(({ alt }) => alt)),
      ['Squat source frame at 1600 ms', 'Squat source frame at 4400 ms']);
    await page.getByRole('button', { name: 'Copy coaching handoff' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(copied, /MoveIDE Magna Carta v1\.0\.0/);
    assert.match(copied, /frame-1600ms\.jpg/);
    assert.match(copied, /frame-4400ms\.jpg/);
    assert.equal(await page.getByRole('button', { name: 'Send previewed packet and images' }).isDisabled(), true);
    assert.deepEqual(outbound, []);
    assert.deepEqual(errors, []);
    console.log('Built harness · 2 reps, 2 source JPEGs, real clipboard handoff, no outbound requests');
  } finally {
    await browser.close();
  }
} finally {
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
