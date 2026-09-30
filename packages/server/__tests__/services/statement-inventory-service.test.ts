import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { AccountType } from '@moneyinmotion/core';
import { buildConfig, type ServerConfig } from '../../src/config.js';
import { createApp } from '../../src/app.js';
import { readStatementInventory } from '../../src/services/statement-inventory-service.js';

describe('read-only statement explorer inventory', () => {
  let temporary: string;
  let config: ServerConfig;
  const settings = {
    accountInfo: {
      id: 'bank',
      title: 'Bank',
      instituteName: 'Generic',
      type: AccountType.BankChecking,
      requiresParent: false,
      interAccountNameTags: [],
    },
    fileFilters: ['*.csv', '*.xls'],
    scanSubFolders: true,
  };
  const write = (relative: string, content = 'not parsed by the explorer') => {
    const file = path.join(config.statementsDir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
  };
  beforeEach(() => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-statement-inventory-'));
    config = buildConfig(temporary, 'tester', 3001);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(temporary, { recursive: true, force: true });
  });

  it('annotates real folders, exclusions and unsupported formats without parsing statement bodies', async () => {
    write('bank/AccountConfig.json', JSON.stringify(settings));
    write('bank/2024/January.CSV');
    write('bank/2024/AccountConfig.json', 'nested configuration is intentionally ignored');
    write('bank/export.xls');
    write('bank/notes.txt');
    write('unconfigured/data.csv');
    write('orphan.csv');
    const result = readStatementInventory(config);
    const entry = (name: string) => result.entries.find((item) => item.path === name);
    expect(entry('bank')).toMatchObject({ fileCount: 3, eligibleCount: 1, accountId: 'bank' });
    expect(entry('bank/2024')).toMatchObject({ fileCount: 1, eligibleCount: 1 });
    expect(entry('bank/2024/January.CSV')).toMatchObject({
      status: 'eligible',
      kind: 'file',
      sizeBytes: 26,
    });
    expect(entry('bank/2024/AccountConfig.json')).toMatchObject({ status: 'configuration' });
    expect(entry('bank/notes.txt')).toMatchObject({ status: 'ignored' });
    expect(entry('bank/export.xls')).toMatchObject({ status: 'unsupported' });
    expect(entry('unconfigured/data.csv')).toMatchObject({ status: 'unconfigured' });
    expect(entry('orphan.csv')).toMatchObject({ status: 'unconfigured' });
    expect(result).toMatchObject({ truncated: false, unreadableFolders: 0 });
    const response = await request(createApp(config)).get('/api/import/files');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(result);
    expect(
      fs.readFileSync(path.join(config.statementsDir, 'bank/AccountConfig.json'), 'utf8'),
    ).toBe(JSON.stringify(settings));
  });

  it('shows nested files as ignored when the account disables subfolders', () => {
    write('bank/AccountConfig.json', JSON.stringify({ ...settings, scanSubFolders: false }));
    write('bank/current.csv');
    write('bank/year/old.csv');
    const result = readStatementInventory(config);
    expect(result.entries.find((item) => item.path === 'bank')).toMatchObject({
      fileCount: 2,
      eligibleCount: 1,
    });
    expect(result.entries.find((item) => item.path === 'bank/year/old.csv')).toMatchObject({
      status: 'ignored',
      reason: 'Subfolders are disabled for this account.',
    });
  });

  it('does not traverse links to outside files or directories, or count them as statements', () => {
    write('bank/AccountConfig.json', JSON.stringify(settings));
    const outside = path.join(temporary, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'secret.csv'), 'private');
    fs.symlinkSync(outside, path.join(config.statementsDir, 'bank', 'linked-directory'));
    fs.symlinkSync(
      path.join(outside, 'secret.csv'),
      path.join(config.statementsDir, 'bank', 'linked.csv'),
    );
    const result = readStatementInventory(config);
    expect(result.entries.filter((item) => item.status === 'symlink')).toHaveLength(2);
    expect(result.entries.some((item) => item.path.includes('secret'))).toBe(false);
    expect(result.entries.find((item) => item.path === 'bank')).toMatchObject({
      fileCount: 0,
      eligibleCount: 0,
    });
    fs.symlinkSync(outside, path.join(temporary, 'root-link'));
    expect(() =>
      readStatementInventory({ ...config, statementsDir: path.join(temporary, 'root-link') }),
    ).toThrow('real directory');
  });

  it('rejects linked or malformed account configs instead of claiming their files are eligible', () => {
    write('bank/AccountConfig.json', '{invalid');
    expect(() => readStatementInventory(config)).toThrow('Invalid account config');
    fs.renameSync(
      path.join(config.statementsDir, 'bank/AccountConfig.json'),
      path.join(temporary, 'saved-config'),
    );
    fs.symlinkSync(
      path.join(temporary, 'saved-config'),
      path.join(config.statementsDir, 'bank/AccountConfig.json'),
    );
    expect(() => readStatementInventory(config)).toThrow('not a symbolic link');
  });

  it('discloses traversal limits and handles a missing directory without creating it', () => {
    expect(readStatementInventory(config)).toEqual({
      entries: [],
      truncated: false,
      unreadableFolders: 0,
    });
    expect(fs.existsSync(config.statementsDir)).toBe(false);
    write('bank/AccountConfig.json', JSON.stringify(settings));
    write('bank/year/month/data.csv');
    expect(readStatementInventory(config, { maxEntries: 2, maxDepth: 40 })).toMatchObject({
      truncated: true,
    });
    const shallow = readStatementInventory(config, { maxEntries: 100, maxDepth: 1 });
    expect(shallow.truncated).toBe(true);
    expect(shallow.entries.some((item) => item.path.endsWith('data.csv'))).toBe(false);
  });
});
