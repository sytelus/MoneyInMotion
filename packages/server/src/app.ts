/**
 * Express application setup.
 *
 * Builds the Express app with JSON body parsing, CORS, route mounting,
 * an error handler, and (in production) static file serving of the
 * built React app with SPA-fallback routing.
 *
 * @module
 */

import express, { type Express } from 'express';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ServerConfig } from './config.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { FileRepository } from './storage/file-repository.js';
import { TransactionCache } from './cache/transaction-cache.js';
import { createConfigRouter } from './routes/config.js';
import { createAccountsRouter } from './routes/accounts.js';
import { createTransactionsRouter } from './routes/transactions.js';
import { createTransactionEditsRouter } from './routes/transaction-edits.js';
import { createImportRouter } from './routes/import.js';

// ESM polyfill: resolve the directory of the compiled app.js at runtime.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create and configure the Express app.
 *
 * @param config - The server configuration.
 * @returns The configured Express app with a `cache` property attached for
 *          shutdown handling (see `app.cache.dispose()` in index.ts).
 */
export function createApp(config: ServerConfig): Express & { cache: TransactionCache } {
    const app = express() as Express & { cache: TransactionCache };

    // --- Middleware ---

    // JSON body parser with 50MB limit for large transaction files
    app.use(express.json({ limit: '50mb' }));

    // CORS
    app.use(corsMiddleware);

    // --- Dependencies ---

    const repo = new FileRepository(config.dataPath);
    const cache = new TransactionCache(config, repo);
    app.cache = cache;

    // Config accessor passed to routes that need server config. The reference
    // is stable for the lifetime of the Express app -- PUT /api/config
    // persists to disk but does not update this in-memory copy, which means
    // data-path changes only take effect after a server restart.
    const getConfig = () => config;

    // --- Routes ---

    app.use('/api/config', createConfigRouter(getConfig));
    app.use('/api/accounts', createAccountsRouter(getConfig));
    app.use('/api/transactions', createTransactionsRouter(cache));
    app.use('/api/transaction-edits', createTransactionEditsRouter(cache));
    app.use('/api/import', createImportRouter(cache));

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
