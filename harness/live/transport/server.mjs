import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const secret = () => randomBytes(32).toString('base64url');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const reject = (status, message) => Object.assign(new Error(message), { status });
const MAX_BODY = 70_000;

async function jsonBody(request) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) throw reject(413, 'Signalling message is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks)); }
  catch { throw reject(400, 'Expected JSON.'); }
}

/** Dedicated, credential-free signalling server. No app/OAuth middleware is mounted. */
export function createTransportServer({ host = '127.0.0.1', port = 4176, publicOrigin, staticFiles = {}, ttlMs = 600_000 } = {}) {
  if (publicOrigin && new URL(publicOrigin).origin !== publicOrigin) throw new Error('publicOrigin must be an origin without a path.');
  if (publicOrigin && new URL(publicOrigin).protocol !== 'https:' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(new URL(publicOrigin).hostname)) throw new Error('A public phone origin must use HTTPS.');
  if (!Number.isInteger(ttlMs) || ttlMs < 100 || ttlMs > 600_000) throw new Error('Room expiry must be between 100 ms and 10 minutes.');
  const rooms = new Map();
  const emit = (peer, event) => {
    if (!peer) return;
    if (peer.events) {
      if (peer.events.writableLength > 140_000) throw reject(429, 'Signalling receiver is too slow.');
      peer.events.write(`data: ${JSON.stringify(event)}\n\n`);
    } else {
      if (peer.queue.length >= 128) throw reject(429, 'Signalling queue is full.');
      peer.queue.push(event);
    }
  };
  const revoke = (id, reason = 'stopped') => {
    const room = rooms.get(id);
    if (!room) return;
    rooms.delete(id);
    clearTimeout(room.timer);
    for (const peer of Object.values(room.peers)) {
      clearInterval(peer.heartbeat);
      if (peer.events) {
        peer.events.end(`data: ${JSON.stringify({ type: 'closed', reason })}\n\n`);
      }
    }
  };
  const server = createServer(async (request, response) => {
    const reply = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'");
    try {
      const localOrigin = `http://${host}:${server.address().port}`;
      const origin = publicOrigin ?? localOrigin;
      if (![new URL(origin).host, new URL(localOrigin).host].includes(request.headers.host)) throw reject(403, 'Unexpected host.');
      if ((request.headers.origin && request.headers.origin !== origin && request.headers.origin !== localOrigin) ||
          request.headers['sec-fetch-site'] === 'cross-site') throw reject(403, 'Use the same-origin pairing page.');
      const url = new URL(request.url, localOrigin);
      const assets = { '/': 'receiver.html', '/phone': 'phone.html', '/client.mjs': 'client.mjs', '/demo.mjs': 'demo.mjs' };
      if (request.method === 'GET' && Object.hasOwn(staticFiles, url.pathname)) {
        const asset = staticFiles[url.pathname];
        response.writeHead(200, { 'Content-Type': asset.contentType });
        response.end(await readFile(asset.path));
        return;
      }
      if (request.method === 'GET' && Object.hasOwn(assets, url.pathname)) {
        response.writeHead(200, { 'Content-Type': assets[url.pathname].endsWith('.mjs') ? 'text/javascript' : 'text/html' });
        response.end(await readFile(new URL(assets[url.pathname], import.meta.url)));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/rooms') {
        if (rooms.size >= 16) throw reject(429, 'Too many active pairing rooms.');
        const id = randomBytes(16).toString('hex');
        const receiverInvite = secret(), senderInvite = secret();
        const expiresAt = Date.now() + ttlMs;
        const room = { receiverInvite, senderInvite, expiresAt, peers: {}, messages: 0 };
        room.timer = setTimeout(() => revoke(id, 'expired'), ttlMs);
        room.timer.unref();
        rooms.set(id, room);
        reply(201, { roomId: id, receiverInvite, senderInvite, expiresAt, publicOrigin: origin });
        return;
      }
      const match = /^\/rooms\/([a-f0-9]{32})(?:\/(join|events|signal))?$/.exec(url.pathname);
      if (!match) throw reject(404, 'Not found.');
      const [, id, action] = match;
      const room = rooms.get(id);
      if (!room || room.expiresAt <= Date.now()) throw reject(410, 'Pairing expired. Start a new session.');
      const auth = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization ?? '')?.[1];
      if (request.method === 'POST' && action === 'join') {
        const body = await jsonBody(request);
        const role = body?.role;
        if (!['sender', 'receiver'].includes(role) || !same(auth, room[`${role}Invite`])) throw reject(403, 'Invalid pairing invite.');
        if (room.peers[role]) throw reject(409, 'This pairing role is already connected.');
        const token = secret();
        room.peers[role] = { token, queue: [], events: null };
        reply(201, { token, expiresAt: room.expiresAt });
        return;
      }
      const role = ['sender', 'receiver'].find(role => same(auth, room.peers[role]?.token));
      if (!role) throw reject(403, 'Invalid session.');
      const peer = room.peers[role];
      if (request.method === 'DELETE' && !action) {
        revoke(id);
        reply(200, { stopped: true });
        return;
      }
      if (request.method === 'GET' && action === 'events') {
        if (peer.events) throw reject(409, 'An event stream is already open.');
        response.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        response.write(': connected\n\n');
        peer.events = response;
        peer.heartbeat = setInterval(() => {
          if (response.writableLength > 140_000) revoke(id, 'receiver-too-slow');
          else response.write(': heartbeat\n\n');
        }, 20_000);
        peer.heartbeat.unref();
        for (const item of peer.queue.splice(0)) emit(peer, item);
        response.on('close', () => { if (rooms.has(id)) revoke(id, 'peer-disconnected'); });
        return;
      }
      if (request.method === 'POST' && action === 'signal') {
        const body = await jsonBody(request);
        if (!body || typeof body !== 'object') throw reject(400, 'Invalid signalling message.');
        const other = room.peers[role === 'sender' ? 'receiver' : 'sender'];
        if (!other) throw reject(409, 'Waiting for the other device.');
        if (++room.messages > 256) { revoke(id, 'message-limit'); throw reject(429, 'Session signalling limit reached.'); }
        let event;
        if ((role === 'sender' && body.type === 'offer') || (role === 'receiver' && body.type === 'answer')) {
          if (typeof body.sdp !== 'string' || body.sdp.length > 65_000) throw reject(400, 'Invalid session description.');
          event = { type: body.type, sdp: body.sdp };
        } else if (body.type === 'candidate' && body.candidate && typeof body.candidate.candidate === 'string' &&
          body.candidate.candidate.length <= 2048 &&
          (body.candidate.sdpMid === null || typeof body.candidate.sdpMid === 'string' && body.candidate.sdpMid.length <= 64) &&
          (body.candidate.sdpMLineIndex === null || Number.isInteger(body.candidate.sdpMLineIndex) && body.candidate.sdpMLineIndex >= 0 && body.candidate.sdpMLineIndex <= 16)) {
          event = { type: 'candidate', candidate: { candidate: body.candidate.candidate, sdpMid: body.candidate.sdpMid, sdpMLineIndex: body.candidate.sdpMLineIndex } };
        } else throw reject(400, 'Invalid signalling message.');
        emit(other, event);
        reply(200, { accepted: true });
        return;
      }
      throw reject(405, 'Method not allowed.');
    } catch (error) {
      if (!response.headersSent) reply(error.status ?? 500, { error: error.status ? error.message : 'Transport unavailable.' });
      else response.destroy();
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  return {
    server,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.off('error', reject); resolve(`http://${host}:${server.address().port}`); });
    }),
    close: async () => {
      for (const id of [...rooms.keys()]) revoke(id, 'server-stopped');
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const service = createTransportServer({
    host: process.env.MOVEIDE_STREAM_HOST || '127.0.0.1',
    port: Number(process.env.MOVEIDE_STREAM_PORT || 4176),
    publicOrigin: process.env.MOVEIDE_STREAM_PUBLIC_ORIGIN,
  });
  console.log(`Video pairing prototype: ${await service.listen()}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await service.close(); process.exit(); });
}
