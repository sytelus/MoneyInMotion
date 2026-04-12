/**
 * Route integration tests using supertest.
 *
 * Tests the Express API endpoints with mocked file system operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createConfigRouter } from '../../src/routes/config.js';
import { createTransactionsRouter } from '../../src/routes/transactions.js';
import { createTransactionEditsRouter } from '../../src/routes/transaction-edits.js';
import type { TransactionCache } from '../../src/cache/transaction-cache.js';
import type { ServerConfig } from '../../src/config.js';
import {
    Transactions,
    ScopeType,
    createScopeFilter,
    editValue,
    createAuditInfo,
} from '@moneyinmotion/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestConfig(): ServerConfig {
    return {
        port: 3001,
        dataPath: '/tmp/test-moneyinmotion',
        statementsDir: '/tmp/test-moneyinmotion/Statements',
        mergedDir: '/tmp/test-moneyinmotion/Merged',
    };
}

function createMockCache(txns?: Transactions): TransactionCache {
    const transactions = txns ?? new Transactions('test');
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
    app.use('/api/config', createConfigRouter(() => config));
    app.use('/api/transactions', createTransactionsRouter(cache));
    app.use('/api/transaction-edits', createTransactionEditsRouter(cache));
    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/config', () => {
    it('returns config with dataPath, statementsDir, and mergedDir', async () => {
        const config = createTestConfig();
        const cache = createMockCache();
        const app = createTestApp(config, cache);

        const res = await request(app).get('/api/config');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            dataPath: config.dataPath,
            statementsDir: config.statementsDir,
            mergedDir: config.mergedDir,
        });
    });
});

describe('GET /api/transactions', () => {
    it('returns serialized Transactions JSON', async () => {
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

    it('calls cache.getTransactions()', async () => {
        const cache = createMockCache();
        const config = createTestConfig();
        const app = createTestApp(config, cache);

        await request(app).get('/api/transactions');

        expect(cache.getTransactions).toHaveBeenCalledOnce();
    });
});

describe('POST /api/transaction-edits', () => {
    it('applies edits and returns affectedTransactionsCount', async () => {
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

    it('returns 400 for invalid body', async () => {
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
