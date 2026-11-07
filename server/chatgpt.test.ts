import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnector, PLAN_SCOPE } from './chatgpt.ts';

const REDIRECT = 'http://127.0.0.1:8787/auth/callback';
const SECRETS = ['at-SECRET-access', 'rt-SECRET-refresh'];
const jwt = (claims: object) =>
  ['{}', JSON.stringify(claims), 'sig'].map((s) => Buffer.from(s).toString('base64url')).join('.');

function setup({ scope = `openid email offline_access resource.invoke ${PLAN_SCOPE}`, nonceOverride = '' } = {}) {
  const logs: string[] = [];
  const calls: { url: string; init?: RequestInit }[] = [];
  let nonce = '';
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith('/oauth/token')) {
      const id_token = jwt({ iss: 'https://auth.openai.com', aud: 'oaiapp_test', sub: 'user-1', exp: 9e9, nonce: nonceOverride || nonce });
      return Response.json({ access_token: SECRETS[0], refresh_token: SECRETS[1], id_token, expires_in: 3600, scope });
    }
    if (url.endsWith('/models')) return Response.json({ data: [{ slug: 'hidden', visibility: 'hide' }, { slug: 'img-model', visibility: 'list' }] });
    if (url.endsWith('/responses')) {
      const ev = (o: object) => `event: x\ndata: ${JSON.stringify(o)}\n\n`;
      return new Response(ev({ type: 'response.output_text.delta', delta: 'Deep ' }) + ev({ type: 'response.output_text.delta', delta: 'squat.' }) + ev({ type: 'response.completed' }));
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  const dir = mkdtempSync(join(tmpdir(), 'moveide-'));
  const c = createConnector({ redirectUri: REDIRECT, dir, fetch: fakeFetch, log: (l) => logs.push(l) });
  const begin = () => {
    const u = new URL(c.start());
    nonce = u.searchParams.get('nonce')!;
    return u.searchParams;
  };
  return { c, dir, logs, calls, begin };
}

const noSecrets = (...outputs: unknown[]) => {
  for (const out of outputs) for (const s of SECRETS) assert.ok(!JSON.stringify(out).includes(s), `leaked ${s}`);
};

test('start builds a PKCE S256 authorize URL with state, nonce, plan scope and loopback redirect', () => {
  const { c, begin } = setup();
  assert.equal(c.state().state, 'disconnected');
  const p = begin();
  assert.equal(c.state().state, 'connecting');
  assert.equal(p.get('client_id'), 'dynamic_agent_client');
  assert.equal(p.get('agent_name_hint'), 'MoveIDE');
  assert.equal(p.get('code_challenge_method'), 'S256');
  assert.equal(p.get('redirect_uri'), REDIRECT);
  assert.equal(p.get('resource'), 'https://api.openai.com/v1');
  assert.ok(p.get('scope')!.split(' ').includes(PLAN_SCOPE));
  assert.ok(p.get('state') && p.get('nonce') && p.get('ext_agent_host_id')!.startsWith('urn:uuid:'));
});

test('state mismatch is rejected and leaves the attempt pending', async () => {
  const { c, begin } = setup();
  begin();
  assert.equal(await c.callback(new URLSearchParams({ state: 'forged', code: 'x' })), null);
  assert.equal(c.state().state, 'connecting');
});

test('access_denied → denied', async () => {
  const { c, begin } = setup();
  const p = begin();
  assert.equal((await c.callback(new URLSearchParams({ state: p.get('state')!, error: 'access_denied' })))?.state, 'denied');
});

test('success → connected, verifier matches challenge, credentials 0600, nothing leaks', async () => {
  const { c, dir, logs, calls, begin } = setup();
  const p = begin();
  const state = await c.callback(new URLSearchParams({ state: p.get('state')!, code: 'code-1', client_id: 'oaiapp_test' }));
  assert.equal(state?.state, 'connected');
  const form = new URLSearchParams(String(calls[0].init!.body));
  assert.equal(createHash('sha256').update(form.get('code_verifier')!).digest('base64url'), p.get('code_challenge'));
  assert.equal(form.get('redirect_uri'), REDIRECT);
  assert.equal(statSync(join(dir, 'chatgpt.json')).mode & 0o777, 0o600);
  assert.ok(readFileSync(join(dir, 'chatgpt.json'), 'utf8').includes(SECRETS[0])); // stored locally, only here
  noSecrets(logs, state, c.state());

  const r = await c.testRequest();
  assert.deepEqual(r, { model: 'img-model', text: 'Deep squat.' });
  const body = JSON.parse(String(calls.at(-1)!.init!.body));
  assert.equal(body.store, false);
  assert.equal(body.stream, true);
  assert.ok(body.input[0].content[1].image_url.startsWith('data:image/jpeg;base64,'));
  noSecrets(logs, r);

  // Restart reads the saved credential; disconnect removes it.
  assert.equal(createConnector({ redirectUri: REDIRECT, dir, log: () => {} }).state().state, 'connected');
  assert.equal(c.disconnect().state, 'disconnected');
  assert.equal(createConnector({ redirectUri: REDIRECT, dir, log: () => {} }).state().state, 'disconnected');
});

test('missing plan scope → denied', async () => {
  const { c, logs, begin } = setup({ scope: 'openid email' });
  const p = begin();
  assert.equal((await c.callback(new URLSearchParams({ state: p.get('state')!, code: 'c', client_id: 'oaiapp_test' })))?.state, 'denied');
  noSecrets(logs);
  await assert.rejects(c.testRequest(), /not connected/);
});

test('nonce mismatch → unavailable', async () => {
  const { c, begin } = setup({ nonceOverride: 'other' });
  const p = begin();
  assert.equal((await c.callback(new URLSearchParams({ state: p.get('state')!, code: 'c', client_id: 'oaiapp_test' })))?.state, 'unavailable');
});
