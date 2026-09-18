import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const DEFAULT_API_PORT = 3001;

/**
 * Read the same canonical config file as the API server for development proxying.
 * The server remains responsible for full validation and for creating defaults.
 */
function readDevelopmentApiPort(): number {
  const configFile = path.join(os.homedir(), '.moneyinmotion', 'config.json');
  if (!fs.existsSync(configFile)) return DEFAULT_API_PORT;

  try {
    const value = (JSON.parse(fs.readFileSync(configFile, 'utf-8')) as { port?: unknown }).port;
    const port =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim() !== ''
          ? Number(value)
          : Number.NaN;
    return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : DEFAULT_API_PORT;
  } catch {
    // The API process reports the actionable configuration error. Keeping the
    // Vite config loadable avoids obscuring that message with a second failure.
    return DEFAULT_API_PORT;
  }
}

const apiPort = readDevelopmentApiPort();

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
    // shifting the port makes users open the wrong URL.
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
  build: {
    outDir: 'dist',
  },
});
