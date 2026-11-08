import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateKeyPair, SignJWT } from 'jose';
import { createChatGPTSession } from './session.mjs';
import { createProviderMiddleware } from './local-server.mjs';

const packet = JSON.parse(await readFile(new URL('../results/supported-squat.coach-packet.v1.json', import.meta.url)));
const { publicKey, privateKey } = await generateKeyPair('RS256');
const model = 'gpt-6.1-sol';
const images = packet.evidence.map((frame, index) => ({
  ...frame,
  dataUrl: index === 0 ? 'data:image/jpeg;base64,/9j//9k=' : 'data:image/jpeg;base64,/9j/Af/Z',
}));

function signIdentity(nonce) {
  return new SignJWT({ nonce })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('https://auth.openai.com')
    .setAudience('oaiapp_fixture')
    .setSubject('verified-subject')
    .setExpirationTime('5m')
    .sign(privateKey);
}
const interpretation = {
  observations: [{ text: 'Estimated screen-plane flexion.', evidenceIds: [packet.measurements[0].id] }],
  uncertainty: 'This estimate depends on camera position.',
  nextFocus: { text: 'Keep the camera still.', evidenceIds: [images[0].id] },
};

async function start(t, options) {
  const directory = await mkdtemp(join(tmpdir(), 'moveide-provider-test-'));
  const server = createServer((request, response) => handler(request, response, () => response.writeHead(404).end()));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const handler = createProviderMiddleware({ origin, directory, ...options });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const get = (path) => fetch(origin + path, { redirect: 'manual' });
  const post = (path, body, from = origin) => fetch(origin + path, {
    method: 'POST',
    headers: { Origin: from, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { get, post, origin, directory };
}

test('the offline harness exposes unavailable state and refuses foreign origins', async (t) => {
  const { get, post } = await start(t, { enabled: false });
  assert.deepEqual(await (await get('/api/connection')).json(), { state: 'unavailable', enabled: false });
  assert.equal((await post('/api/auth/start')).status, 503);
  assert.equal((await post('/api/auth/start', {}, 'https://other.example')).status, 403);
});

test('OAuth rejects invalid state, validates nonce and scope, and sends only approved evidence', async (t) => {
  let auth;
  let responseCalls = 0;
  let result = interpretation;
  let terminal = true;
  let scope = 'openid';
  let wrongNonce = true;
  const { get, post, origin, directory } = await start(t, {
    enabled: true,
    jwks: publicKey,
    fetcher: async (url, options) => {
      if (url.endsWith('/oauth/token')) {
        const fields = options.body;
        const challenge = createHash('sha256').update(fields.get('code_verifier')).digest('base64url');
        assert.equal(fields.get('redirect_uri'), origin + '/api/auth/callback');
        assert.equal(fields.get('code'), 'fixture-code');
        assert.equal(fields.get('client_id'), 'oaiapp_fixture');
        assert.equal(challenge, auth.searchParams.get('code_challenge'));
        return Response.json({
          access_token: 'fake-access',
          refresh_token: 'fake-refresh',
          id_token: await signIdentity(wrongNonce ? 'unrelated-nonce' : auth.searchParams.get('nonce')),
          expires_in: 3600,
          token_type: 'Bearer',
          scope,
        });
      }
      if (url.endsWith('/oauth/revoke')) {
        assert.equal(options.body.get('token'), 'fake-refresh');
        return new Response(null, { status: 200 });
      }
      assert.equal(options.headers.Authorization, 'Bearer fake-access');
      if (url.endsWith('/models')) {
        return Response.json({ models: [{ slug: model, display_name: 'Test Vision', visibility: 'list' }] });
      }
      assert.ok(url.endsWith('/responses'));
      responseCalls++;
      const outgoing = JSON.parse(options.body);
      assert.equal(outgoing.model, model);
      assert.equal(outgoing.store, false);
      assert.equal(outgoing.stream, true);
      assert.equal(outgoing.text.format.strict, true);
      assert.match(outgoing.instructions, /MoveIDE presentation policy v3/);
      assert.match(outgoing.instructions, /Observed:/);
      assert.match(outgoing.instructions, /Meaning:/);
      assert.match(outgoing.instructions, /no numerical angle targets/);
      assert.match(outgoing.instructions, /illustrative app default/);
      assert.match(outgoing.instructions, /No usable multi-sample angle trace is supplied/);
      assert.match(outgoing.instructions, /Only the selected reps may be compared/);
      assert.doesNotMatch(outgoing.instructions, /suggest maintaining that consistency/);
      assert.deepEqual(JSON.parse(outgoing.input[0].content[0].text), packet);
      assert.deepEqual(outgoing.input[0].content.slice(1), images.flatMap((image) => [
        { type: 'input_text', text: `Source frame ${image.id} at ${image.timestampMs} ms.` },
        { type: 'input_image', image_url: image.dataUrl, detail: 'auto' },
      ]));
      const event = {
        type: terminal ? 'response.completed' : 'response.output_text.delta',
        response: {
          status: 'completed',
          output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(result) }] }],
        },
      };
      const message = `event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`;
      const body = new ReadableStream({
        start(controller) {
          const bytes = new TextEncoder().encode(message);
          controller.enqueue(bytes.subarray(0, 31));
          controller.enqueue(bytes.subarray(31));
          controller.close();
        },
      });
      return new Response(body);
    },
  });

  async function connect() {
    auth = new URL((await (await post('/api/auth/start')).json()).authorizationUrl);
    const state = auth.searchParams.get('state');
    assert.equal(auth.hostname, 'auth.openai.com');
    assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
    assert.equal((await get('/api/auth/callback?state=wrong')).status, 400);
    const callback = `/api/auth/callback?state=${state}&code=fixture-code&client_id=oaiapp_fixture`;
    assert.equal((await get(callback)).status, 303);
    assert.equal((await get(callback)).status, 400);
    return (await get('/api/connection')).json();
  }

  assert.deepEqual(await connect(), { state: 'unavailable' });
  assert.equal(JSON.parse(await readFile(join(directory, 'chatgpt.json'), 'utf8')).profile, null);
  wrongNonce = false;
  assert.deepEqual(await connect(), { state: 'denied' });
  assert.equal((await post('/api/interpret', { model, packet, images })).status, 401);
  scope = 'openid chatgpt.tokens.use.direct resource.invoke';
  assert.deepEqual(await connect(), { state: 'connected' });
  assert.equal(auth.searchParams.get('client_id'), 'oaiapp_fixture');
  assert.equal(auth.searchParams.get('prompt'), 'consent');
  assert.equal((await stat(join(directory, 'chatgpt.json'))).mode & 0o777, 0o600);
  assert.equal((await post('/api/interpret', { model, packet, images: [] })).status, 400);
  assert.equal((await post('/api/interpret', { model: 'unknown', packet, images })).status, 400);
  assert.equal(responseCalls, 0);
  assert.deepEqual(await (await post('/api/interpret', { model, packet, images })).json(), interpretation);

  result = { ...interpretation, observations: [{ text: 'Unknown.', evidenceIds: ['invented-id'] }] };
  assert.equal((await (await post('/api/interpret', { model, packet, images })).json()).error, 'invalid_response');
  terminal = false;
  assert.equal((await (await post('/api/interpret', { model, packet, images })).json()).error, 'incomplete');
  assert.deepEqual(await (await post('/api/disconnect')).json(), { state: 'disconnected', revocationConfirmed: true });
  assert.ok(!(await readFile(join(directory, 'chatgpt.json'), 'utf8')).includes('fake-access'));
});

async function createTestSession(t, fetcher) {
  const directory = await mkdtemp(join(tmpdir(), 'moveide-oauth-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return createChatGPTSession({ directory, origin: 'http://127.0.0.1:4173', fetcher, jwks: publicKey });
}

async function begin(session) {
  const { authorizationUrl } = await session.start();
  const auth = new URL(authorizationUrl);
  return {
    nonce: auth.searchParams.get('nonce'),
    query: new URLSearchParams({
      state: auth.searchParams.get('state'), code: 'fixture-code', client_id: 'oaiapp_fixture',
    }),
  };
}

function tokens(extra = {}) {
  return {
    access_token: 'initial-access',
    refresh_token: 'initial-refresh',
    expires_in: 1,
    token_type: 'Bearer',
    scope: 'openid chatgpt.tokens.use.direct resource.invoke',
    ...extra,
  };
}

test('canceling during OAuth exchange prevents a late token response from connecting', async (t) => {
  const waiting = Promise.withResolvers();
  const received = Promise.withResolvers();
  const session = await createTestSession(t, (_url, { signal }) => {
    received.resolve(signal);
    return waiting.promise;
  });
  const { nonce, query } = await begin(session);
  const callback = session.finish(query);
  const signal = await received.promise;
  session.cancel();
  assert.equal(signal.aborted, true);
  waiting.resolve(Response.json(tokens({ id_token: await signIdentity(nonce) })));
  assert.equal(await callback, false);
  assert.deepEqual(await session.status(), { state: 'disconnected' });
  assert.equal(await session.accessToken(), null);
});

test('refresh uses the rotated token and clears a terminal rejected grant', async (t) => {
  let nonce;
  const used = [];
  const session = await createTestSession(t, async (_url, { body }) => {
    if (body.get('grant_type') === 'authorization_code') {
      return Response.json(tokens({ id_token: await signIdentity(nonce) }));
    }
    used.push(body.get('refresh_token'));
    if (used.length === 1) {
      return Response.json(tokens({ access_token: 'rotated-access', refresh_token: 'rotated-refresh' }));
    }
    return Response.json({ error: 'refresh_token_reused' }, { status: 400 });
  });
  const auth = await begin(session);
  nonce = auth.nonce;
  assert.equal(await session.finish(auth.query), true);
  assert.equal(await session.accessToken(), 'rotated-access');
  assert.equal(await session.accessToken(), null);
  assert.deepEqual(used, ['initial-refresh', 'rotated-refresh']);
  assert.deepEqual(await session.status(), { state: 'disconnected' });
});
