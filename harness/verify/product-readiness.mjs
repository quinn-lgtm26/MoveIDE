import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

// Build the root workbench first. This probes its public sample without an account.
const root = fileURLToPath(new URL('../../', import.meta.url));
let browser, server;
let result = { readyForFinalQA: false, outcome: 'probe-error' };
try {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  result.commit = commit;
  const expectedHash = createHash('sha256').update(await readFile(`${root}fixtures/squat/clear-squat.mp4`)).digest('hex');
  const labels = JSON.parse(await readFile(`${root}fixtures/squat/clear-squat.labels.json`, 'utf8'));
  server = await preview({ root, configFile: `${root}vite.config.ts`,
    preview: { host: '127.0.0.1', port: 0, strictPort: false } });
  browser = await chromium.launch({ channel: process.env.MOVEIDE_CHROMIUM_CHANNEL || 'chrome' });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const origins = new Set();
  const errors = [];
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  context.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) origins.add(url.origin);
  });
  page.on('pageerror', error => errors.push(error.message));
  // Exercise the deliberately disconnected path without touching native auth.
  await page.route('**/api/connection', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ state: 'disconnected', enabled: false }),
  }));
  await page.goto(origin);
  await page.getByRole('button', { name: 'Open sample squat', exact: true }).click();
  let outcome = 'ready';
  try { await page.getByText(/Ready ·/).waitFor({ timeout: 90_000 }); }
  catch { outcome = 'not-ready-within-90s'; }
  let report = null;
  let packetText = '';
  let decodedImageCount = 0;
  let copyMatchesPreview = false;
  let sourceHash = null;
  if (outcome === 'ready' && await page.getByRole('button', { name: 'Export report JSON' }).count()) {
    sourceHash = await page.locator('video').evaluate(async video => {
      const bytes = await (await fetch(video.currentSrc || video.src)).arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    });
    const [download] = await Promise.all([
      page.waitForEvent('download'), page.getByRole('button', { name: 'Export report JSON' }).click(),
    ]);
    report = JSON.parse(await readFile(await download.path()));
    await page.getByRole('button', { name: 'Preview coaching packet' }).click();
    await page.locator('.packet pre').waitFor({ state: 'attached' });
    packetText = await page.locator('.packet pre').textContent();
    try { await page.waitForFunction(() => [...document.querySelectorAll('.packet .frames img')]
      .filter(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0).length === 2, null, { timeout: 15_000 }); }
    catch { /* Keep missing evidence explicit in the result. */ }
    decodedImageCount = await page.locator('.packet .frames img').evaluateAll(images =>
      images.filter(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0).length);
    await page.evaluate(() => navigator.clipboard.writeText('moveide-readiness-pending-copy'));
    await page.getByRole('button', { name: 'Copy Magna Carta + packet' }).click();
    await page.waitForFunction(async expected => await navigator.clipboard.readText() === expected, packetText, { timeout: 5000 });
    copyMatchesPreview = await page.evaluate(() => navigator.clipboard.readText()) === packetText;
  }
  const checks = {
    ready: outcome === 'ready',
    heavyModel: report?.poseModel?.id === 'mediapipe-pose-landmarker-heavy',
    clearFixture: sourceHash === expectedHash,
    labeledTiming: report?.reps?.length === labels.expectedCompleteReps && report.reps.every((rep, index) =>
      Math.abs(rep.bottomMs - labels.bottomTimestampsMs[index]) <= labels.bottomToleranceMs),
    twoUsableComparisons: report?.reps?.length === 2 && report.reps.every(rep =>
      ['knee_flexion', 'rep_duration', 'torso_lean'].every(metric => report.measurements.some(measure =>
        measure.repId === rep.id && measure.metric === metric && measure.quality === 'usable'))),
    bothEvidenceImages: decodedImageCount === 2,
    copyMatchesPreview,
    sameOriginAssets: origins.size === 0,
    noPageErrors: errors.length === 0,
  };
  result = { commit, browser: browser.version(), outcome, sourceHash, checks,
    readyForFinalQA: Object.values(checks).every(Boolean),
    status: await page.getByRole('status').allTextContents(),
    compareText: await page.locator('.compare').allTextContents(),
    measurements: await page.locator('aside').allTextContents(),
    externalOrigins: [...origins], errors,
    scope: 'Built root workbench public-sample readiness probe with disconnected auth. UI selectors may need updating when the frontend design changes. Does not cover all final Seldon workflows, authenticate, send coaching, or dispatch Seldon.' };
} catch (error) {
  result = { ...result, readyForFinalQA: false, outcome: 'probe-error', error: error.message };
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
  if (process.argv.includes('--write')) await writeFile(new URL('../../qa/product-readiness.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.readyForFinalQA) process.exitCode = 1;
}
