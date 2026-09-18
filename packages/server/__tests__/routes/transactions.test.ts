/**
 * Route integration tests using supertest.
 *
 * Covers config, accounts, transactions, and edit endpoints with a mix of
 * mocked cache responses and temporary filesystem fixtures.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import request from 'supertest';
import express from 'express';
import { createConfigRouter } from '../../src/routes/config.js';
import { createAccountsRouter } from '../../src/routes/accounts.js';
import { createHealthRouter } from '../../src/routes/health.js';
import { createTransactionsRouter } from '../../src/routes/transactions.js';
import { createTransactionEditsRouter } from '../../src/routes/transaction-edits.js';
import { createImportRouter } from '../../src/routes/import.js';
import { errorHandler } from '../../src/middleware/error-handler.js';
import type { TransactionCache } from '../../src/cache/transaction-cache.js';
import * as configModule from '../../src/config.js';
import type { ServerConfig } from '../../src/config.js';
import {
  Transactions,
  ScopeType,
  createScopeFilter,
  editValue,
  createAuditInfo,
  voidedEditValue,
  TransactionEditTargetError,
} from '@moneyinmotion/core';

function createTestConfig(rootDir: string = '/tmp/test-moneyinmotion'): ServerConfig {
  return {
    port: 3001,
    dataRoot: path.dirname(rootDir),
    username: path.basename(rootDir),
    userDataPath: rootDir,
    statementsDir: path.join(rootDir, 'Statements'),
    mergedDir: path.join(rootDir, 'Merged'),
    stagingDir: path.join(rootDir, 'staging'),
  };
}

function createMockCache(transactions: unknown = new Transactions('test')): TransactionCache {
  return {
    getTransactions: vi.fn().mockResolvedValue(transactions),
    applyEdits: vi.fn().mockResolvedValue({ affectedTransactionsCount: 0 }),
    save: vi.fn().mockResolvedValue(undefined),
    rebuildFromStatements: vi.fn().mockResolvedValue({
      committed: true,
      previousTransactionCount: 0,
      newTransactions: 0,
      totalTransactions: 0,
      importedFiles: [],
      failedFiles: [],
      appliedEdits: 0,
      migratedEditTargets: 0,
      unresolvedEditTargets: 0,
    }),
  } as unknown as TransactionCache;
}

function createTestApp(config: ServerConfig, cache: TransactionCache): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/health', createHealthRouter());
  app.use('/api/config', createConfigRouter(config));
  app.use('/api/accounts', createAccountsRouter(config, cache));
  app.use('/api/transactions', createTransactionsRouter(cache));
  app.use('/api/transaction-edits', createTransactionEditsRouter(cache));
  app.use('/api/import', createImportRouter(cache, config));
  app.use(errorHandler);
  return app;
}

interface AccountSummaryResponse {
  config: {
    accountInfo: {
      id: string;
    };
  };
  stats: {
    transactionCount: number;
    lastImportedAt: string | null;
  };
  hasStatementFiles: boolean;
  relativeDirectory: string;
}

function writeAccountConfig(
  rootDir: string,
  accountId: string,
  overrides?: Partial<{
    instituteName: string;
    title: string;
    type: number;
    requiresParent: boolean;
    interAccountNameTags: string[];
    fileFilters: string[];
    scanSubFolders: boolean;
  }>,
): string {
  const accountDir = path.join(rootDir, 'Statements', accountId);
  fs.mkdirSync(accountDir, { recursive: true });
  fs.writeFileSync(
    path.join(accountDir, 'AccountConfig.json'),
    JSON.stringify(
      {
        accountInfo: {
          id: accountId,
          instituteName: overrides?.instituteName ?? 'TestBank',
          title: overrides?.title ?? 'Test Account',
          type: overrides?.type ?? 1,
          requiresParent: overrides?.requiresParent ?? false,
          interAccountNameTags: overrides?.interAccountNameTags ?? ['TRANSFER'],
        },
        fileFilters: overrides?.fileFilters ?? ['*.csv'],
        scanSubFolders: overrides?.scanSubFolders ?? true,
      },
      null,
      2,
    ),
    'utf-8',
  );
  return accountDir;
}

describe('config routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/config returns saved + active configuration with restart flag', async () => {
    const config = createTestConfig();
    const cache = createMockCache();
    const app = createTestApp(config, cache);

    // Stub loadConfig (the "saved" source) so the test does not depend
    // on the host machine's ~/.moneyinmotion/config.json.
    vi.spyOn(configModule, 'loadConfig').mockReturnValue(config);

    const res = await request(app).get('/api/config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      port: config.port,
      dataRoot: config.dataRoot,
      username: config.username,
      userDataPath: config.userDataPath,
      statementsDir: config.statementsDir,
      mergedDir: config.mergedDir,
      stagingDir: config.stagingDir,
      activePort: config.port,
      activeDataRoot: config.dataRoot,
      activeUsername: config.username,
      activeUserDataPath: config.userDataPath,
      restartRequired: false,
    });
  });

  it('GET /api/config flags restartRequired when saved differs from active', async () => {
    const active = createTestConfig('/tmp/active-mim');
    const cache = createMockCache();
    const app = createTestApp(active, cache);

    // Saved config on disk is different from the active in-memory copy.
    vi.spyOn(configModule, 'loadConfig').mockReturnValue(createTestConfig('/tmp/saved-mim'));

    const res = await request(app).get('/api/config');

    expect(res.status).toBe(200);
    expect(res.body.userDataPath).toBe('/tmp/saved-mim');
    expect(res.body.activeUserDataPath).toBe('/tmp/active-mim');
    expect(res.body.restartRequired).toBe(true);
  });

  it('PUT /api/config persists dataRoot, username, and port', async () => {
    const config = createTestConfig();
    const cache = createMockCache();
    const app = createTestApp(config, cache);
    const saveConfigSpy = vi.spyOn(configModule, 'saveConfig').mockImplementation(() => undefined);
    vi.spyOn(configModule, 'loadConfig').mockReturnValue(createTestConfig('/tmp/new-root/alex'));

    const res = await request(app)
      .put('/api/config')
      .send({
        dataRoot: '/tmp/new-root',
        username: 'alex',
        port: 4010,
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(saveConfigSpy).toHaveBeenCalledWith({
      dataRoot: '/tmp/new-root',
      username: 'alex',
      port: 4010,
    });
    expect(res.body.userDataPath).toBe('/tmp/new-root/alex');
    expect(res.body.activeUserDataPath).toBe(config.userDataPath);
    expect(res.body.restartRequired).toBe(true);
  });

  it('PUT /api/config returns 400 for invalid path identifiers and ports', async () => {
    const config = createTestConfig();
    const cache = createMockCache();
    const app = createTestApp(config, cache);

    const res = await request(app)
      .put('/api/config')
      .send({
        dataRoot: '/tmp/new-moneyinmotion',
        port: 70000,
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');

    const unsafeUsername = await request(app)
      .put('/api/config')
      .send({ username: '.' })
      .set('Content-Type', 'application/json');

    expect(unsafeUsername.status).toBe(400);
    expect(unsafeUsername.body.error).toContain('must not be "."');
  });
});

describe('health routes', () => {
  it('GET /api/health returns a liveness payload', async () => {
    const config = createTestConfig();
    const cache = createMockCache();
    const app = createTestApp(config, cache);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.environment).toBe('string');
    expect(typeof res.body.timestamp).toBe('string');
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });
});

describe('accounts routes', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyinmotion-routes-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /api/accounts returns stats and statement-file presence', async () => {
    writeAccountConfig(tempDir, 'acct-checking', {
      title: 'Checking',
      interAccountNameTags: ['AMEX'],
    });
    const creditDir = writeAccountConfig(tempDir, 'acct-credit', {
      title: 'Credit Card',
      interAccountNameTags: ['CHASE'],
    });
    fs.writeFileSync(path.join(creditDir, 'statement.csv'), 'Date,Amount\n', 'utf-8');

    const cache = createMockCache({
      allParentChildTransactions: [
        {
          accountId: 'acct-checking',
          auditInfo: { createDate: '2024-01-01T08:00:00Z' },
        },
        {
          accountId: 'acct-checking',
          auditInfo: { createDate: '2024-02-01T08:00:00Z' },
        },
        {
          accountId: 'acct-credit',
          auditInfo: { createDate: '2024-03-01T08:00:00Z' },
        },
      ],
    });
    const config = createTestConfig(tempDir);
    const app = createTestApp(config, cache);

    const res = await request(app).get('/api/accounts');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const body = res.body as AccountSummaryResponse[];
    const checking = body.find((item) => item.config.accountInfo.id === 'acct-checking');
    expect(checking.stats.transactionCount).toBe(2);
    expect(checking.stats.lastImportedAt).toBe('2024-02-01T08:00:00Z');
    expect(checking.hasStatementFiles).toBe(false);

    const credit = body.find((item) => item.config.accountInfo.id === 'acct-credit');
    expect(credit.stats.transactionCount).toBe(1);
    expect(credit.hasStatementFiles).toBe(true);
  });

  it('GET /api/accounts ignores empty nested folders but counts nested statement files', async () => {
    const emptyNestedDir = writeAccountConfig(tempDir, 'acct-empty-nested', {
      title: 'Empty Nested',
      scanSubFolders: true,
    });
    fs.mkdirSync(path.join(emptyNestedDir, '2024', 'Q1'), { recursive: true });

    const nestedFileDir = writeAccountConfig(tempDir, 'acct-nested-files', {
      title: 'Nested Files',
      scanSubFolders: true,
    });
    const nestedStatementDir = path.join(nestedFileDir, '2024');
    fs.mkdirSync(nestedStatementDir, { recursive: true });
    fs.writeFileSync(path.join(nestedStatementDir, 'statement.csv'), 'Date,Amount\n', 'utf-8');

    const cache = createMockCache({
      allParentChildTransactions: [],
    });
    const config = createTestConfig(tempDir);
    const app = createTestApp(config, cache);

    const res = await request(app).get('/api/accounts');

    expect(res.status).toBe(200);

    const body = res.body as AccountSummaryResponse[];
    const emptyNested = body.find((item) => item.config.accountInfo.id === 'acct-empty-nested');
    const nestedFiles = body.find((item) => item.config.accountInfo.id === 'acct-nested-files');

    expect(emptyNested.hasStatementFiles).toBe(false);
    expect(nestedFiles.hasStatementFiles).toBe(true);
  });

  it('GET /api/accounts reports a corrupt config instead of returning a partial list', async () => {
    writeAccountConfig(tempDir, 'valid-account');
    const corruptDir = path.join(tempDir, 'Statements', 'corrupt-account');
    fs.mkdirSync(corruptDir, { recursive: true });
    fs.writeFileSync(path.join(corruptDir, 'AccountConfig.json'), '{broken json', 'utf-8');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createTestApp(
      createTestConfig(tempDir),
      createMockCache({ allParentChildTransactions: [] }),
    );

    const res = await request(app).get('/api/accounts');

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ status: 422 });
    expect(res.body.error).toContain('corrupt-account/AccountConfig.json');
  });

  it('POST /api/accounts ignores non-top-level AccountConfig files', async () => {
    const existingDir = writeAccountConfig(tempDir, 'group/existing', {
      title: 'Existing',
    });
    const existingPath = path.join(existingDir, 'AccountConfig.json');
    const existingConfig = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
    existingConfig.accountInfo.id = 'existing';
    fs.writeFileSync(existingPath, JSON.stringify(existingConfig));
    const app = createTestApp(
      createTestConfig(tempDir),
      createMockCache({
        allParentChildTransactions: [],
      }),
    );

    const res = await request(app)
      .post('/api/accounts')
      .send({
        accountInfo: {
          id: 'EXISTING',
          instituteName: 'Bank',
          title: 'Duplicate',
          type: 2,
          requiresParent: false,
          interAccountNameTags: [],
        },
        fileFilters: ['*.csv'],
        scanSubFolders: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.config.accountInfo.id).toBe('EXISTING');
    expect(fs.existsSync(path.join(tempDir, 'Statements', 'EXISTING', 'AccountConfig.json'))).toBe(
      true,
    );
  });

  it('POST /api/accounts rejects an ID that resolves to the Statements directory itself', async () => {
    const app = createTestApp(
      createTestConfig(tempDir),
      createMockCache({ allParentChildTransactions: [] }),
    );

    const res = await request(app)
      .post('/api/accounts')
      .send({
        accountInfo: {
          id: '.',
          instituteName: 'Bank',
          title: 'Unsafe account',
          type: 2,
          requiresParent: false,
          interAccountNameTags: [],
        },
        fileFilters: ['*.csv'],
        scanSubFolders: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('must not be "."');
    expect(fs.existsSync(path.join(tempDir, 'Statements', 'AccountConfig.json'))).toBe(false);
  });

  it('POST /api/accounts derives requiresParent from the account type', async () => {
    const app = createTestApp(
      createTestConfig(tempDir),
      createMockCache({
        allParentChildTransactions: [],
      }),
    );

    const res = await request(app)
      .post('/api/accounts')
      .send({
        accountInfo: {
          id: 'orders',
          instituteName: 'Amazon',
          title: 'Orders',
          type: 5,
          requiresParent: false,
          interAccountNameTags: ['AMAZON'],
        },
        fileFilters: ['*.json'],
        scanSubFolders: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.config.accountInfo.requiresParent).toBe(true);
  });

  it('POST /api/accounts rejects unsupported order-history configurations', async () => {
    const app = createTestApp(
      createTestConfig(tempDir),
      createMockCache({ allParentChildTransactions: [] }),
    );
    const baseConfig = {
      accountInfo: {
        id: 'orders',
        instituteName: 'Generic',
        title: 'Orders',
        type: 5,
        requiresParent: true,
        interAccountNameTags: ['SHOP'],
      },
      fileFilters: ['*.csv'],
      scanSubFolders: true,
    };

    const unsupported = await request(app).post('/api/accounts').send(baseConfig);
    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error).toContain('Amazon and Etsy');

    const missingTags = await request(app)
      .post('/api/accounts')
      .send({
        ...baseConfig,
        accountInfo: {
          ...baseConfig.accountInfo,
          instituteName: 'Amazon',
          interAccountNameTags: [],
        },
      });
    expect(missingTags.status).toBe(400);
    expect(missingTags.body.error).toContain('match tag');
  });

  it('PUT /api/accounts/:id updates the account config', async () => {
    const accountDir = writeAccountConfig(tempDir, 'acct-checking', {
      title: 'Old Title',
      interAccountNameTags: ['OLD'],
      scanSubFolders: true,
    });
    const cache = createMockCache({
      allParentChildTransactions: [],
    });
    const config = createTestConfig(tempDir);
    const app = createTestApp(config, cache);

    const res = await request(app)
      .put('/api/accounts/acct-checking')
      .send({
        accountInfo: {
          id: 'acct-checking',
          instituteName: 'PayPal',
          title: 'Updated Title',
          type: 6,
          requiresParent: false,
          interAccountNameTags: ['PAYPAL', 'TRANSFER'],
        },
        fileFilters: ['*.csv', '*.iif'],
        scanSubFolders: false,
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.config.accountInfo.title).toBe('Updated Title');
    expect(res.body.config.accountInfo.interAccountNameTags).toEqual(['PAYPAL', 'TRANSFER']);
    expect(res.body.config.scanSubFolders).toBe(false);

    const savedConfig = JSON.parse(
      fs.readFileSync(path.join(accountDir, 'AccountConfig.json'), 'utf-8'),
    );
    expect(savedConfig.accountInfo.title).toBe('Updated Title');
    expect(savedConfig.fileFilters).toEqual(['*.csv', '*.iif']);
    expect(savedConfig.scanSubFolders).toBe(false);
  });

  it('PUT /api/accounts/:id treats request-path IDs case-insensitively', async () => {
    writeAccountConfig(tempDir, 'acct-checking');
    const cache = createMockCache({
      allParentChildTransactions: [
        {
          accountId: 'acct-checking',
          auditInfo: { createDate: '2024-02-01T08:00:00Z' },
        },
      ],
    });
    const app = createTestApp(createTestConfig(tempDir), cache);

    const res = await request(app)
      .put('/api/accounts/ACCT-CHECKING')
      .send({
        accountInfo: {
          id: 'acct-checking',
          instituteName: 'TestBank',
          title: 'Updated without a rename',
          type: 1,
          requiresParent: false,
          interAccountNameTags: ['TRANSFER'],
        },
        fileFilters: ['*.csv'],
        scanSubFolders: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.stats.transactionCount).toBe(1);
    expect(fs.existsSync(path.join(tempDir, 'Statements', 'acct-checking'))).toBe(true);
  });

  it('PUT /api/accounts/:id renames an empty account directory and its stored identity', async () => {
    writeAccountConfig(tempDir, 'temporary-account');
    const app = createTestApp(
      createTestConfig(tempDir),
      createMockCache({ allParentChildTransactions: [] }),
    );

    const res = await request(app)
      .put('/api/accounts/temporary-account')
      .send({
        accountInfo: {
          id: 'renamed-account',
          instituteName: 'TestBank',
          title: 'Renamed Account',
          type: 1,
          requiresParent: false,
          interAccountNameTags: ['TRANSFER'],
        },
        fileFilters: ['*.csv'],
        scanSubFolders: true,
      });

    expect(res.status).toBe(200);
    expect(fs.existsSync(path.join(tempDir, 'Statements', 'temporary-account'))).toBe(false);
    const renamedConfig = JSON.parse(
      fs.readFileSync(
        path.join(tempDir, 'Statements', 'renamed-account', 'AccountConfig.json'),
        'utf-8',
      ),
    );
    expect(renamedConfig.accountInfo.id).toBe('renamed-account');
  });

  it('PUT /api/accounts/:id blocks account-id changes after import', async () => {
    writeAccountConfig(tempDir, 'acct-checking');
    const cache = createMockCache({
      allParentChildTransactions: [
        {
          accountId: 'acct-checking',
          auditInfo: { createDate: '2024-02-01T08:00:00Z' },
        },
      ],
    });
    const config = createTestConfig(tempDir);
    const app = createTestApp(config, cache);

    const res = await request(app)
      .put('/api/accounts/acct-checking')
      .send({
        accountInfo: {
          id: 'acct-checking-renamed',
          instituteName: 'TestBank',
          title: 'Checking',
          type: 1,
          requiresParent: false,
          interAccountNameTags: ['TRANSFER'],
        },
        fileFilters: ['*.csv'],
        scanSubFolders: true,
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot be changed');
  });

  it('DELETE /api/accounts/:id removes only AccountConfig.json and keeps statements', async () => {
    const accountDir = writeAccountConfig(tempDir, 'acct-checking');
    const statementPath = path.join(accountDir, 'statement.csv');
    fs.writeFileSync(statementPath, 'Date,Amount\n', 'utf-8');
    const cache = createMockCache({
      allParentChildTransactions: [],
    });
    const config = createTestConfig(tempDir);
    const app = createTestApp(config, cache);

    const res = await request(app).delete('/api/accounts/acct-checking');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      deletedId: 'acct-checking',
      removedDirectory: false,
      keptStatementFiles: true,
    });
    expect(fs.existsSync(path.join(accountDir, 'AccountConfig.json'))).toBe(false);
    expect(fs.existsSync(statementPath)).toBe(true);
  });
});

describe('transactions routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/transactions returns serialized Transactions JSON', async () => {
    const txns = new Transactions('test-collection');
    const cache = createMockCache(txns);
    const config = createTestConfig();
    const app = createTestApp(config, cache);

    const res = await request(app).get('/api/transactions');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'test-collection');
    expect(res.body).toHaveProperty('topItems');
    expect(res.body).toHaveProperty('accountInfos');
    expect(res.body).toHaveProperty('importInfos');
    expect(res.body).toHaveProperty('edits');
  });

  it('GET /api/transactions calls cache.getTransactions()', async () => {
    const cache = createMockCache();
    const config = createTestConfig();
    const app = createTestApp(config, cache);

    await request(app).get('/api/transactions');

    expect(cache.getTransactions).toHaveBeenCalledOnce();
  });
});

describe('transaction edit routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/transaction-edits applies edits and returns affectedTransactionsCount', async () => {
    const cache = createMockCache();
    (cache.applyEdits as ReturnType<typeof vi.fn>).mockResolvedValue({
      affectedTransactionsCount: 5,
    });
    const config = createTestConfig();
    const app = createTestApp(config, cache);

    const edits = [
      {
        id: 'edit-1',
        auditInfo: createAuditInfo(),
        scopeFilters: [createScopeFilter(ScopeType.TransactionId, ['tx-1'])],
        values: {
          note: editValue('test note'),
        },
        sourceId: 'test',
      },
    ];

    const res = await request(app)
      .post('/api/transaction-edits')
      .send(edits)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ affectedTransactionsCount: 5 });
    expect(cache.applyEdits).toHaveBeenCalledOnce();
  });

  it('POST /api/transaction-edits returns 400 for invalid body', async () => {
    const cache = createMockCache();
    const config = createTestConfig();
    const app = createTestApp(config, cache);

    const res = await request(app)
      .post('/api/transaction-edits')
      .send({ invalid: true })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('rejects a field value with the wrong runtime type', async () => {
    const cache = createMockCache();
    const app = createTestApp(createTestConfig(), cache);
    const edit = {
      id: 'edit-bad-amount',
      auditInfo: createAuditInfo(),
      scopeFilters: [createScopeFilter(ScopeType.All, [])],
      values: { amount: { value: '12.34', isVoided: false } },
      sourceId: 'test',
    };

    const res = await request(app).post('/api/transaction-edits').send([edit]);

    expect(res.status).toBe(400);
    expect(cache.applyEdits).not.toHaveBeenCalled();
  });

  it('rejects an invalid scope hash and an empty edited-values object', async () => {
    const cache = createMockCache();
    const app = createTestApp(createTestConfig(), cache);
    const scope = createScopeFilter(ScopeType.All, []);
    const edit = {
      id: 'edit-invalid-scope',
      auditInfo: createAuditInfo(),
      scopeFilters: [{ ...scope, contentHash: '0'.repeat(32) }],
      values: {},
      sourceId: 'test',
    };

    const res = await request(app).post('/api/transaction-edits').send([edit]);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('content hash');
    expect(res.body.error).toContain('edited field');
    expect(cache.applyEdits).not.toHaveBeenCalled();
  });

  it.each([
    [ScopeType.EntityName, ['   '], 'cannot be empty'],
    [ScopeType.TransactionReason, ['not-a-reason'], 'non-negative integers'],
    [ScopeType.AmountRange, ['-10', '20'], 'non-negative magnitudes'],
  ])('rejects invalid parameters for scope type %s', async (type, parameters, message) => {
    const cache = createMockCache();
    const app = createTestApp(createTestConfig(), cache);
    const validParameters =
      type === ScopeType.AmountRange
        ? ['10', '20']
        : type === ScopeType.TransactionReason
          ? ['0']
          : ['valid'];
    const edit = {
      id: `edit-invalid-parameters-${type}`,
      auditInfo: createAuditInfo(),
      scopeFilters: [{ ...createScopeFilter(type, validParameters), parameters }],
      values: { note: editValue('note') },
      sourceId: 'test',
    };

    const res = await request(app).post('/api/transaction-edits').send([edit]);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain(message);
    expect(cache.applyEdits).not.toHaveBeenCalled();
  });

  it('accepts a correctly shaped voiding edit', async () => {
    const cache = createMockCache();
    const app = createTestApp(createTestConfig(), cache);
    const edit = {
      id: 'edit-void-note',
      auditInfo: createAuditInfo(),
      scopeFilters: [createScopeFilter(ScopeType.TransactionId, ['tx-1'])],
      values: { note: voidedEditValue<string>() },
      sourceId: 'test',
    };

    const res = await request(app).post('/api/transaction-edits').send([edit]);

    expect(res.status).toBe(200);
    expect(cache.applyEdits).toHaveBeenCalledWith([edit]);
  });

  it('returns 409 when an exact transaction target is stale', async () => {
    const cache = createMockCache();
    (cache.applyEdits as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TransactionEditTargetError(1, 0),
    );
    const app = createTestApp(createTestConfig(), cache);
    const edit = {
      id: 'edit-stale',
      auditInfo: createAuditInfo(),
      scopeFilters: [createScopeFilter(ScopeType.TransactionId, ['missing'])],
      values: { note: editValue('note') },
      sourceId: 'test',
    };

    const res = await request(app).post('/api/transaction-edits').send([edit]);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('only 0 were found');
  });
});

describe('import routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/import/rebuild returns import stats including failedFiles', async () => {
    const cache = createMockCache();
    (cache.rebuildFromStatements as ReturnType<typeof vi.fn>).mockResolvedValue({
      committed: false,
      previousTransactionCount: 39,
      newTransactions: 3,
      totalTransactions: 42,
      importedFiles: ['MyBank/ok.csv'],
      failedFiles: [{ path: 'MyBank/bad.csv', error: 'boom' }],
      appliedEdits: 4,
      migratedEditTargets: 2,
      unresolvedEditTargets: 1,
    });
    const config = createTestConfig();
    const app = createTestApp(config, cache);

    const res = await request(app).post('/api/import/rebuild');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      committed: false,
      previousTransactionCount: 39,
      newTransactions: 3,
      totalTransactions: 42,
      importedFiles: ['MyBank/ok.csv'],
      failedFiles: [{ path: 'MyBank/bad.csv', error: 'boom' }],
      appliedEdits: 4,
      migratedEditTargets: 2,
      unresolvedEditTargets: 1,
    });
  });

  it('rejects a declared folder request larger than the VM-safe limit', async () => {
    const app = createTestApp(createTestConfig(), createMockCache());

    const res = await request(app)
      .post('/api/import/folder')
      .set('Content-Length', String(101 * 1024 * 1024));

    expect(res.status).toBe(413);
    expect(res.body.error).toContain('100 MiB');
  });

  it('POST /api/import/folder stages, promotes, and triggers a rebuild', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyinmotion-folder-route-'));
    try {
      writeAccountConfig(tempDir, 'acct-checking');
      fs.mkdirSync(path.join(tempDir, 'staging'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'Merged'), { recursive: true });
      const cache = createMockCache();
      const rebuildResult = {
        committed: true,
        previousTransactionCount: 0,
        newTransactions: 1,
        totalTransactions: 1,
        importedFiles: ['acct-checking/statement.csv'],
        failedFiles: [],
        appliedEdits: 0,
        migratedEditTargets: 0,
        unresolvedEditTargets: 0,
      };
      (cache.rebuildFromStatements as ReturnType<typeof vi.fn>).mockResolvedValue(rebuildResult);
      const app = createTestApp(createTestConfig(tempDir), cache);

      const res = await request(app)
        .post('/api/import/folder')
        .field('relativePaths', JSON.stringify(['exports/acct-checking/statement.csv']))
        .attach(
          'files',
          Buffer.from('Date,Description,Amount\n01/01/2024,Example,-10\n'),
          'statement.csv',
        );

      expect(res.status).toBe(201);
      expect(res.body.staging).toMatchObject({
        promotedCount: 1,
        duplicateCount: 0,
        rejectedCount: 0,
      });
      expect(res.body.rebuild).toEqual(rebuildResult);
      expect(cache.rebuildFromStatements).toHaveBeenCalledOnce();
      expect(
        fs.existsSync(path.join(tempDir, 'Statements', 'acct-checking', 'statement.csv')),
      ).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
