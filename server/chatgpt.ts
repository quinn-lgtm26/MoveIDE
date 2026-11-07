// BE-3 spike: "Sign in with ChatGPT" plan usage for a local open-source app.
// Flow per https://developers.openai.com/siwc/token-sharing-open-source (sign-in, token reference,
// models-and-inference). Tokens stay in this process and a 0600 file; callers only ever get ConnectionState.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const AUTH = 'https://auth.openai.com';
const API = 'https://api.openai.com/v1';
export const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
const SCOPE = `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`;
const FIRST_CLIENT_ID = 'dynamic_agent_client';
const FIXTURE_FRAME = new URL('../fixtures/squat/sample-squat-bottom-1067ms.jpg', import.meta.url);

export type ConnectionState = {
  state: 'disconnected' | 'connecting' | 'connected' | 'denied' | 'unavailable';
  reason?: string; // never contains token material
};

type Credentials = {
  issuer: string; subject: string; client_id: string; ext_agent_host_id: string;
  access_token: string; refresh_token?: string; id_token: string;
  scopes: string[]; expires_at: number; saved_at: number;
};

type Options = {
  redirectUri: string;
  dir?: string;
  fetch?: typeof fetch;
  log?: (line: string) => void;
  now?: () => number;
};

const b64url = (buf: Buffer) => buf.toString('base64url');
const rand = () => b64url(randomBytes(32));

export function createConnector({
  redirectUri,
  dir = process.env.MOVEIDE_CONFIG_DIR ?? join(homedir(), '.config', 'moveide'),
  fetch: http = fetch,
  log = console.log,
  now = Date.now,
}: Options) {
  const credFile = join(dir, 'chatgpt.json');
  const hostFile = join(dir, 'host-id');
  // The issued client_id outlives a failed exchange: docs say retry with it, never re-register.
  const clientFile = join(dir, 'client-id');
  const issuedClientId = () => creds?.client_id ?? (existsSync(clientFile) ? readFileSync(clientFile, 'utf8').trim() : undefined);
  let pending: { state: string; nonce: string; verifier: string } | null = null;
  let creds: Credentials | null = existsSync(credFile) ? JSON.parse(readFileSync(credFile, 'utf8')) : null;
  // ponytail: no refresh-token rotation; an expired access token means sign in again. Add refresh (30-day RT) after the spike.
  let connection: ConnectionState =
    creds && creds.expires_at > now() ? { state: 'connected' } : { state: 'disconnected' };

  const outcome = (next: ConnectionState) => {
    connection = next;
    log(`chatgpt sign-in: ${next.state}${next.reason ? ` (${next.reason})` : ''}`);
    return connection;
  };

  const write = (file: string, data: string) => {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(`${file}.tmp`, data, { mode: 0o600 });
    renameSync(`${file}.tmp`, file);
  };

  const hostId = () => {
    if (!existsSync(hostFile)) write(hostFile, `urn:uuid:${randomUUID()}`);
    return readFileSync(hostFile, 'utf8').trim();
  };

  return {
    state: (): ConnectionState => connection,

    /** Begin a sign-in attempt; returns the authorize URL to open in the system browser. */
    start(): string {
      pending = { state: rand(), nonce: rand(), verifier: rand() };
      const params = new URLSearchParams({
        client_id: issuedClientId() ?? FIRST_CLIENT_ID,
        ext_agent_host_id: hostId(),
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: SCOPE,
        resource: API,
        state: pending.state,
        nonce: pending.nonce,
        code_challenge_method: 'S256',
        code_challenge: b64url(createHash('sha256').update(pending.verifier).digest()),
      });
      if (!issuedClientId()) params.set('agent_name_hint', 'MoveIDE');
      connection = { state: 'connecting' };
      return `${AUTH}/api/accounts/authorize?${params}`;
    },

    /** Handle the loopback redirect. A state mismatch is rejected without touching the connection. */
    async callback(q: URLSearchParams): Promise<ConnectionState | null> {
      if (!pending || q.get('state') !== pending.state) return null;
      const attempt = pending;
      pending = null; // one-shot
      const error = q.get('error');
      if (error === 'access_denied') return outcome({ state: 'denied', reason: 'plan use declined' });
      if (error) return outcome({ state: 'unavailable', reason: error });

      const clientId = q.get('client_id') ?? issuedClientId();
      if (q.get('client_id')) write(clientFile, q.get('client_id')!);
      const code = q.get('code');
      if (!clientId || !code) return outcome({ state: 'unavailable', reason: 'callback missing code or client_id' });

      const res = await http(`${AUTH}/api/accounts/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code', client_id: clientId, code,
          code_verifier: attempt.verifier, redirect_uri: redirectUri, resource: API,
        }),
      });
      const tok = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) return outcome({ state: 'unavailable', reason: `token exchange ${res.status} ${[tok.error, tok.error_description].filter(Boolean).join(': ')}`.trim() });

      const scopes = String(tok.scope ?? '').split(' ').filter(Boolean);
      if (!scopes.includes(PLAN_SCOPE)) return outcome({ state: 'denied', reason: 'plan scope not granted' });

      // ponytail: ID token signature not checked against JWKS; it came straight from the token endpoint over TLS
      // (OIDC Core 3.1.3.7 #6). Claims are checked. Add JWKS verification if tokens ever arrive another way.
      let id: Record<string, unknown> = {};
      try { id = JSON.parse(Buffer.from(String(tok.id_token).split('.')[1], 'base64url').toString()); } catch {}
      const aud = Array.isArray(id.aud) ? id.aud : [id.aud];
      if (id.iss !== AUTH || !aud.includes(clientId) || !(Number(id.exp) * 1000 > now()) || id.nonce !== attempt.nonce) {
        return outcome({ state: 'unavailable', reason: 'id token check failed' });
      }
      if (creds && creds.subject !== id.sub) return outcome({ state: 'unavailable', reason: 'signed in as a different account' });

      creds = {
        issuer: AUTH, subject: String(id.sub), client_id: clientId, ext_agent_host_id: hostId(),
        access_token: String(tok.access_token), refresh_token: tok.refresh_token as string | undefined,
        id_token: String(tok.id_token), scopes,
        expires_at: now() + Number(tok.expires_in ?? 3600) * 1000, saved_at: now(),
      };
      write(credFile, JSON.stringify(creds));
      return outcome({ state: 'connected' });
    },

    // ponytail: local logout only; token revocation endpoint not called.
    disconnect(): ConnectionState {
      pending = null;
      creds = null;
      rmSync(credFile, { force: true });
      return outcome({ state: 'disconnected' });
    },

    /** One Responses request: the permitted fixture frame plus test measurements. Returns the model's text. */
    async testRequest(): Promise<{ model: string; text: string }> {
      if (connection.state !== 'connected' || !creds || creds.expires_at <= now()) throw new Error('not connected');
      const auth = { authorization: `Bearer ${creds.access_token}` };

      let model = process.env.MOVEIDE_CHATGPT_MODEL;
      if (!model) {
        const r = await http(`${API}/models`, { headers: auth });
        if (!r.ok) throw new Error(`model list ${r.status}`);
        const body = (await r.json()) as { data?: { slug?: string; id?: string; visibility?: string }[] };
        const m = body.data?.find((m) => m.visibility === 'list') ?? body.data?.[0];
        model = m?.slug ?? m?.id;
        if (!model) throw new Error('no model available');
      }

      const measurements = { test: true, kneeFlexionDeg: 112, side: 'left', frameTimestampMs: 1067, rep: 1 };
      const image = readFileSync(FIXTURE_FRAME).toString('base64');
      const res = await http(`${API}/responses`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({
          model, store: false, stream: true,
          instructions: 'MoveIDE connection test. In one sentence, describe the squat position in the image and restate the measurement you were given.',
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: `Test measurements (not real analysis): ${JSON.stringify(measurements)}` },
              { type: 'input_image', image_url: `data:image/jpeg;base64,${image}` },
            ],
          }],
        }),
      });
      if (!res.ok) throw new Error(`responses ${res.status}`);

      // ponytail: buffers the whole SSE stream; switch to incremental parsing when the UI streams text.
      let text = '';
      for (const line of (await res.text()).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        let ev: { type?: string; delta?: string; response?: { error?: { code?: string } } };
        try { ev = JSON.parse(line.slice(6)); } catch { continue; }
        if (ev.type === 'response.output_text.delta') text += ev.delta ?? '';
        if (ev.type === 'response.failed') throw new Error(`response failed: ${ev.response?.error?.code ?? 'unknown'}`);
        if (ev.type === 'response.completed') return { model, text };
      }
      throw new Error('stream ended before response.completed');
    },
  };
}
