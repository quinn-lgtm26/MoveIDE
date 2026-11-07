import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransportServer } from './server.mjs';

test('phone poll authenticates, waits, delivers events, rejects duplicates and stops on revoke', async () => {
  const service = createTransportServer({ port: 0, pollWaitMs: 150, phoneLeaseMs: 500 });
  const origin = await service.listen();
  const call = (path, { method = 'POST', token, body, signal } = {}) => fetch(`${origin}${path}`, {
    method, signal, headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    const room = await (await call('/rooms')).json(), path = `/rooms/${room.roomId}`;
    const sender = await (await call(`${path}/join`, { token: room.senderInvite, body: { role: 'sender' } })).json();
    const receiver = await (await call(`${path}/join`, { token: room.receiverInvite, body: { role: 'receiver' } })).json();
    assert.equal((await call(`${path}/poll`, { method: 'GET', token: room.senderInvite })).status, 403);
    assert.equal((await call(`${path}/poll`, { method: 'GET', token: receiver.token })).status, 403);
    const pending = call(`${path}/poll`, { method: 'GET', token: sender.token });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal((await call(`${path}/poll`, { method: 'GET', token: sender.token })).status, 409);
    assert.equal((await call(`${path}/signal`, { token: receiver.token, body: { type: 'answer', sdp: 'queued-answer' } })).status, 200);
    assert.deepEqual(await (await pending).json(), { events: [{ type: 'answer', sdp: 'queued-answer' }] });
    assert.deepEqual(await (await call(`${path}/poll`, { method: 'GET', token: sender.token })).json(), { events: [] });
    const cancel = new AbortController();
    const disconnected = call(`${path}/poll`, { method: 'GET', token: sender.token, signal: cancel.signal }).catch(error => error.name);
    await new Promise(resolve => setTimeout(resolve, 20)); cancel.abort(); await disconnected;
    await new Promise(resolve => setTimeout(resolve, 20));
    const final = call(`${path}/poll`, { method: 'GET', token: sender.token });
    await new Promise(resolve => setTimeout(resolve, 20));
    await call(path, { method: 'DELETE', token: receiver.token });
    assert.deepEqual(await (await final).json(), { events: [{ type: 'closed', reason: 'stopped' }] });
  } finally { await service.close(); }
});

test('abandoned phone polling lease revokes a room without waiting for full room expiry', async () => {
  const service = createTransportServer({ port: 0, pollWaitMs: 20, phoneLeaseMs: 100 });
  const origin = await service.listen();
  try {
    const room = await (await fetch(`${origin}/rooms`, { method: 'POST' })).json();
    const path = `${origin}/rooms/${room.roomId}`;
    const joined = await (await fetch(`${path}/join`, { method: 'POST', headers: { Authorization: `Bearer ${room.senderInvite}` }, body: JSON.stringify({ role: 'sender' }) })).json();
    const headers = { Authorization: `Bearer ${joined.token}` };
    await (await fetch(`${path}/poll`, { headers })).json();
    await new Promise(resolve => setTimeout(resolve, 130));
    assert.equal((await fetch(`${path}/poll`, { headers })).status, 410);
  } finally { await service.close(); }
});
