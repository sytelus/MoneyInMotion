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
    console.log(`Server running on http://localhost:${config.port}`);
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
