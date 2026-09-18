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
  });
});
