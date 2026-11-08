// Explicit opt-in verification: sends public fixture evidence to the connected ChatGPT plan.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { validateCoachingResponse } from '../coaching/index.mjs';
if (!process.argv.includes('--send-public-fixture')) throw new Error('Use --send-public-fixture to run a real connected-plan request.');
const origin = 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let requestCount = 0, approved;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/interpret') {requestCount++; approved = request.postDataJSON();}
  });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Try a sample squat', exact: true }).click();
  const response = await page.waitForResponse(r => new URL(r.url()).pathname === '/api/interpret', { timeout: 150_000 });
  const body = await response.json();
  assert(response.ok(), `Real provider failed: ${body.error ?? response.status()}`);
  validateCoachingResponse(body, approved.packet);
  await page.getByText(/Coach notes ready/).waitFor();
  await page.getByRole('button', { name: 'Rep 1 bottom' }).click();
  await page.locator('[aria-label="Playback AI cue"]').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Rep 2 bottom' }).click();
  await page.locator('[aria-label="Playback AI cue"]').getByText(/Rep 2/).waitFor();
  assert.equal(requestCount, 1, 'Seek must reuse the first response');
  assert.equal(await page.locator('.coaching-card').count(), 2);
  assert(await page.locator('.coaching-focus').evaluateAll(nodes => nodes.every(node => node.textContent.length <= 180)));
  await page.getByRole('button', { name: 'Stop session', exact: true }).click();
  assert.equal(await page.locator('.coaching-card').count(), 2);
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await page.getByText(/AI notes saved/).waitFor();
  await page.getByRole('button', { name: /^Open clear-squat/ }).click();
  await page.getByText('Saved session · replay only', { exact: true }).waitFor();
  assert.equal(await page.locator('.coaching-card').count(), 2);
  await page.reload();
  await page.getByText('Saved session · replay only', { exact: true }).waitFor();
  assert.equal(await page.locator('.coaching-card').count(), 2);
  assert.equal(requestCount, 1, 'History replay and reload must reuse accepted real AI');
  const result = { verifiedAtUtc: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), surface: 'root production build', fixture: 'clear-squat.mp4', provider: 'real ChatGPT', model: approved.model, requestCount, sourceImageTimestampsMs: approved.images.map(x => x.timestampMs), measurementIds: approved.packet.measurements.map(x => x.id), responseEvidenceIds: body.observations.map(x => x.evidenceIds), checks: { oneStart: true, responseValidated: true, firstRepCueVisible: true, secondRepCueVisible: true, noExtraSeekRequests: true, twoPersistentShortCards: true, stopRetainsCards: true, realNotesPersistInHistory: true, reloadRestoresWithoutInference: true } };
  await writeFile(new URL('../../qa/root-live-chatgpt.json', import.meta.url), JSON.stringify(result, null, 2)+'\n');
  await page.screenshot({ path: new URL('../../qa/root-live-chatgpt.png', import.meta.url).pathname, fullPage: true });
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
