import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createTransportServer } from './server.mjs';
import { createReceiverProxy } from './receiver-proxy.mjs';

test('private receiver proxy forwards bounded signalling only and cleans up SSE', async () => {
  const transport = createTransportServer({ port: 4176, publicOrigin: 'https://phone.example' });
  await transport.listen();
  let proxy;
  const receiver = createServer((request, response) => proxy(request, response, () => { response.writeHead(418); response.end('not proxied'); }));
  await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${receiver.address().port}`;
  proxy = createReceiverProxy({ origin });
  const request = (path, { method = 'POST', token, body, headers = {} } = {}) => fetch(`${origin}${path}`, {
    method, headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  try {
    assert.throws(() => createReceiverProxy({ origin: 'https://foreign.example' }));
    assert.equal((await request('/api/auth/start')).status, 418);
    assert.equal((await request('/rooms', { method: 'GET' })).status, 405);
    assert.equal((await request('/rooms?destination=https://evil.example')).status, 404);
    assert.equal((await request('/rooms', { headers: { Origin: 'https://evil.example' } })).status, 403);
    const wrongHost = await new Promise(resolve => {
      const request = httpRequest(`${origin}/rooms`, { method: 'POST', headers: { Host: 'evil.example', Origin: origin, 'Sec-Fetch-Site': 'same-origin' } }, response => { response.resume(); resolve(response.statusCode); });
      request.end();
    });
    assert.equal(wrongHost, 403);
    assert.equal((await request('/rooms', { headers: { 'Sec-Fetch-Site': 'same-site' } })).status, 403);
    assert.equal((await fetch(`${origin}/rooms`, { method: 'POST' })).status, 403);
    const room = await (await request('/rooms', { headers: { Cookie: 'provider-secret=must-not-forward' } })).json();
    assert.equal(room.publicOrigin, 'https://phone.example');
    const path = `/rooms/${room.roomId}`;
    const joined = await (await request(`${path}/join`, { token: room.receiverInvite, body: { role: 'receiver' } })).json();
    assert.ok(joined.token);
    assert.equal((await request(`${path}/signal`, { token: joined.token, body: { type: 'answer', sdp: 'x'.repeat(70_001) } })).status, 413);
    const events = await request(`${path}/events`, { method: 'GET', token: joined.token });
    const reader = events.body.getReader();
    const initial = await reader.read(); assert.match(new TextDecoder().decode(initial.value), /connected/);
    await reader.cancel();
    // Real HTTP cancellation propagates to upstream and revokes the room.
    let revoked = false;
    for (let retry = 0; retry < 30 && !revoked; retry++) {
      const result = await request(`${path}/signal`, { token: joined.token, body: { type: 'answer', sdp: 'test' } });
      revoked = result.status === 410;
      if (!revoked) await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(revoked, true);
    const unjoined = await (await request('/rooms')).json();
    assert.equal((await request(`/rooms/${unjoined.roomId}`, { method: 'DELETE', token: unjoined.receiverInvite })).status, 200);
  } finally {
    await new Promise(resolve => { receiver.close(resolve); receiver.closeAllConnections(); });
    await transport.close();
  }
});
