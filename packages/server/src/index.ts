/**
 * Server entry point: recover an interrupted restore, load the config, and
 * listen. Startup problems print one plain message and exit with status 1.
 *
 * @module
 */

import { setDefaultAuditUser } from '@moneyinmotion/core';
import { loadConfig, type ServerConfig } from './config.js';
import { createApp } from './app.js';
import { recoverInterruptedRestore } from './services/backup-service.js';
import { listenErrorMessage, listenUrl } from './startup.js';

function exitWith(message: string): never {
  console.error(message);
  process.exit(1);
}

let config: ServerConfig;
try {
  if (recoverInterruptedRestore())
    console.warn('Recovered the previous data after an interrupted restore.');
  config = loadConfig();
} catch (error) {
  exitWith(error instanceof Error ? error.message : String(error));
}
// With no login, the configured storage username is the audit identity on edits.
setDefaultAuditUser(config.username);

// Express 5 passes a failure to bind (such as a busy port) to this callback.
const server = createApp(config).listen(config.port, config.host, (error?: Error) => {
  if (error) exitWith(listenErrorMessage(error, config.host, config.port));
  const url = listenUrl(config.host, config.port);
  if (process.env['NODE_ENV'] === 'production') {
    // The server also serves the built website, so this is the URL to open.
    console.log(`MoneyInMotion is running at ${url} (listening on ${config.host})`);
  } else {
    // Dev mode serves only /api; the Vite dev server serves the website.
    console.log(
      `API server listening on ${url} (dev mode — open the Vite web URL printed above, default http://localhost:5173)`,
    );
  }
  // Avoid copying server filesystem paths into long-lived service journals.
  console.log(`Active storage username: ${config.username}`);
});

function shutdown(): void {
  console.log('Shutting down...');
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// Windows: Ctrl+Break and closing the console window.
process.on('SIGBREAK', shutdown);
process.on('SIGHUP', shutdown);
