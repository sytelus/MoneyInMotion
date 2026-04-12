/**
 * Server entry point.
 *
 * Loads configuration and starts the Express server.
 *
 * @module
 */

import { loadConfig } from './config.js';
import { createApp } from './app.js';

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
