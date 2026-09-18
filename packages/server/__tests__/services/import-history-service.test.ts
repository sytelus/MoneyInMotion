import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { buildConfig } from '../../src/config.js';
import { readImportHistory } from '../../src/services/import-history-service.js';
import { createApp } from '../../src/app.js';

describe('read-only upload evidence', () => {
  let temporary: string;
  beforeEach(() => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-history-test-'));
  });
  afterEach(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  const filters = { page: 0, pageSize: 10, search: '', status: 'all' as const };
  function writeBatch(id: string, status: 'promoted' | 'duplicate' | 'rejected', day: string) {
    const config = buildConfig(temporary, 'tester', 3001);
    const dir = path.join(config.stagingDir, id);
    fs.mkdirSync(dir, { recursive: true });
    const manifest = {
      batchId: id,
      stagedAt: `2024-01-${day}T00:00:00.000Z`,
      username: 'tester',
      sourceFileCount: 1,
      files: [
        {
          relativePath: `Bank/${id}.csv`,
          accountId: 'bank',
          status,
          sha256: 'a'.repeat(64),
          destinationPath: null,
          duplicateOf: null,
          message: status,
          sizeBytes: 100,
        },
      ],
    };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    return config;
  }
  it('sorts, filters and pages actual manifests without inventing a rebuild result', () => {
    writeBatch('first', 'promoted', '01');
    const config = writeBatch('second', 'rejected', '02');
    const result = readImportHistory(config, { ...filters, pageSize: 1 });
    expect(result.total).toBe(2);
    expect(result.entries[0]?.batchId).toBe('second');
    expect(result.entries[0]).not.toHaveProperty('committed');
    expect(result.entries[0]).not.toHaveProperty('username');
    expect(readImportHistory(config, { ...filters, search: 'BANK first' }).total).toBe(1);
    expect(readImportHistory(config, { ...filters, status: 'rejected' }).entries[0]?.batchId).toBe(
      'second',
    );
    expect(readImportHistory(config, { ...filters, page: 99, pageSize: 1 }).page).toBe(1);
  });
  it('reports malformed, oversized, inconsistent and symlink manifests without following them', () => {
    const config = writeBatch('valid', 'duplicate', '01');
    for (const name of ['broken', 'oversized', 'inconsistent', 'linked'])
      fs.mkdirSync(path.join(config.stagingDir, name));
    fs.writeFileSync(path.join(config.stagingDir, 'broken', 'manifest.json'), '{');
    fs.writeFileSync(
      path.join(config.stagingDir, 'oversized', 'manifest.json'),
      ' '.repeat(2 * 1024 * 1024 + 1),
    );
    fs.copyFileSync(
      path.join(config.stagingDir, 'valid', 'manifest.json'),
      path.join(config.stagingDir, 'inconsistent', 'manifest.json'),
    );
    fs.symlinkSync(
      path.join(config.stagingDir, 'valid', 'manifest.json'),
      path.join(config.stagingDir, 'linked', 'manifest.json'),
    );
    fs.symlinkSync(
      path.join(config.stagingDir, 'valid'),
      path.join(config.stagingDir, 'linked-directory'),
    );
    const result = readImportHistory(config, filters);
    expect(result.total).toBe(1);
    expect(result.unreadableCount).toBe(4);
  });
  it('returns an empty history for older data and validates API query limits', async () => {
    const config = buildConfig(temporary, 'tester', 3001);
    expect(readImportHistory(config, filters).entries).toEqual([]);
    const app = createApp(config);
    expect((await request(app).get('/api/import/history')).status).toBe(200);
    expect((await request(app).get('/api/import/history?pageSize=999')).status).toBe(400);
    expect((await request(app).get('/api/import/history?status=successful')).status).toBe(400);
  });
});
