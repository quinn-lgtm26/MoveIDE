import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The loopback service (server/index.ts) is proxied so the UI stays same-origin.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  publicDir: 'harness/public', worker: { format: 'es' },
});
