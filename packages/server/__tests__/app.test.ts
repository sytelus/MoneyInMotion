import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { buildConfig } from '../src/config.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('application HTTP boundaries', () => {
  it('returns the JSON error contract for unknown API routes', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-app-test-'));
    temporaryDirectories.push(directory);
    const app = createApp(buildConfig(directory, 'test-user', 3001));

    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual({ error: 'API endpoint not found.', status: 404 });
  });

  it('adds baseline browser security headers', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-app-test-'));
    temporaryDirectories.push(directory);
    const app = createApp(buildConfig(directory, 'test-user', 3001));

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each([
    { Origin: 'https://unrelated.example' },
    { Origin: 'null' },
    { Origin: 'not a URL' },
    { 'Sec-Fetch-Site': 'cross-site' },
    { 'Sec-Fetch-Site': 'same-site' },
  ])('blocks foreign browser writes before upload processing: %j', async (headers) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-app-test-'));
    temporaryDirectories.push(directory);
    const config = buildConfig(directory, 'test-user', 3001);
    const response = await request(createApp(config))
      .post('/api/import/folder')
      .set(headers)
      .field('relativePaths', JSON.stringify(['Bank/statement.csv']))
      .attach('files', Buffer.from('Date,Amount\n2024-01-01,1'), 'statement.csv');
    expect(response.status).toBe(403);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(fs.existsSync(config.stagingDir)).toBe(false);
    expect(fs.existsSync(config.statementsDir)).toBe(false);
  });

  it.each(['http://localhost:5173', 'https://money.example'])(
    'accepts matching public Host through development and HTTPS proxies: %s',
    async (origin) => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-app-test-'));
      temporaryDirectories.push(directory);
      const response = await request(createApp(buildConfig(directory, 'test-user', 3001)))
        .post('/api/does-not-exist')
        .set({ Origin: origin, Host: new URL(origin).host, 'Sec-Fetch-Site': 'same-origin' });
      expect(response.status).toBe(404);
      expect(response.headers['cache-control']).toBe('no-store');
    },
  );

  it('allows non-browser API clients without browser-origin headers', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-app-test-'));
    temporaryDirectories.push(directory);
    const response = await request(createApp(buildConfig(directory, 'test-user', 3001))).post(
      '/api/does-not-exist',
    );
    expect(response.status).toBe(404);
  });
});
