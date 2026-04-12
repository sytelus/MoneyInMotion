/**
 * Express application setup.
 *
 * Creates the Express app with JSON body parsing, CORS, route mounting,
 * and error handling middleware.
 *
 * @module
 */

import express, { type Express } from 'express';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ServerConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { FileRepository } from './storage/file-repository.js';
import { TransactionCache } from './cache/transaction-cache.js';
import { createConfigRouter } from './routes/config.js';
import { createAccountsRouter } from './routes/accounts.js';
import { createTransactionsRouter } from './routes/transactions.js';
import { createTransactionEditsRouter } from './routes/transaction-edits.js';
import { createImportRouter } from './routes/import.js';

/**
 * Create and configure the Express app.
 *
 * @param config - The server configuration.
 * @returns The configured Express app with a `dispose` function on the cache.
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

    // Config getter (returns the current config; re-reads for PUT updates)
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
            // SPA fallback: serve index.html for non-API routes
            app.get('*', (_req, res) => {
                res.sendFile(path.join(webDistPath, 'index.html'));
            });
        }
    }

    // --- Error handler (must be last) ---

    app.use(errorHandler);

    return app;
}
