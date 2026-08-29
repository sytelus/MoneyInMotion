import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve core directly to its source so dev mode (and production build)
      // doesn't depend on a pre-built packages/core/dist. Vite and esbuild
      // compile TypeScript on the fly.
      '@moneyinmotion/core': path.resolve(import.meta.dirname, '../core/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    // Fail fast if 5173 is busy instead of silently falling back to
    // 5174/5175/... — the run.sh banner advertises 5173, and silently
    // shifting the port makes users open the wrong URL and see
    // "Cannot GET /" from the API server on 3001.
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
  },
});
