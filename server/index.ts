// Loopback service for the ChatGPT connector (BE-3/BE-4). Bound to 127.0.0.1 only.
// Credentials live here; the UI only ever sees connection state.
// ponytail: node:http + a route switch; reach for a framework only if routes outgrow this.
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);

type Connection = { state: 'disconnected' | 'connecting' | 'connected' | 'denied' | 'unavailable' };
let connection: Connection = { state: 'disconnected' };

createServer((req, res) => {
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  };
  switch (`${req.method} ${req.url}`) {
    case 'GET /api/health': return json(200, { ok: true });
    case 'GET /api/connection': return json(200, connection);
    case 'POST /api/disconnect': connection = { state: 'disconnected' }; return json(200, connection);
    // TODO(BE-3): GET /api/auth/start (PKCE + state + nonce) and GET /api/auth/callback.
    // TODO(BE-4): POST /api/interpret { packet, images } → Responses API under the Magna Carta.
    default: return json(404, { error: 'not found' });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`MoveIDE service on http://127.0.0.1:${PORT}`));
