/**
 * End-to-end browser tests against the built production server.
 *
 * Every run gets a fresh temporary home folder (config + backups) and data
 * root, so the tests can never read or change real financial data. Run with
 * `npm run test:e2e`, which builds first (`npx playwright test` reuses the
 * existing build).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const port = 3920;
// The config module is evaluated once per process, so reuse one sandbox for
// the server and the workers.
const sandbox = process.env.MIM_E2E_SANDBOX ?? fs.mkdtempSync(path.join(os.tmpdir(), 'mim-e2e-'));
process.env.MIM_E2E_SANDBOX = sandbox;
const home = path.join(sandbox, 'home');
const dataRoot = path.join(sandbox, 'root');
if (!fs.existsSync(path.join(home, '.moneyinmotion', 'config.json'))) {
  fs.mkdirSync(path.join(home, '.moneyinmotion'), { recursive: true });
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.writeFileSync(
    path.join(home, '.moneyinmotion', 'config.json'),
    JSON.stringify({ dataRoot, username: 'e2e', port }),
  );
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // No retries: the serial journey shares one data root, so a retry would
  // start from a half-finished state and fail for the wrong reason.
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalTeardown: './e2e/teardown.ts',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node packages/server/dist/index.js',
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    // os.homedir() reads HOME on POSIX and USERPROFILE on Windows.
    env: { NODE_ENV: 'production', HOME: home, USERPROFILE: home },
  },
});
