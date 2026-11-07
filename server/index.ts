// Loopback service for the ChatGPT connector (BE-3/BE-4). Bound to 127.0.0.1 only.
// Credentials live here; the UI only ever sees connection state.
// ponytail: node:http + a route switch; reach for a framework only if routes outgrow this.
import { createServer } from 'node:http';
import { createConnector } from './chatgpt.ts';

const PORT = Number(process.env.PORT ?? 8787);
// The redirect must be 127.0.0.1 (not localhost) and hit this service directly, not the Vite proxy.
const chatgpt = createConnector({ redirectUri: `http://127.0.0.1:${PORT}/auth/callback` });

createServer(async (req, res) => {
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  };
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  try {
    switch (`${req.method} ${url.pathname}`) {
      case 'GET /api/health': return json(200, { ok: true });
      case 'GET /api/connection': return json(200, chatgpt.state());
      case 'POST /api/disconnect': return json(200, chatgpt.disconnect());
      case 'GET /api/auth/start': return res.writeHead(302, { location: chatgpt.start() }).end();
      case 'GET /auth/callback': {
        const result = await chatgpt.callback(url.searchParams);
        res.writeHead(result ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(`<p>MoveIDE ChatGPT connection: <b>${result?.state ?? 'rejected (state mismatch)'}</b>. You can close this tab.</p>`);
      }
      case 'POST /api/chatgpt/test': return json(200, await chatgpt.testRequest());
      // TODO(BE-4): POST /api/interpret { packet, images } → Responses API under the Magna Carta.
      default: return json(404, { error: 'not found' });
    }
  } catch (e) {
    return json(502, { error: (e as Error).message }); // messages are built in chatgpt.ts and carry no tokens
  }
}).listen(PORT, '127.0.0.1', () => console.log(`MoveIDE service on http://127.0.0.1:${PORT}`));
