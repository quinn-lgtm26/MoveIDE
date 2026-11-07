import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransportServer } from './server.mjs';

test('room authentication, role limits, payload validation, revoke and origin isolation', async () => {
  const service = createTransportServer({ port: 0 });
  const origin = await service.listen();
  const request = (path, { token, body, method = 'POST', headers = {} } = {}) => fetch(`${origin}${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  try {
    assert.equal((await request('/rooms', { headers: { Origin: 'https://evil.invalid' } })).status, 403);
    assert.equal((await request('/rooms/not-a-room/join')).status, 404);
    assert.equal((await request('/oauth/token')).status, 404);
    const room = await (await request('/rooms')).json();
    const path = `/rooms/${room.roomId}`;
    assert.equal((await request(`${path}/join`, { token: 'x'.repeat(43), body: { role: 'sender' } })).status, 403);
    const receiver = await (await request(`${path}/join`, { token: room.receiverInvite, body: { role: 'receiver' } })).json();
    const sender = await (await request(`${path}/join`, { token: room.senderInvite, body: { role: 'sender' } })).json();
    assert.equal((await request(`${path}/join`, { token: room.senderInvite, body: { role: 'sender' } })).status, 409);
    assert.equal((await request(`${path}/signal`, { token: sender.token, body: null })).status, 400);
    assert.equal((await request(`${path}/signal`, { token: sender.token, body: { type: 'answer', sdp: 'bad-role' } })).status, 400);
    assert.equal((await request(`${path}/signal`, { token: sender.token, body: { type: 'offer', sdp: 'x'.repeat(70_001) } })).status, 413);
    assert.equal((await request(path, { token: receiver.token, method: 'DELETE' })).status, 200);
    assert.equal((await request(`${path}/join`, { token: room.senderInvite, body: { role: 'sender' } })).status, 410);
  } finally { await service.close(); }
});

test('expiry and server shutdown close event streams', async () => {
  const service = createTransportServer({ port: 0, ttlMs: 100 });
  const origin = await service.listen();
  const room = await (await fetch(`${origin}/rooms`, { method: 'POST' })).json();
  const join = await (await fetch(`${origin}/rooms/${room.roomId}/join`, { method: 'POST', headers: { Authorization: `Bearer ${room.receiverInvite}` }, body: JSON.stringify({ role: 'receiver' }) })).json();
  const events = await fetch(`${origin}/rooms/${room.roomId}/events`, { headers: { Authorization: `Bearer ${join.token}` } });
  assert.match(await events.text(), /expired/);
  await service.close();
  const next = createTransportServer({ port: 0 });
  const nextOrigin = await next.listen();
  const second = await (await fetch(`${nextOrigin}/rooms`, { method: 'POST' })).json();
  const peer = await (await fetch(`${nextOrigin}/rooms/${second.roomId}/join`, { method: 'POST', headers: { Authorization: `Bearer ${second.receiverInvite}` }, body: JSON.stringify({ role: 'receiver' }) })).json();
  const stream = await fetch(`${nextOrigin}/rooms/${second.roomId}/events`, { headers: { Authorization: `Bearer ${peer.token}` } });
  const text = stream.text();
  await next.close();
  assert.match(await text, /server-stopped/);
});
