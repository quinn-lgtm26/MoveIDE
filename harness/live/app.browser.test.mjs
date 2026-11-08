import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createTransportServer } from './transport/server.mjs';
import { createReceiverProxy } from './transport/receiver-proxy.mjs';
let testTransportOrigin = null;
const server = await createServer({
  configFile: new URL('../vite.config.mjs', import.meta.url).pathname,
  server: { host: '127.0.0.1', port: 0, strictPort: false, watch: null },
  plugins: [{
    name: 'integrated-receiver-test', enforce: 'pre',
    configureServer(vite) {
      let proxy, proxiedOrigin;
      // Intercept before the production proxy. Never fall through to a running user demo.
      vite.middlewares.use((request, response, next) => {
        if (!/^\/rooms(?:\/|\?|$)/.test(request.url ?? '')) return next();
        if (!testTransportOrigin) { response.writeHead(503, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'Isolated test transport is not running.' })); return; }
        if (proxiedOrigin !== testTransportOrigin) {
          proxy = createReceiverProxy({ origin: `http://127.0.0.1:${vite.httpServer.address().port}`, upstreamOrigin: testTransportOrigin });
          proxiedOrigin = testTransportOrigin;
        }
        proxy(request, response, next);
      });
    },
  }],
});
let browser, transport;
try {
  await server.listen();
  // Source edits in other work streams must not reload a running motion fixture.
  await server.watcher.close();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [], sends = [];
  let holdNextRequest = false, announceHeldRequest, releaseHeldResponse, connectionState = 'connected';
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/connection', route => route.fulfill({ json: { state: connectionState } }));
  await page.route('**/api/models', route => route.fulfill({ json: [{ id: 'mock-model', label: 'Mock test model' }] }));
  await page.route('**/api/interpret', async route => {
    const body = route.request().postDataJSON(); sends.push(body);
    assert.equal(body.packet.repIds.length, 1);
    assert.equal(body.images.length, 3, 'The complete fixture rep must include exact descent, bottom and ascent JPEGs');
    for (const image of body.images) assert.ok(body.packet.evidence.some(item => item.timestampMs === image.timestampMs && item.id === image.id));
    const evidenceIds = [body.packet.evidence[0].id];
    if (holdNextRequest) { holdNextRequest = false; announceHeldRequest(); await new Promise(resolve => { releaseHeldResponse = resolve; }); }
    await route.fulfill({ json: { observations: [{ text: 'Synthetic test observation.', evidenceIds }], nextFocus: { text: 'Keep the same camera position.', evidenceIds }, uncertainty: 'Mock AI response for integration testing only.' } });
  });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const source = document.createElement('video'); source.src = '/fixtures/squat/clear-squat.mp4'; source.loop = true; source.muted = true;
      document.body.append(source); source.style.display = 'none';
      await source.play();
      const capture = document.createElement('canvas'); capture.width = source.videoWidth; capture.height = source.videoHeight;
      const context = capture.getContext('2d'); let stream;
      const draw = () => { if (stream?.getVideoTracks()[0]?.readyState === 'ended') return; context.drawImage(source, 0, 0, capture.width, capture.height); requestAnimationFrame(draw); };
      draw(); stream = capture.captureStream(30);
      window.resizeSynthetic = () => { capture.width = Math.round(source.videoWidth / 2); capture.height = Math.round(source.videoHeight / 2); };
      window.syntheticVideo = source; window.syntheticStream = stream;
      return stream;
    };
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/harness/live/`);
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#knee').textContent !== '—', null, { timeout: 60_000 });
  await page.waitForFunction(() => document.querySelector('#ai-feed').textContent.includes('Synthetic test observation'), null, { timeout: 40_000 });
  await page.waitForFunction(() => document.querySelector('#ai-feed').children.length >= 2, null, { timeout: 40_000 });
  let cards = await page.locator('#ai-feed > li').count();
  assert.ok(cards >= 2 && cards <= 6);
  assert.equal(await page.locator('#ai-feed').evaluate(feed => new Set([...feed.children].map(card => card.dataset.repKey)).size === feed.children.length), true);
  assert.equal(await page.locator('#ai-feed details[open]').count(), 0);
  assert.ok((await page.locator('#ai').innerText()).length <= 192);
  assert.ok(sends.length > 0 && sends.length <= 6);
  // A complete, frozen rep remains valid historical evidence across camera-size adaptation.
  const previousEpoch = await page.locator('#video').getAttribute('data-analysis-epoch');
  let heldTimeout;
  const held = new Promise((resolve, reject) => { announceHeldRequest = resolve; heldTimeout = setTimeout(() => reject(new Error('No eligible rep reached the deferred AI check.')), 45000); });
  holdNextRequest = true; await held.finally(() => clearTimeout(heldTimeout));
  await page.evaluate(() => window.resizeSynthetic());
  await page.waitForFunction(epoch => Number(document.querySelector('#video').dataset.analysisEpoch) > Number(epoch), previousEpoch, { timeout: 15000 });
  assert.equal(await page.locator('#stop').isVisible(), true, 'A frame-size change must not stop the session');
  releaseHeldResponse();
  await page.waitForFunction(count => document.querySelector('#ai-feed').children.length > count, cards, { timeout: 10000 });
  assert.equal(await page.locator('#ai-feed > li').last().getAttribute('data-epoch'), previousEpoch, 'Delayed review remains labeled with its historical view');
  await page.waitForFunction(() => document.querySelector('#knee').textContent !== '—' && document.querySelector('#status').textContent.startsWith('Live'), null, { timeout: 15000 });
  // Prior-view queued reps remain historical; the six-review budget may already be reserved.
  await page.waitForFunction(() => !document.querySelector('#ai-queue [data-status=analyzing]') && !document.querySelector('#ai-queue [data-status=queued]'), null, { timeout: 60000 });
  cards = await page.locator('#ai-feed > li').count();
  assert.equal(await page.locator('#error').innerText(), '');
  const observed = await page.locator('#latency').innerText();
  await page.screenshot({ path: new URL('./app-qa.png', import.meta.url).pathname });
  // Freeze the analyzed element to simulate no newly presented camera frames.
  await page.evaluate(() => { window.syntheticVideo.pause(); document.querySelector('#video').pause(); });
  await page.waitForFunction(() => document.querySelector('#knee').textContent === '—' && document.querySelector('#feedback').dataset.state === 'unknown', null, { timeout: 3000 });
  await page.locator('#stop').click();
  assert.equal(await page.evaluate(() => window.syntheticStream.getTracks().every(track => track.readyState === 'ended')), true);
  assert.equal(await page.locator('#start').isEnabled(), true);
  assert.equal(await page.locator('#ai-feed > li').count(), cards, 'Stop preserves accepted coaching cards');
  await page.waitForFunction(() => document.querySelector('#video').controls && document.querySelector('#video').src.startsWith('blob:'));
  assert.ok(await page.locator('#review-measurements tr').count() > 0, 'Historical measured samples remain reviewable after Stop');
  assert.match(await page.locator('#review-timing').innerText(), /approximate/);
  await page.evaluate(() => document.querySelector('#video').play());
  await page.waitForFunction(() => document.querySelector('#video').currentTime > .1);
  await page.evaluate(() => document.querySelector('#video').pause());
  assert.equal(await page.locator('#knee').innerText(), '—', 'Replay does not restore stale current measurements');
  await page.locator('#saved-sessions a').first().waitFor({ timeout: 15000 });
  const persisted = await page.evaluate(async () => {
    const { getSession } = await import('/harness/history/index.mjs');
    const id = new URL(document.querySelector('#saved-sessions a').href).searchParams.get('session');
    const saved = await getSession(id);
    return { bytes: saved.video?.size, samples: saved.live.samples.length, notes: saved.live.notes.length, reps: saved.live.reps.length,
      evidence: saved.evidenceImages.length, approximate: saved.live.timing.alignment, mapping: saved.live.timing.firstSampleMapping,
      epochs: [...new Set(saved.live.samples.map(sample => sample.viewEpoch))], source: saved.metadata.source };
  });
  assert.ok(persisted.bytes > 0 && persisted.samples > 0 && persisted.reps > 0);
  assert.equal(persisted.notes, cards); assert.ok(persisted.evidence >= cards && persisted.evidence <= 18);
  assert.equal(persisted.approximate, 'approximate'); assert.ok(persisted.mapping); assert.ok(persisted.epochs.length >= 2);
  assert.equal(persisted.source, 'local');
  await page.locator('#save-local').uncheck();
  connectionState = 'disconnected';
  await page.locator('#start').click();
  assert.equal(await page.locator('#ai-feed > li').count(), 0, 'New session clears previous cards');
  assert.equal(await page.locator('#video').getAttribute('src'), null, 'New Start clears the previous replay');
  assert.equal(await page.locator('#session-review').isHidden(), true);
  await page.waitForFunction(() => document.querySelector('#knee').textContent !== '—', null, { timeout: 60000 });
  assert.ok((await page.locator('#ai').innerText()).includes('Connect ChatGPT'), 'Stable local tracking must not promise AI when disconnected');
  await page.locator('#stop').click(); connectionState = 'connected';
  assert.equal(await page.locator('#saved-sessions .save-result').count(), 1, 'Opting out saves no new session');
  await page.locator('#save-local').check();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile layout must fit the viewport');
  assert.deepEqual(errors, []);
  if (process.env.MOVEIDE_TEST_LOCAL_ONLY === '1') {
    console.log(JSON.stringify({ result: 'passed', localOnly: true, aiRequests: sends.length, stackedCards: cards, adaptiveDimensions: true, historicalReplyPreserved: true, offlineStatusPreserved: true, threePhaseJpegs: true, preservedOnStop: true, resetOnNewSession: true, stalePoseCleared: true, tracksStopped: true }));
  } else {
  const localRequests = sends.length;
  // Real dedicated signalling + isolated ephemeral receiver proxy; no physical camera or external tunnel.
  transport = createTransportServer({ port: 0 });
  testTransportOrigin = await transport.listen();
  await page.locator('#source').selectOption('phone');
  await page.locator('#start').click();
  await page.locator('#phone-setup').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#start').isEnabled(), true);
  assert.equal(await page.locator('#phone-url').inputValue(), '');
  await transport.close(); transport = null; testTransportOrigin = null;

  // A reserved HTTPS label exercises UI configuration; actual test sender uses local HTTP.
  // This deliberately makes no claim about trusted iPhone HTTPS or physical Wi-Fi performance.
  transport = createTransportServer({ port: 0, publicOrigin: 'https://phone.moveide.test', staticFiles: {
    '/sample.mp4': { path: new URL('../../fixtures/squat/clear-squat.mp4', import.meta.url).pathname, contentType: 'video/mp4' },
  } });
  const transportOrigin = await transport.listen(); testTransportOrigin = transportOrigin;
  await page.setViewportSize({ width: 1400, height: 1100 });
  await page.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#phone-url').value.startsWith('https://'));
  const phoneUrl = await page.locator('#phone-url').inputValue();
  await page.locator('#pairing-qr').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#phone-qr').evaluate(canvas => { const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; let dark = 0, light = 0; for (let i = 0; i < pixels.length; i += 4) { if (pixels[i] < 64 && pixels[i + 3]) dark++; if (pixels[i] > 240 && pixels[i + 3]) light++; } return dark > 1000 && light > 1000; }), true, 'Pairing QR must contain visible dark modules and a light quiet zone');
  assert.equal(await page.locator('#source').isDisabled(), true);
  const senderContext = await browser.newContext();
  const sender = await senderContext.newPage();
  sender.on('pageerror', error => errors.push(error.message));
  await sender.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async constraints => {
      if (constraints.audio !== false) throw new Error('Phone must not request audio');
      const source = document.createElement('video'); source.src = '/sample.mp4'; source.loop = true; source.muted = true;
      document.body.append(source); source.style.display = 'none'; await source.play();
      window.syntheticVideo = source; window.syntheticStream = source.captureStream(); return window.syntheticStream;
    };
  });
  await sender.goto(`${transportOrigin}/phone${new URL(phoneUrl).hash}`);
  await sender.evaluate(() => {
    window.feedbackHistory = [];
    new MutationObserver(() => window.feedbackHistory.push([...document.querySelectorAll('#feedback,#ai-feedback')].map(node => node.textContent).join(' '))).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await sender.locator('#start').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Live · iPhone') && document.querySelector('#knee').textContent !== '—', null, { timeout: 60_000 });
  await sender.waitForFunction(() => window.feedbackHistory.some(text => text.includes('Local') && text.includes('Knee bend')), null, { timeout: 20_000 });
  await sender.waitForFunction(() => window.feedbackHistory.some(text => text.includes('AI') && text.includes('Keep the same camera position.')), null, { timeout: 40_000 });
  assert.ok(sends.length > localRequests);
  const phoneObserved = await page.locator('#latency').innerText();
  await page.locator('#stop').click();
  await sender.waitForFunction(() => window.syntheticStream.getTracks().every(track => track.readyState === 'ended') && document.querySelector('#feedback').textContent === '' && (!document.querySelector('#ai-feedback') || document.querySelector('#ai-feedback').textContent === ''), null, { timeout: 10_000 });
  assert.equal(await page.locator('#phone-url').inputValue(), '');
  assert.equal(await page.locator('#pairing').isVisible(), false);
  assert.equal(await page.locator('#pairing-qr').isVisible(), false);
  assert.equal(await page.locator('#phone-qr').evaluate(canvas => canvas.width * canvas.height), 0);
  assert.equal(await page.evaluate(() => document.querySelector('#video').srcObject), null);
  assert.equal(await page.locator('#start').isEnabled(), true);
  assert.deepEqual(errors, []);
  await senderContext.close();
  // Force a slow real QR encoder, then stop and start a new generation.
  await page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname.endsWith('/qrcode.js'));
    if (!resource) throw new Error('QR dependency was not loaded locally');
    const QRCode = (await import(resource.name)).default;
    window.restoreQr = () => { QRCode.toCanvas = window.originalQr; };
    window.originalQr = QRCode.toCanvas;
    QRCode.toCanvas = async (...args) => { await new Promise(resolve => { window.releaseOldQr = resolve; }); return window.originalQr(...args); };
  });
  await page.locator('#start').click();
  await page.waitForFunction(() => typeof window.releaseOldQr === 'function');
  await page.locator('#stop').click();
  await page.evaluate(() => window.restoreQr());
  await page.locator('#start').click();
  await page.locator('#pairing-qr').waitFor({ state: 'visible' });
  const currentQr = await page.locator('#phone-qr').evaluate(canvas => canvas.toDataURL());
  await page.evaluate(() => window.releaseOldQr());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#phone-qr').evaluate(canvas => canvas.toDataURL()), currentQr, 'A late QR from an old session cannot replace the current invite');
  await page.locator('#stop').click();
  assert.equal(await page.locator('#phone-qr').evaluate(canvas => canvas.width * canvas.height), 0);
  // Stop while the server has created a room but its response is still in flight.
  let announcePairing;
  const createdWhilePending = new Promise(resolve => { announcePairing = resolve; });
  await page.route('**/rooms', async route => {
    const response = await route.fetch();
    const created = await response.json(); announcePairing(created);
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.fulfill({ response });
  });
  await page.locator('#start').click();
  const pendingPairing = await createdWhilePending;
  const revoked = page.waitForResponse(response => response.request().method() === 'DELETE' && response.url().endsWith(`/rooms/${pendingPairing.roomId}`) && response.status() === 200);
  await page.locator('#stop').click(); await revoked;
  assert.equal(await page.locator('#phone-url').inputValue(), '');
  assert.equal(await page.locator('#pairing').isVisible(), false);
  assert.equal(await page.locator('#start').isEnabled(), true);
  await page.unroute('**/rooms');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'passed', observed, phoneObserved, aiRequests: sends.length, syntheticCamera: true, realWebRTC: true, adaptiveDimensions: true, historicalReplyPreserved: true, offlineStatusPreserved: true, threePhaseJpegs: true, twoBrowserContexts: true, phoneLocalFeedback: true, phoneAIResponse: true, localQr: true, staleQrSuppressed: true, pendingPairingRevoked: true, missingHttpsGuidance: true, stalePoseCleared: true, tracksStopped: true, physicalIPhoneTested: false }));
  }
} finally { await browser?.close(); await transport?.close(); await server.close(); }
