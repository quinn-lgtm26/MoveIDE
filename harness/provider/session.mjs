import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const issuer = 'https://auth.openai.com';
const authorizeUrl = `${issuer}/api/accounts/authorize`;
const tokenUrl = `${issuer}/api/accounts/oauth/token`;
const revokeUrl = `${issuer}/api/accounts/oauth/revoke`;
export const resource = 'https://api.openai.com/v1';
const planScope = 'chatgpt.tokens.use.direct';
const requestedScopes = `openid profile email offline_access resource.invoke ${planScope}`;
const terminalRefreshErrors = new Set([
  'invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired',
  'refresh_token_invalidated', 'refresh_token_reused',
]);
const callbackPath = '/api/auth/callback';
const openAIKeys = createRemoteJWKSet(new URL('/.well-known/jwks.json', issuer));

function secret() {
  return randomBytes(32).toString('base64url');
}

function matchesState(provided, expected) {
  return typeof provided === 'string' && provided.length === expected.length
    && Buffer.byteLength(provided) === expected.length
    && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

async function verifyIdentity(idToken, clientId, nonce, jwks) {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: clientId,
    algorithms: ['RS256'],
    requiredClaims: ['sub', 'exp', 'nonce'],
  });
  if (payload.nonce !== nonce || !payload.sub) throw new Error('Invalid identity');
  return payload.sub;
}

function normalizeTokens(body) {
  if (!body || typeof body.access_token !== 'string' || !body.access_token
      || typeof body.scope !== 'string' || body.token_type?.toLowerCase() !== 'bearer'
      || !Number.isFinite(body.expires_in) || body.expires_in <= 0) {
    throw new Error('Invalid token response');
  }
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
    scopes: body.scope.split(/\s+/),
    expiresAt: Date.now() + body.expires_in * 1000,
  };
}

export function createChatGPTSession({ directory, origin, fetcher = fetch, jwks = openAIKeys }) {
  const path = join(directory, 'chatgpt.json');
  const redirectUri = new URL(callbackPath, origin).href;
  let persisted;
  let attempt;
  let exchange;
  let failure;
  let sequence = Promise.resolve();

  function serialize(operation) {
    const result = sequence.then(operation);
    sequence = result.catch(() => {});
    return result;
  }

  async function read() {
    if (persisted) return persisted;
    try {
      persisted = JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      persisted = { hostId: `urn:uuid:${randomUUID()}`, profile: null };
    }
    return persisted;
  }

  async function save(next, signal) {
    await mkdir(directory, { mode: 0o700, recursive: true });
    await chmod(directory, 0o700);
    const staging = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(staging, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
      signal?.throwIfAborted();
      await rename(staging, path);
      persisted = next;
    } finally {
      await rm(staging, { force: true });
    }
  }

  async function post(url, fields, signal) {
    const timeout = AbortSignal.timeout(15_000);
    return fetcher(url, {
      method: 'POST',
      body: new URLSearchParams(fields),
      redirect: 'error',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  }

  function liveAttempt() {
    if (attempt?.expiresAt > Date.now()) return attempt;
    attempt = null;
    return null;
  }

  function status() {
    return serialize(async () => {
      if (liveAttempt()) return { state: 'connecting' };
      const { profile } = await read();
      if (profile?.tokens?.scopes.includes(planScope)
          && (profile.tokens.expiresAt > Date.now() || profile.tokens.refreshToken)) {
        return { state: 'connected' };
      }
      const denied = profile?.tokens && !profile.tokens.scopes.includes(planScope);
      return failure ?? { state: denied ? 'denied' : 'disconnected' };
    });
  }

  function start() {
    return serialize(async () => {
      const current = await read();
      if (!current.profile) await save(current);
      const state = secret();
      const nonce = secret();
      const verifier = secret();
      const requestConsent = failure?.state === 'denied' || (current.profile?.tokens && !current.profile.tokens.scopes.includes(planScope));
      attempt = {
        state, nonce, verifier, profile: current.profile, expiresAt: Date.now() + 10 * 60_000,
        controller: new AbortController(),
      };
      failure = null;
      const url = new URL(authorizeUrl);
      url.search = new URLSearchParams({
        client_id: current.profile?.clientId ?? 'dynamic_agent_client',
        ext_agent_host_id: current.hostId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: requestedScopes,
        resource,
        state,
        nonce,
        code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      });
      if (!current.profile) url.searchParams.set('agent_name_hint', 'MoveIDE');
      if (requestConsent) url.searchParams.set('prompt', 'consent');
      return { state: 'connecting', authorizationUrl: url.href };
    });
  }

  function finish(query) {
    return serialize(async () => {
      const pending = liveAttempt();
      if (!pending || !matchesState(query.get('state'), pending.state)) return false;
      attempt = null;
      if (query.has('error')) {
        console.warn('[chatgpt] sign-in returned an error:', query.get('error'), query.get('error_description') ?? '');
        failure = { state: query.get('error') === 'access_denied' ? 'denied' : 'unavailable' };
        return true;
      }
      const returnedClientId = query.get('client_id');
      const clientId = pending.profile?.clientId ?? returnedClientId;
      exchange = pending.controller;
      const { signal } = exchange;
      try {
        if (!/^oaiapp_[A-Za-z0-9_-]+$/.test(clientId ?? '') || !query.get('code')
            || (returnedClientId && returnedClientId !== clientId)) throw new Error(`Invalid callback (client_id=${clientId ?? 'missing'}, code=${query.has('code')})`);
        const response = await post(tokenUrl, {
          grant_type: 'authorization_code',
          client_id: clientId,
          code: query.get('code'),
          code_verifier: pending.verifier,
          redirect_uri: redirectUri,
          resource,
        }, signal);
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error(`Token exchange failed (${response.status}) ${detail.slice(0, 500)} [redirect_uri=${redirectUri}, client_id=${clientId}, callback_keys=${[...query.keys()].join(',')}]`);
        }
        const body = await response.json();
        const subject = await verifyIdentity(body.id_token, clientId, pending.nonce, jwks);
        if (pending.profile && subject !== pending.profile.subject) throw new Error('Account mismatch');
        const tokens = normalizeTokens(body);
        const current = await read();
        await save({ ...current, profile: { clientId, subject, tokens } }, signal);
        if (!tokens.scopes.includes(planScope)) failure = { state: 'denied' };
      } catch (error) {
        if (!signal.aborted) console.warn('[chatgpt] sign-in could not finish:', error?.message);
        if (!signal.aborted) failure = { state: 'unavailable' };
      } finally {
        exchange = null;
      }
      return !signal.aborted;
    });
  }

  function cancel() {
    exchange?.abort();
    attempt = null;
    failure = null;
  }

  function disconnect() {
    cancel();
    return serialize(async () => {
      const current = await read();
      const profile = current.profile;
      if (!profile?.tokens) return { state: 'disconnected' };

      let revocationConfirmed = false;
      try {
        if (profile.tokens.refreshToken) {
          const response = await post(revokeUrl, {
            token: profile.tokens.refreshToken,
            token_type_hint: 'refresh_token',
            client_id: profile.clientId,
          });
          revocationConfirmed = response.ok;
        }
      } catch {
        // Disconnect locally even if the remote endpoint is unreachable.
      }
      await save({ ...current, profile: { ...profile, tokens: null } });
      return { state: 'disconnected', revocationConfirmed };
    });
  }

  function accessToken() {
    return serialize(async () => {
      const current = await read();
      const profile = current.profile;
      if (!profile?.tokens?.scopes.includes(planScope)) return null;
      const tokens = profile.tokens;
      if (tokens.expiresAt > Date.now() + 15_000) return tokens.accessToken;
      if (!tokens.refreshToken) return tokens.expiresAt > Date.now() ? tokens.accessToken : null;

      const response = await post(tokenUrl, {
        grant_type: 'refresh_token',
        client_id: profile.clientId,
        refresh_token: tokens.refreshToken,
        resource,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (terminalRefreshErrors.has(typeof body?.error === 'string' ? body.error : body?.error?.code)) {
          await save({ ...current, profile: { ...profile, tokens: null } });
          return null;
        }
        throw new Error('Token refresh failed');
      }
      const renewed = normalizeTokens(await response.json());
      if (!renewed.refreshToken) throw new Error('Replacement refresh token missing');
      await save({ ...current, profile: { ...profile, tokens: renewed } });
      return renewed.scopes.includes(planScope) ? renewed.accessToken : null;
    });
  }

  return { start, finish, cancel, disconnect, status, accessToken };
}
