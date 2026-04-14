import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve core directly to its source so dev mode (and production build)
      // doesn't depend on a pre-built packages/core/dist. Vite and esbuild
      // compile TypeScript on the fly.
      '@moneyinmotion/core': path.resolve(__dirname, '../core/src/index.ts'),
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
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          // Split the heaviest library groups so the production build does not
          // collapse into a single large application bundle.
          if (id.includes('@tanstack/')) {
            return 'tanstack-vendor';
          }

          if (id.includes('@radix-ui/')) {
            return 'radix-vendor';
          }

          if (id.includes('lucide-react')) {
            return 'icons-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
});
