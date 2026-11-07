import { request as httpRequest } from 'node:http';
import { Transform } from 'node:stream';

const UPSTREAM = 'http://127.0.0.1:4176';
const MAX_BODY = 70_000;
const LOCAL_PEERS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Mount on the private local receiver server. Never mount the provider on the public phone server. */
export function createReceiverProxy({ origin } = {}) {
  const local = new URL(origin);
  if (local.origin !== origin || local.protocol !== 'http:' || local.hostname !== '127.0.0.1') {
    throw new Error('Receiver origin must be an exact http://127.0.0.1:PORT origin.');
  }
  return function receiverProxy(request, response, next) {
    const path = request.url ?? '';
    if (!/^\/rooms(?:\/|\?|$)/.test(path)) { next(); return; }
    const reply = (status, message) => {
      if (response.headersSent || response.destroyed) { response.destroy(); return; }
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: message }));
    };
    const fetchSite = request.headers['sec-fetch-site'];
    const suppliedOrigin = request.headers.origin;
    if (!LOCAL_PEERS.has(request.socket.remoteAddress) || request.headers.host !== local.host ||
        (suppliedOrigin !== undefined && suppliedOrigin !== origin) ||
        (fetchSite !== undefined && fetchSite !== 'same-origin') ||
        (suppliedOrigin === undefined && fetchSite !== 'same-origin') ||
        ['navigate', 'no-cors'].includes(request.headers['sec-fetch-mode'])) {
      reply(403, 'Use the local receiver page on its own origin.'); return;
    }
    const route = /^\/rooms(?:\/([a-f0-9]{32})(?:\/(join|events|poll|signal))?)?$/.exec(path);
    if (!route) { reply(404, 'Unknown signalling route.'); return; }
    const expectedMethod = !route[1] ? 'POST' : !route[2] ? 'DELETE' : ['events', 'poll'].includes(route[2]) ? 'GET' : 'POST';
    if (request.method !== expectedMethod) { reply(405, 'Method not allowed for this signalling route.'); return; }
    const declaredLength = Number(request.headers['content-length'] ?? 0);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > MAX_BODY) {
      reply(413, 'Signalling message is too large.'); return;
    }
    const headers = { Host: new URL(UPSTREAM).host, Origin: UPSTREAM, 'Sec-Fetch-Site': 'same-origin' };
    // Deliberately do not forward cookies, proxy headers, OAuth data or arbitrary destinations.
    for (const name of ['authorization', 'content-type', 'content-length']) {
      if (request.headers[name] !== undefined) headers[name] = request.headers[name];
    }
    let receivedBytes = 0, upstreamResponse;
    const body = new Transform({
      transform(chunk, encoding, callback) {
        receivedBytes += chunk.length;
        callback(receivedBytes > MAX_BODY ? new Error('body-limit') : null, chunk);
      },
    });
    const upstream = httpRequest(`${UPSTREAM}${path}`, { method: request.method, headers, agent: false }, remote => {
      upstreamResponse = remote;
      upstream.setTimeout(route[2] === 'events' ? 30_000 : 10_000);
      const responseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
      for (const name of ['content-type', 'x-accel-buffering']) if (remote.headers[name]) responseHeaders[name] = remote.headers[name];
      response.writeHead(remote.statusCode ?? 502, responseHeaders);
      response.flushHeaders();
      remote.on('error', () => response.destroy());
      remote.pipe(response);
    });
    upstream.setTimeout(route[2] === 'poll' ? 20_000 : 10_000, () => upstream.destroy(new Error('signalling-timeout')));
    upstream.on('error', () => {
      if (!response.destroyed && !response.writableEnded) reply(502, 'Phone signalling is unavailable. Start the dedicated local transport server.');
    });
    body.on('error', () => {
      request.unpipe(body); request.resume();
      reply(413, 'Signalling message is too large.');
      upstream.destroy();
    });
    request.on('aborted', () => { body.destroy(); upstream.destroy(); upstreamResponse?.destroy(); });
    request.on('error', () => { body.destroy(); upstream.destroy(); upstreamResponse?.destroy(); });
    response.on('close', () => {
      // Closing a receiver SSE must close the upstream SSE so its room is revoked.
      if (!response.writableFinished) { body.destroy(); upstream.destroy(); upstreamResponse?.destroy(); }
    });
    request.pipe(body).pipe(upstream);
  };
}
