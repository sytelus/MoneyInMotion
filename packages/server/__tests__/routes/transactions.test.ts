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
import type { TransactionCache } from '../../src/cache/transaction-cache.js';
import * as configModule from '../../src/config.js';
import type { ServerConfig } from '../../src/config.js';
import {
    Transactions,
    ScopeType,
    createScopeFilter,
    editValue,
    createAuditInfo,
} from '@moneyinmotion/core';

function createTestConfig(rootDir: string = '/tmp/test-moneyinmotion'): ServerConfig {
    return {
        port: 3001,
        dataPath: rootDir,
        statementsDir: path.join(rootDir, 'Statements'),
        mergedDir: path.join(rootDir, 'Merged'),
    };
}

function createMockCache(
    transactions: unknown = new Transactions('test'),
): TransactionCache {
    return {
        getTransactions: vi.fn().mockResolvedValue(transactions),
        invalidate: vi.fn(),
        applyEdits: vi.fn().mockResolvedValue({ affectedTransactionsCount: 0 }),
        save: vi.fn().mockResolvedValue(undefined),
        scanAndImport: vi.fn().mockResolvedValue({
            newTransactions: 0,
            totalTransactions: 0,
            importedFiles: [],
        }),
        dispose: vi.fn(),
    } as unknown as TransactionCache;
}

function createTestApp(
    config: ServerConfig,
    cache: TransactionCache,
): express.Express {
    const app = express();
    app.use(express.json());
    app.use('/api/health', createHealthRouter());
    app.use('/api/config', createConfigRouter(() => config));
    app.use('/api/accounts', createAccountsRouter(() => config, cache));
    app.use('/api/transactions', createTransactionsRouter(cache));
    app.use('/api/transaction-edits', createTransactionEditsRouter(cache));
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

    it('GET /api/config returns config with port, dataPath, statementsDir, and mergedDir', async () => {
        const config = createTestConfig();
        const cache = createMockCache();
        const app = createTestApp(config, cache);

        const res = await request(app).get('/api/config');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            port: config.port,
            dataPath: config.dataPath,
            statementsDir: config.statementsDir,
            mergedDir: config.mergedDir,
        });
    });

    it('PUT /api/config persists both dataPath and port', async () => {
        const config = createTestConfig();
        const cache = createMockCache();
        const app = createTestApp(config, cache);
        const saveConfigSpy = vi
            .spyOn(configModule, 'saveConfig')
            .mockImplementation(() => undefined);
        const loadConfigSpy = vi
            .spyOn(configModule, 'loadConfig')
            .mockReturnValue({
                port: 4010,
                dataPath: '/tmp/new-moneyinmotion',
                statementsDir: '/tmp/new-moneyinmotion/Statements',
                mergedDir: '/tmp/new-moneyinmotion/Merged',
            });

        const res = await request(app)
            .put('/api/config')
            .send({
                dataPath: '/tmp/new-moneyinmotion',
                port: 4010,
            })
            .set('Content-Type', 'application/json');

        expect(res.status).toBe(200);
        expect(saveConfigSpy).toHaveBeenCalledWith({
            dataPath: '/tmp/new-moneyinmotion',
            port: 4010,
        });
        expect(loadConfigSpy).toHaveBeenCalledOnce();
        expect(res.body).toEqual({
            port: 4010,
            dataPath: '/tmp/new-moneyinmotion',
            statementsDir: '/tmp/new-moneyinmotion/Statements',
            mergedDir: '/tmp/new-moneyinmotion/Merged',
        });
    });

    it('PUT /api/config returns 400 for invalid port', async () => {
        const config = createTestConfig();
        const cache = createMockCache();
        const app = createTestApp(config, cache);

        const res = await request(app)
            .put('/api/config')
            .send({
                dataPath: '/tmp/new-moneyinmotion',
                port: 70000,
            })
            .set('Content-Type', 'application/json');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
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
        const checking = body.find(
            (item) => item.config.accountInfo.id === 'acct-checking',
        );
        expect(checking.stats.transactionCount).toBe(2);
        expect(checking.stats.lastImportedAt).toBe('2024-02-01T08:00:00Z');
        expect(checking.hasStatementFiles).toBe(false);

        const credit = body.find(
            (item) => item.config.accountInfo.id === 'acct-credit',
        );
        expect(credit.stats.transactionCount).toBe(1);
        expect(credit.hasStatementFiles).toBe(true);
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
        expect(res.body.config.accountInfo.interAccountNameTags).toEqual([
            'PAYPAL',
            'TRANSFER',
        ]);
        expect(res.body.config.scanSubFolders).toBe(false);

        const savedConfig = JSON.parse(
            fs.readFileSync(path.join(accountDir, 'AccountConfig.json'), 'utf-8'),
        );
        expect(savedConfig.accountInfo.title).toBe('Updated Title');
        expect(savedConfig.fileFilters).toEqual(['*.csv', '*.iif']);
        expect(savedConfig.scanSubFolders).toBe(false);
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

    it('POST /api/accounts/:id/upload stores uploaded files in the account folder', async () => {
        const accountDir = writeAccountConfig(tempDir, 'acct-checking', {
            fileFilters: ['*.csv', '*.json'],
        });
        const cache = createMockCache({
            allParentChildTransactions: [],
        });
        const config = createTestConfig(tempDir);
        const app = createTestApp(config, cache);

        const res = await request(app)
            .post('/api/accounts/acct-checking/upload')
            .attach('files', Buffer.from('Date,Amount\n2024-01-01,-10.00\n'), 'statement.csv')
            .attach('files', Buffer.from('[]\n'), 'orders.json');

        expect(res.status).toBe(201);
        expect(res.body.accountId).toBe('acct-checking');
        expect(res.body.uploadedFiles).toHaveLength(2);
        expect(fs.existsSync(path.join(accountDir, 'statement.csv'))).toBe(true);
        expect(fs.existsSync(path.join(accountDir, 'orders.json'))).toBe(true);
    });

    it('POST /api/accounts/:id/upload rejects files that do not match file filters', async () => {
        const accountDir = writeAccountConfig(tempDir, 'acct-checking', {
            fileFilters: ['*.csv'],
        });
        const cache = createMockCache({
            allParentChildTransactions: [],
        });
        const config = createTestConfig(tempDir);
        const app = createTestApp(config, cache);

        const res = await request(app)
            .post('/api/accounts/acct-checking/upload')
            .attach('files', Buffer.from('%PDF-1.7\n'), 'statement.pdf');

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('does not match this account');
        expect(fs.existsSync(path.join(accountDir, 'statement.pdf'))).toBe(false);
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
                scopeFilters: [
                    createScopeFilter(ScopeType.TransactionId, ['tx-1']),
                ],
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
});
