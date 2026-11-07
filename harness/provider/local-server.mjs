import { homedir } from 'node:os';
import { join } from 'node:path';
import { createChatGPTSession } from './session.mjs';
import { interpretWithChatGPT, listVisionModels, ProviderError } from './responses.mjs';

const bodyLimit = 12_200_000;

function send(response, status, body) {
  if (response.destroyed) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  }).end(JSON.stringify(body));
}

async function readRequest(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new ProviderError('invalid_request', 'Expected a JSON request.', 415);
  }
  if (Number(request.headers['content-length']) > bodyLimit) {
    throw new ProviderError('too_large', 'The coaching bundle is too large.', 413);
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > bodyLimit) {
      request.resume();
      throw new ProviderError('too_large', 'The coaching bundle is too large.', 413);
    }
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || Object.keys(data).length !== 3 || typeof data.model !== 'string'
        || !data.packet || !Array.isArray(data.images)) throw new Error('Invalid request');
    return data;
  } catch {
    throw new ProviderError('invalid_request', 'Expected a model and an approved coaching bundle.', 400);
  }
}

export function createProviderMiddleware({
  origin,
  returnPath = '/',
  enabled = false,
  directory = join(homedir(), '.config', 'moveide'),
  fetcher = fetch,
  jwks,
}) {
  const loopback = new URL(origin);
  if (loopback.hostname !== '127.0.0.1' || loopback.protocol !== 'http:' || loopback.origin !== origin
      || new URL(returnPath, origin).origin !== origin || !returnPath.startsWith('/')) {
    throw new Error('Use an HTTP 127.0.0.1 origin and a local return path for the ChatGPT service.');
  }

  const session = enabled ? createChatGPTSession({ directory, origin, fetcher, jwks }) : null;
  return async (request, response, next) => {
    if (!request.url?.startsWith('/api/')) return next();
    const url = new URL(request.url, origin);
    const route = `${request.method} ${url.pathname}`;
    if (!['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
        || request.headers.host !== loopback.host
        || (request.method !== 'GET' && request.headers.origin !== origin)
        || (route !== 'GET /api/auth/callback' && ['cross-site', 'same-site'].includes(request.headers['sec-fetch-site']))) {
      return send(response, 403, { error: 'forbidden', message: 'Use the same-origin local MoveIDE workbench.' });
    }
    if (route === 'GET /api/health') return send(response, 200, { ok: true });
    if (!session && route === 'GET /api/connection') return send(response, 200, { state: 'unavailable', enabled: false });
    if (!session) return send(response, 503, { error: 'unavailable', message: 'ChatGPT is disabled in this build.' });

    try {
      switch (route) {
        case 'GET /api/connection':
          return send(response, 200, await session.status());
        case 'POST /api/auth/start':
          return send(response, 200, await session.start());
        case 'POST /api/auth/cancel':
          session.cancel();
          return send(response, 200, await session.status());
        case 'GET /api/auth/callback':
          if (!await session.finish(url.searchParams)) {
            return send(response, 400, { error: 'invalid_state', message: 'This sign-in attempt is no longer valid.' });
          }
          return response.writeHead(303, {
            Location: returnPath, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
          }).end();
        case 'POST /api/disconnect':
          return send(response, 200, await session.disconnect());
        case 'GET /api/models':
        case 'POST /api/interpret': {
          const abort = new AbortController();
          response.once('close', () => abort.abort());
          const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(120_000)]);
          const data = route === 'POST /api/interpret' ? await readRequest(request) : null;
          const token = await session.accessToken();
          if (!token) return send(response, 401, { error: 'reauthorize', message: 'Connect an eligible ChatGPT plan first.' });
          const options = { fetcher, signal };
          const result = data
            ? await interpretWithChatGPT(token, data, options)
            : await listVisionModels(token, options);
          return send(response, 200, result);
        }
        default:
          return send(response, 404, { error: 'not_found', message: 'This provider route does not exist.' });
      }
    } catch (error) {
      if (error instanceof ProviderError) return send(response, error.status, { error: error.code, message: error.message });
      return send(response, 502, { error: 'provider_failed', message: 'ChatGPT could not complete this request.' });
    }
  };
}
