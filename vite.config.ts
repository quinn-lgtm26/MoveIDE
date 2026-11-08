import { defineConfig, type ViteDevServer, type PreviewServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { AddressInfo } from 'node:net';
import { createProviderMiddleware } from './harness/provider/local-server.mjs';
import { createReceiverProxy } from './harness/live/transport/receiver-proxy.mjs';
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// /api is the harness ChatGPT provider, mounted in-process so the UI stays same-origin.
// Live sign-in only on the fixed preview port 4173 with MOVEIDE_ENABLE_CHATGPT=1, matching the harness.
function provider(server: ViteDevServer | PreviewServer, allowChatGPT: boolean) {
  let handler: ReturnType<typeof createProviderMiddleware> | undefined;
  let receiver: ReturnType<typeof createReceiverProxy> | undefined;
  server.middlewares.use((req, res, next) => {
    if (!req.url?.startsWith('/rooms')) return next();
    const { port } = server.httpServer!.address() as AddressInfo;
    receiver ??= createReceiverProxy({ origin: `http://127.0.0.1:${port}` });
    return receiver(req, res, next);
  });
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
    // Hold the app's first paint until React has rendered (src/main.tsx), so the page-load
    // cross-fade from Live camera shows the finished view. Vite drops this attribute from source HTML.
    transformIndexHtml: { order: 'post', handler: html => html.replace(/<script type="module"/g, '<script type="module" blocking="render"') },
    async writeBundle() {
      await mkdir(local('dist/fixtures/squat/'), { recursive: true });
      await Promise.all([
        cp(local('LICENSE'), local('dist/MIT-LICENSE.txt')),
        cp(local('harness/setup/APACHE-2.0.txt'), local('dist/APACHE-2.0.txt')),
        cp(local('harness/setup/QRCODE-MIT.txt'), local('dist/QRCODE-MIT.txt')),
        cp(local('harness/setup/THIRD-PARTY-NOTICES.md'), local('dist/THIRD-PARTY-NOTICES.md')),
      ]);
      for (const name of ['clear-squat.mp4', 'supported-squat.mp4', 'README.md']) {
        await cp(local(`fixtures/squat/${name}`), local(`dist/fixtures/squat/${name}`));
      }
    },
  }],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  publicDir: 'harness/public', worker: { format: 'es' },
  build: { rollupOptions: { input: [local('index.html'), local('harness/smoke/index.html'), local('harness/live/index.html')] } },
});
