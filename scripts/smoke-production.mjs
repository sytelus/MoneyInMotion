/**
 * Dependency-free smoke test for the production-pruned VM installation.
 *
 * Starts the compiled server twice against an isolated temporary data root and
 * verifies liveness, SPA deep links, Helmet headers, and data persistence. It
 * intentionally uses only Node built-ins so it still runs after `npm prune`.
 */

import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(repositoryRoot, 'packages/server/dist/index.js');
const webEntry = path.join(repositoryRoot, 'packages/web/dist/index.html');

if (!fs.existsSync(serverEntry) || !fs.existsSync(webEntry)) {
  throw new Error('Production artifacts are missing. Run ./install.sh or npm run build first.');
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-production-smoke-'));
const username = 'smoke-user';
let activeChild = null;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (port == null) throw new Error('Could not reserve a smoke-test port.');
  return port;
}

async function stopServer(child) {
  if (child.exitCode != null || child.signalCode != null) return;
  child.kill('SIGTERM');
  const closed = new Promise((resolve) => child.once('close', resolve));
  const timedOut = await Promise.race([closed.then(() => false), delay(5_000).then(() => true)]);
  if (timedOut && child.exitCode == null) {
    child.kill('SIGKILL');
    await closed;
  }
}

async function startServer(port) {
  const output = [];
  const child = spawn(process.execPath, [serverEntry], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      MIM_DATA_ROOT: temporaryRoot,
      MIM_USERNAME: username,
      MIM_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  activeChild = child;
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));

  const healthUrl = `http://127.0.0.1:${port}/api/health`;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`Production server exited early (${child.exitCode}).\n${output.join('')}`);
    }
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return { child, output };
    } catch {
      // The listener may still be starting; retry until the bounded deadline.
    }
    await delay(100);
  }
  await stopServer(child);
  throw new Error(`Production server did not become healthy.\n${output.join('')}`);
}

async function verifyServer(port) {
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  const healthBody = await health.json();
  if (!health.ok || healthBody.status !== 'ok' || healthBody.environment !== 'production') {
    throw new Error(`Unexpected health response: ${JSON.stringify(healthBody)}`);
  }

  const deepLink = await fetch(`http://127.0.0.1:${port}/rules`);
  const html = await deepLink.text();
  if (!deepLink.ok || !html.includes('<div id="root"></div>')) {
    throw new Error('The production server did not serve the React SPA fallback.');
  }
  if (!deepLink.headers.has('content-security-policy')) {
    throw new Error('The production response is missing Helmet security headers.');
  }

  const unknownApi = await fetch(`http://127.0.0.1:${port}/api/not-a-route`);
  const unknownApiBody = await unknownApi.json();
  if (unknownApi.status !== 404 || unknownApiBody.status !== 404) {
    throw new Error(`Unknown API route did not return JSON 404: ${JSON.stringify(unknownApiBody)}`);
  }
}

try {
  const port = await availablePort();
  let running = await startServer(port);
  await verifyServer(port);

  const sentinelPath = path.join(temporaryRoot, username, 'Statements', 'smoke-sentinel.txt');
  fs.writeFileSync(sentinelPath, 'preserve me', 'utf-8');
  await stopServer(running.child);
  activeChild = null;

  running = await startServer(port);
  await verifyServer(port);
  if (fs.readFileSync(sentinelPath, 'utf-8') !== 'preserve me') {
    throw new Error('The configured data root did not survive a server restart.');
  }
  await stopServer(running.child);
  activeChild = null;
  console.log('Production smoke test passed.');
} finally {
  if (activeChild) await stopServer(activeChild);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
