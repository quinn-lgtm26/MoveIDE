// Opt-in real-provider regression. Uses a fresh browser profile and fixture pixels only.
// No user camera, saved history, credentials, pairing URL or provider prose enters the evidence file.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
if (!process.argv.includes('--send-public-fixture')) throw new Error('Use --send-public-fixture to send at most two public fixture rep reviews to the connected plan.');
const evidencePath = new URL('../../qa/phone-queued-review.json', import.meta.url);
const safe = value => String(value).replace(/https?:\/\/\S+/g, '[URL redacted]').replace(/[a-f0-9-]{32,}/gi, '[identifier redacted]').slice(0, 500);
const result = { status: 'running', verifiedAtUtc: new Date().toISOString(), publicHttps: true,
  camera: 'Synthetic fixture stream; physical iPhone NOT tested', video: 'Real WebRTC across isolated Chrome contexts',
  poseModel: 'Heavy', provider: 'Real connected ChatGPT', maximumProviderRequests: 2, fixtureLoops: false,
  requests: [], responses: [], checkpoints: [], errors: [], claimLimits: 'No independent angle accuracy or physical-device latency claim.' };
let browser, receiver, sender, failure, stoppedAt = null, initial;
const responseTasks = [];
let resolveFirstRequest;
const firstRequest = new Promise(resolve => { resolveFirstRequest = resolve; });
const waitBounded = (promise, milliseconds, message) => {
  let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]).finally(() => clearTimeout(timer));
};
const checkpoint = value => result.checkpoints.push(value);
async function summary() {
  return receiver.evaluate(async () => {
    const href = document.querySelector('#saved-sessions a')?.href;
    if (!href) return null;
    const id = new URL(href).searchParams.get('session');
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('moveide-history-v1', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction(['sessions', 'assets'], 'readonly'); let row, asset;
        tx.objectStore('sessions').get(id).onsuccess = event => { row = event.target.result; };
        tx.objectStore('assets').get(id).onsuccess = event => { asset = event.target.result; };
        tx.oncomplete = () => resolve({ row, asset }); tx.onabort = () => reject(tx.error);
      });
      if (!rows.row || !rows.asset) return null;
      const { row, asset } = rows;
      const actualHash = asset.video ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', await asset.video.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('') : null;
      return { id, hash: row.videoSha256, actualHash, bytes: row.videoBytes, revision: row.revision,
        sampleCount: row.live.samples.length, repCount: row.live.reps.length, noteCount: row.live.notes.length,
        reviews: row.live.repReviews.map(review => ({ state: review.state, timestampMs: review.timestampMs, repKey: review.repKey })),
        evidenceCount: asset.evidenceImages?.length ?? 0 };
    } finally { db.close(); }
  });
}
try {
  browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  receiver = await browser.newPage(); sender = await browser.newPage();
  for (const page of [receiver, sender]) page.on('pageerror', error => result.errors.push(safe(error.message)));
  await receiver.addInitScript(() => {
    window.qaReviewStates = []; window.qaSampleCount = 0;
    window.addEventListener('moveide:review-state', event => { if (window.qaReviewStates.length < 30) window.qaReviewStates.push({ state: event.detail.state, pending: event.detail.pending, at: Date.now() }); });
    window.addEventListener('moveide:live-sample', () => window.qaSampleCount++);
  });
  let requestCount = 0;
  await receiver.route('**/api/interpret', async route => {
    if (++requestCount > 2) { result.errors.push('Provider request budget exceeded; excess request blocked.'); await route.abort(); return; }
    await route.continue();
  });
  receiver.on('request', request => {
    if (new URL(request.url()).pathname !== '/api/interpret') return;
    const { packet, images, model } = request.postDataJSON();
    result.requests.push({ at: Date.now(), model, repCount: packet.repIds.length, measurementCount: packet.measurements.length, imageTimestampsMs: images.map(image => image.timestampMs) });
    resolveFirstRequest();
  });
  receiver.on('requestfailed', request => { if (new URL(request.url()).pathname === '/api/interpret') result.errors.push(`Provider request failed: ${safe(request.failure()?.errorText)}`); });
  receiver.on('response', response => {
    if (new URL(response.url()).pathname !== '/api/interpret') return;
    const at = Date.now();
    responseTasks.push((async () => { const body = await response.json().catch(() => null); result.responses.push({ at, status: response.status(), observationCount: body?.observations?.length ?? 0, nextFocusLength: body?.nextFocus?.text?.length ?? 0 }); })());
  });
  await receiver.goto('http://127.0.0.1:4173/harness/live/');
  await receiver.locator('#source').selectOption('phone'); await receiver.locator('#start').click();
  await receiver.waitForFunction(() => document.querySelector('#phone-url').value.startsWith('https:'), null, { timeout: 20000 });
  const privatePhoneUrl = await receiver.locator('#phone-url').inputValue();
  checkpoint('Created configured HTTPS phone pairing in isolated profile');
  const fixture = await readFile(new URL('../../fixtures/squat/clear-squat.mp4', import.meta.url));
  await sender.route('**/qa-fixture.mp4', route => route.fulfill({ body: fixture, contentType: 'video/mp4' }));
  await sender.addInitScript(() => {
    window.qaCameraCalls = 0;
    navigator.mediaDevices.getUserMedia = async constraints => {
      window.qaCameraCalls++; if (constraints.audio !== false) throw new Error('Unexpected microphone request');
      const video = document.createElement('video'); video.src = '/qa-fixture.mp4'; video.loop = false; video.muted = true; video.style.display = 'none'; document.body.append(video);
      await video.play(); video.pause(); video.currentTime = 0;
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const context = canvas.getContext('2d'); let stream;
      const draw = () => { if (stream?.getVideoTracks()[0]?.readyState === 'ended') { video.pause(); return; } context.drawImage(video, 0, 0, canvas.width, canvas.height); requestAnimationFrame(draw); };
      draw(); stream = canvas.captureStream(30); window.qaStream = stream;
      // A stationary first frame lets Heavy initialize without consuming the single non-looping clip.
      window.qaPlayFixture = () => video.play(); return stream;
    };
  });
  await sender.goto(privatePhoneUrl); assert.equal(await sender.evaluate(() => window.qaCameraCalls), 0);
  await sender.locator('#start').click();
  await receiver.waitForFunction(() => document.querySelector('#knee').textContent !== '—', null, { timeout: 60000 });
  await receiver.waitForFunction(() => Boolean(document.querySelector('#live-chart path[data-metric="kneeFlexionDeg"]')?.getAttribute('d')), null, { timeout: 15000 });
  await sender.waitForFunction(() => /knee/i.test(document.querySelector('#feedback').textContent), null, { timeout: 20000 });
  checkpoint('Heavy angles, populated live chart and return local phone feedback observed before Stop');
  assert.equal(result.requests.length, 0, 'Standing warmup must not dispatch a rep review');
  await sender.evaluate(() => window.qaPlayFixture());
  await waitBounded(firstRequest, 45000, 'The single fixture produced no completed rep review request');
  stoppedAt = await receiver.evaluate(() => { const at = Date.now(); document.querySelector('#stop').click(); return at; });
  result.stoppedAt = stoppedAt;
  checkpoint('Stop clicked immediately after first provider dispatch');
  await receiver.waitForFunction(() => document.querySelector('#video').controls && document.querySelector('#video').src.startsWith('blob:'), null, { timeout: 15000 });
  await receiver.locator('#saved-sessions a').first().waitFor({ timeout: 15000 }); initial = await summary();
  assert.ok(initial?.bytes > 0 && initial.hash === initial.actualHash, 'Initial saved recording hash must verify');
  await sender.waitForFunction(() => window.qaStream.getTracks().every(track => track.readyState === 'ended'), null, { timeout: 15000 });
  checkpoint('Capture stopped, recording saved and sender tracks ended');
  await receiver.waitForFunction(() => document.querySelector('#ai-feed').children.length > 0 && !document.querySelector('#ai-queue [data-status="analyzing"]') && !document.querySelector('#ai-queue [data-status="queued"]'), null, { timeout: 180000 });
  let final;
  const deadline = Date.now() + 15000;
  do { final = await summary(); if (final?.noteCount > 0 && final.reviews.every(review => review.state === 'ready')) break; await new Promise(resolve => setTimeout(resolve, 250)); } while (Date.now() < deadline);
  await Promise.allSettled(responseTasks);
  assert.ok(result.requests.length >= 1 && result.requests.length <= 2);
  assert.ok(result.responses.length >= 1 && result.responses.every(response => response.status === 200 && response.at > stoppedAt), 'Real provider response must arrive after Stop; a fast-response race does not prove the regression');
  assert.equal(final.id, initial.id); assert.equal(final.hash, initial.hash); assert.equal(final.actualHash, initial.actualHash); assert.equal(final.bytes, initial.bytes);
  assert.ok(final.noteCount > 0 && final.reviews.every(review => review.state === 'ready') && final.evidenceCount > 0);
  const ui = await receiver.evaluate(() => ({ cards: document.querySelector('#ai-feed').children.length,
    duplicateReadyRows: document.querySelectorAll('#ai-queue [data-status="ready"]').length,
    diagnosticsPresent: document.querySelector('#live-diagnostics').children.length > 0,
    states: window.qaReviewStates, samples: window.qaSampleCount, cameraOff: document.querySelector('#stop').hidden }));
  assert.ok(ui.cards > 0 && ui.cameraOff && ui.diagnosticsPresent && ui.samples > 0); assert.equal(ui.duplicateReadyRows, 0);
  assert.ok(['queued', 'analyzing', 'ready'].every(state => ui.states.some(event => event.state === state)));
  assert.deepEqual(result.errors, []);
  result.proof = { responseAfterStop: true, sameSavedSession: true, unchangedVerifiedVideoHash: true,
    savedNotes: final.noteCount, completedReps: final.repCount, savedEvidenceImages: final.evidenceCount,
    recordingBytes: final.bytes, initialRevision: initial.revision, finalRevision: final.revision,
    retainedCoachingCards: ui.cards, diagnosticStates: ui.states.map(({ state }) => state), analyzedSamples: ui.samples,
    chartPopulatedBeforeStop: true, returnedLocalPhoneFeedback: true, tracksStopped: true };
  checkpoint('Real delayed AI appended after Stop and persisted against the unchanged recording'); result.status = 'passed';
} catch (error) {
  failure = error; result.status = 'failed'; result.failure = safe(error.message);
  if (receiver && !receiver.isClosed()) result.ui = await receiver.evaluate(() => ({ cameraOff: document.querySelector('#stop')?.hidden, reps: document.querySelector('#count')?.textContent, cards: document.querySelector('#ai-feed')?.children.length, diagnosticStates: (window.qaReviewStates ?? []).map(({state})=>state), sampleCount: window.qaSampleCount })).catch(() => ({ unavailable: true }));
} finally {
  if (receiver && !receiver.isClosed()) await receiver.evaluate(() => { const button = document.querySelector('#stop'); if (button && !button.hidden) button.click(); }).catch(() => {});
  await browser?.close(); await Promise.allSettled(responseTasks);
  await writeFile(evidencePath, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2));
}
if (failure) process.exitCode = 1;
