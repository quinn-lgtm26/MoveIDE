// Run from harness after npm ci; PLAYWRIGHT_MODULE can point to an existing Playwright installation.
import assert from 'node:assert/strict';
import { createTransportServer } from './server.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const service = createTransportServer({ port: 0 });
const origin = await service.listen();
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  const receiverContext = await browser.newContext(), senderContext = await browser.newContext();
  const receiver = await receiverContext.newPage(), sender = await senderContext.newPage();
  await Promise.all([receiver.goto(origin), sender.goto(`${origin}/phone`)]);
  const pairing = await receiver.evaluate(async () => {
    const client = await import('/client.mjs');
    const pairing = await client.createPairing();
    window.states = [];
    window.session = await client.connectReceiver(pairing, {
      onState: value => window.states.push(value),
      onStream: stream => { document.querySelector('video').srcObject = stream; },
    });
    return pairing;
  });
  await sender.evaluate(async pairing => {
    const client = await import('/client.mjs');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext('2d');
    window.draw = setInterval(() => { ctx.fillStyle = '#21d869'; ctx.fillRect(0, 0, 320, 240); ctx.fillStyle = '#fff'; ctx.fillText(String(Date.now()), 20, 20); }, 30);
    window.states = [];
    window.session = await client.connectPhone({ roomId: pairing.roomId, invite: pairing.senderInvite }, {
      stream: canvas.captureStream(20), onState: value => window.states.push(value),
    });
  }, pairing);
  await receiver.waitForFunction(() => document.querySelector('video').videoWidth === 320 && window.states.some(s => s.status === 'connected'), null, { timeout: 20_000 });
  const stats = await receiver.evaluate(async () => {
    const stats = [...(await window.session.peer.getStats()).values()];
    const inbound = stats.find(s => s.type === 'inbound-rtp' && s.kind === 'video');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext('2d'); ctx.drawImage(document.querySelector('video'), 0, 0);
    return { framesDecoded: inbound.framesDecoded, pixel: [...ctx.getImageData(160, 120, 1, 1).data] };
  });
  assert.ok(stats.framesDecoded > 0);
  assert.ok(stats.pixel[1] > 150 && stats.pixel[1] > stats.pixel[0] * 2, 'Receiver decoded green canvas frames over real WebRTC');
  await sender.evaluate(async () => { await window.session.stop(); clearInterval(window.draw); });
  await receiver.waitForFunction(() => window.session.peer.connectionState === 'closed');
  assert.equal(await sender.evaluate(() => window.session.stream.getTracks().every(t => t.readyState === 'ended')), true);
  assert.equal(await receiver.evaluate(() => document.querySelector('video').srcObject), null);
  console.log(JSON.stringify({ result: 'passed', transport: 'real RTCPeerConnection, separate browser contexts', ...stats, stop: 'tracks ended; receiver closed and cleared' }));
} finally { await browser.close(); await service.close(); }
