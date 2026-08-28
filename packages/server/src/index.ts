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

const config = loadConfig();
// In the pre-authentication architecture the configured storage username is
// the most accurate available audit identity. Fall back to the OS user only
// if a future config source cannot provide it.
try {
  setDefaultAuditUser(config.username || os.userInfo().username);
} catch {
  // The core package retains its safe built-in default.
}
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
    console.log(
      `API server listening on ${apiUrl} (dev mode — open the Vite web URL printed above, default http://localhost:5173)`,
    );
  }
  console.log(`Data root: ${config.dataRoot}`);
  console.log(`Active user data: ${config.userDataPath}`);
});

// Graceful shutdown
function shutdown(): void {
  console.log('Shutting down...');
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
