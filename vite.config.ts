import { defineConfig, type ViteDevServer, type PreviewServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { AddressInfo } from 'node:net';
import { createProviderMiddleware } from './harness/provider/local-server.mjs';

// /api is the harness ChatGPT provider, mounted in-process so the UI stays same-origin.
// Live sign-in only on the fixed preview port 4173 with MOVEIDE_ENABLE_CHATGPT=1, matching the harness.
function provider(server: ViteDevServer | PreviewServer, allowChatGPT: boolean) {
  let handler: ReturnType<typeof createProviderMiddleware> | undefined;
  server.middlewares.use((req, res, next) => {
    if (!req.url?.startsWith('/api/')) return next();
    const { port } = server.httpServer!.address() as AddressInfo;
    handler ??= createProviderMiddleware({
      origin: `http://127.0.0.1:${port}`,
      enabled: allowChatGPT && port === 4173 && process.env.MOVEIDE_ENABLE_CHATGPT === '1',
    });
    return handler(req, res, next);
  });
}

export default defineConfig({
  plugins: [react(), {
    name: 'moveide-chatgpt-provider',
    configureServer: (server) => provider(server, false),
    configurePreviewServer: (server) => provider(server, true),
  }],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  publicDir: 'harness/public', worker: { format: 'es' },
});
