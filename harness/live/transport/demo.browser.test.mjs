import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createTransportServer } from './server.mjs';
const server = createTransportServer({ port: 0 });
const origin = await server.listen();
let browser;
async function pairing() {
  const room = await (await fetch(`${origin}/rooms`, { method: 'POST' })).json();
  await fetch(`${origin}/rooms/${room.roomId}/join`, { method: 'POST', headers: { Authorization: `Bearer ${room.receiverInvite}` }, body: JSON.stringify({ role: 'receiver' }) });
  return `${origin}/phone#${new URLSearchParams({ room: room.roomId, invite: room.senderInvite })}`;
}
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.permissions = [];
    navigator.mediaDevices.getUserMedia = () => new Promise(resolve => window.permissions.push(resolve));
  });
  await page.goto(await pairing());
  await page.locator('#start').click(); await page.waitForFunction(() => window.permissions.length === 1);
  await page.locator('#stop').click();
  const next = await pairing(); await page.evaluate(url => { location.hash = new URL(url).hash; }, next);
  await page.locator('#start').click(); await page.waitForFunction(() => window.permissions.length === 2);
  await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
    window.oldStream = canvas.captureStream(10); window.permissions[0](window.oldStream);
  });
  await page.waitForFunction(() => window.oldStream.getTracks().every(track => track.readyState === 'ended'));
  assert.equal(await page.locator('#start').isDisabled(), true, 'Late first permission result must not reset the second session');
  assert.equal(await page.locator('#stop').isEnabled(), true);
  await page.locator('#stop').click();
  console.log('Phone Stop/restart ignores stale permission result and ends its tracks.');
} finally { await browser?.close(); await server.close(); }
