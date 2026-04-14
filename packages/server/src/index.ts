/**
 * Server entry point.
 *
 * Loads configuration and starts the Express server.
 *
 * @module
 */

import * as os from 'node:os';
import { setDefaultAuditUser } from '@moneyinmotion/core';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

// Register the OS username as the default audit identity so that new
// transactions and edits created server-side are attributed to the real user.
try {
    setDefaultAuditUser(os.userInfo().username);
} catch {
    // Fall back to the library's built-in default if userInfo() is unavailable
    // (e.g. some container environments without a password DB entry).
}

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.port, () => {
    const apiUrl = `http://localhost:${config.port}`;
    if (process.env['NODE_ENV'] === 'production') {
        // Production mode: the Express server also serves the built
        // React bundle at `/`, so this is the URL users should open.
        console.log(`MoneyInMotion is running at ${apiUrl}`);
    } else {
        // Dev mode: this process only serves `/api/*`. The React UI is
        // served by the Vite dev server on its own port (see run.sh).
        console.log(`API server listening on ${apiUrl} (dev mode — open the Vite web URL printed above, default http://localhost:5173)`);
    }
    console.log(`Data path: ${config.dataPath}`);
});

// Graceful shutdown
function shutdown(): void {
    console.log('Shutting down...');
    app.cache.dispose();
    server.close(() => {
        process.exit(0);
    });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
