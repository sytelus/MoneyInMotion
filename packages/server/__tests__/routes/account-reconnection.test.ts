import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { buildConfig } from '../../src/config.js';
import { createApp } from '../../src/app.js';
import { Transaction, Transactions, TransactionReason } from '@moneyinmotion/core';

describe('explicit account reconnection', () => {
  let temporary: string;
  beforeEach(() => {
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-reconnect-test-'));
  });
  afterEach(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  const account = {
    accountInfo: {
      id: 'original-bank',
      instituteName: 'Generic',
      title: 'My Bank',
      type: 2,
      requiresParent: false,
    },
    fileFilters: ['*.csv'],
    scanSubFolders: true,
  };

  it('discovers and reconnects a preserved folder using its original account identity', async () => {
    const config = buildConfig(temporary, 'tester', 3001);
    const folder = path.join(config.statementsDir, 'BankFolder');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'statement.csv'), 'do not change');
    const app = createApp(config);
    expect((await request(app).get('/api/accounts/disconnected')).body).toEqual([
      { relativeDirectory: 'BankFolder', originalAccount: null, identityStatus: 'unknown' },
    ]);
    const result = await request(app).post('/api/accounts/BankFolder/reconnect').send(account);
    expect(result.status).toBe(201);
    expect(result.body.relativeDirectory).toBe('BankFolder');
    expect(result.body.config.accountInfo.id).toBe('original-bank');
    expect(result.body.hasStatementFiles).toBe(true);
    expect(fs.readFileSync(path.join(folder, 'statement.csv'), 'utf8')).toBe('do not change');
    expect((await request(app).get('/api/accounts/disconnected')).body).toEqual([]);
    expect(
      (await request(app).post('/api/accounts/BankFolder/reconnect').send(account)).status,
    ).toBe(409);
  });
  it('does not turn a normal creation into reconnection or follow a folder symlink', async () => {
    const config = buildConfig(temporary, 'tester', 3001);
    const folder = path.join(config.statementsDir, 'original-bank');
    fs.mkdirSync(folder, { recursive: true });
    const app = createApp(config);
    expect((await request(app).post('/api/accounts').send(account)).status).toBe(409);
    fs.symlinkSync(folder, path.join(config.statementsDir, 'linked'));
    expect((await request(app).get('/api/accounts/disconnected')).body).toEqual([
      { relativeDirectory: 'original-bank', originalAccount: null, identityStatus: 'unknown' },
    ]);
    expect((await request(app).post('/api/accounts/linked/reconnect').send(account)).status).toBe(
      409,
    );
    expect(fs.existsSync(path.join(folder, 'AccountConfig.json'))).toBe(false);
  });
  it('removes configuration only and keeps statements available for reconnection', async () => {
    const config = buildConfig(temporary, 'tester', 3001);
    const app = createApp(config);
    expect((await request(app).post('/api/accounts').send(account)).status).toBe(201);
    const folder = path.join(config.statementsDir, 'original-bank');
    fs.writeFileSync(path.join(folder, 'statement.csv'), 'original');
    expect((await request(app).delete('/api/accounts/original-bank')).body.keptStatementFiles).toBe(
      true,
    );
    expect((await request(app).get('/api/accounts/disconnected')).body).toEqual([
      { relativeDirectory: 'original-bank', originalAccount: null, identityStatus: 'unknown' },
    ]);
    expect(
      (await request(app).post('/api/accounts/original-bank/reconnect').send(account)).status,
    ).toBe(201);
    expect(fs.readFileSync(path.join(folder, 'statement.csv'), 'utf8')).toBe('original');
  });

  function writeSnapshot(config: ReturnType<typeof buildConfig>, folder: string, ids: string[]) {
    const snapshot = new Transactions('existing');
    for (const [index, id] of ids.entries())
      snapshot.addNew(
        Transaction.create('source', id, false, {
          transactionDate: '2024-01-01',
          amount: -10 - index,
          entityName: 'Store',
          transactionReason: TransactionReason.Purchase,
        }),
        { ...account.accountInfo, id },
        { id: 'source', portableAddress: `${folder}/statement.csv`, contentHash: 'source' },
        false,
      );
    fs.mkdirSync(config.mergedDir, { recursive: true });
    fs.writeFileSync(
      path.join(config.mergedDir, 'LatestMerged.json'),
      JSON.stringify(snapshot.serialize()),
    );
  }

  it('preserves the known historical ID when the actual folder differs and contains spaces', async () => {
    const config = buildConfig(temporary, 'tester', 3001);
    const folder = path.join(config.statementsDir, 'Bank Folder');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'statement.csv'), 'unchanged');
    writeSnapshot(config, 'Bank Folder', ['original-bank']);
    const app = createApp(config);
    expect((await request(app).get('/api/accounts/disconnected')).body).toMatchObject([
      {
        relativeDirectory: 'Bank Folder',
        identityStatus: 'known',
        originalAccount: { id: 'original-bank', title: 'My Bank', instituteName: 'Generic' },
      },
    ]);
    const rejected = await request(app)
      .post('/api/accounts/Bank%20Folder/reconnect')
      .send({ ...account, accountInfo: { ...account.accountInfo, id: 'different-id' } });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error).toContain('original-bank');
    expect(fs.existsSync(path.join(folder, 'AccountConfig.json'))).toBe(false);
    expect(
      (await request(app).post('/api/accounts/Bank%20Folder/reconnect').send(account)).status,
    ).toBe(201);
    expect(fs.readFileSync(path.join(folder, 'statement.csv'), 'utf8')).toBe('unchanged');
  });

  it('does not guess an identity when historical source provenance is ambiguous', async () => {
    const config = buildConfig(temporary, 'tester', 3001);
    fs.mkdirSync(path.join(config.statementsDir, 'Bank'), { recursive: true });
    writeSnapshot(config, 'Bank', ['original-bank', 'another-id']);
    const app = createApp(config);
    expect((await request(app).get('/api/accounts/disconnected')).body).toEqual([
      { relativeDirectory: 'Bank', originalAccount: null, identityStatus: 'ambiguous' },
    ]);
    expect((await request(app).post('/api/accounts/Bank/reconnect').send(account)).status).toBe(
      409,
    );
  });
});
