/**
 * Express application setup.
 *
 * Builds the Express app with security headers, JSON body parsing, route
 * mounting, an error handler, and (in production) static file serving of the
 * built React app with SPA-fallback routing.
 *
 * @module
 */

import express, { type Express } from 'express';
import helmet from 'helmet';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ServerConfig } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { FileRepository } from './storage/file-repository.js';
import { TransactionCache } from './cache/transaction-cache.js';
import { createConfigRouter } from './routes/config.js';
import { createAccountsRouter } from './routes/accounts.js';
import { createHealthRouter } from './routes/health.js';
import { createTransactionsRouter } from './routes/transactions.js';
import { createTransactionEditsRouter } from './routes/transaction-edits.js';
import { createImportRouter } from './routes/import.js';

// ESM polyfill: resolve the directory of the compiled app.js at runtime.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create and configure the Express app.
 *
 * @param config - The server configuration.
 * @returns The configured Express application.
 */
export function createApp(config: ServerConfig): Express {
  const app = express();

  // --- Middleware ---

  // Sensible browser security headers (CSP, frame protection, MIME sniffing
  // protection, and related defaults). The production UI and API are
  // intentionally same-origin, so Helmet's default policy is appropriate.
  app.use(helmet());

  // API JSON contains configuration and edit rules, never statement files.
  app.use(express.json({ limit: '2mb' }));

  // --- Dependencies ---

  // One server process owns one username-scoped directory.
  const repo = new FileRepository(config.userDataPath);
  const cache = new TransactionCache(repo);

  // --- Routes ---

  app.use('/api/health', createHealthRouter());
  app.use('/api/config', createConfigRouter(config));
  app.use('/api/accounts', createAccountsRouter(config, cache));
  app.use('/api/transactions', createTransactionsRouter(cache));
  app.use('/api/transaction-edits', createTransactionEditsRouter(cache));
  app.use('/api/import', createImportRouter(cache, config));

  // --- Static files (production) ---

  if (process.env['NODE_ENV'] === 'production') {
    const webDistPath = path.resolve(__dirname, '..', '..', 'web', 'dist');
    if (fs.existsSync(webDistPath)) {
      app.use(express.static(webDistPath));
      // SPA fallback: serve index.html for any GET request that didn't
      // match an API route or a static asset. Express 5 requires a
      // named wildcard (`*splat`) rather than the bare `*` accepted
      // by Express 4 -- a RegExp works in both versions.
      app.get(/.*/, (_req, res) => {
        res.sendFile(path.join(webDistPath, 'index.html'));
      });
    }
  }

  // --- Error handler (must be last) ---

  app.use(errorHandler);

  return app;
}
