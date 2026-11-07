import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createProviderMiddleware } from './provider/local-server.mjs';
import { createReceiverProxy } from './live/transport/receiver-proxy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const local = (path) => fileURLToPath(new URL(path, import.meta.url));
const smokePath = '/harness/smoke/';

function configureStandalone(server, allowChatGPT = false) {
  let provider, receiver;
  server.middlewares.use((request, response, next) => {
    if (!request.url?.startsWith('/rooms')) return next();
    const { port } = server.httpServer.address();
    receiver ??= createReceiverProxy({ origin: `http://127.0.0.1:${port}` });
    return receiver(request, response, next);
  });
  server.middlewares.use((request, response, next) => {
    if (request.method === 'GET' && request.url === '/') {
      return response.writeHead(302, { Location: smokePath }).end();
    }
    if (!request.url?.startsWith('/api/')) return next();
    const { port } = server.httpServer.address();
    provider ??= createProviderMiddleware({
      origin: `http://127.0.0.1:${port}`,
      returnPath: smokePath,
      enabled: allowChatGPT && port === 4173 && process.env.MOVEIDE_ENABLE_CHATGPT === '1',
    });
    return provider(request, response, next);
  });
}

export default defineConfig({
  root,
  publicDir: local('public/'),
  cacheDir: local('node_modules/.vite/'),
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    outDir: local('dist/'),
    rollupOptions: { input: [local('smoke/index.html'), local('live/index.html')] },
  },
  plugins: [{
    name: 'moveide-standalone-harness',
    configureServer: configureStandalone,
    configurePreviewServer(server) {
      configureStandalone(server, true);
    },
    async writeBundle() {
      await mkdir(local('dist/fixtures/squat/'), { recursive: true });
      await Promise.all([
        cp(local('../LICENSE'), local('dist/MIT-LICENSE.txt')),
        cp(local('setup/APACHE-2.0.txt'), local('dist/APACHE-2.0.txt')),
        cp(local('setup/QRCODE-MIT.txt'), local('dist/QRCODE-MIT.txt')),
        cp(local('setup/THIRD-PARTY-NOTICES.md'), local('dist/THIRD-PARTY-NOTICES.md')),
      ]);
      for (const name of ['clear-squat.mp4', 'README.md']) {
        await cp(local(`../fixtures/squat/${name}`), local(`dist/fixtures/squat/${name}`));
      }
    },
  }],
});
