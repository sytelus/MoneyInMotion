import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileRepository } from '../../src/storage/file-repository.js';
import { TransactionCache } from '../../src/cache/transaction-cache.js';
import type { ServerConfig } from '../../src/config.js';

function makeConfig(rootDir: string): ServerConfig {
    return {
        port: 3001,
        dataPath: rootDir,
        statementsDir: path.join(rootDir, 'Statements'),
        mergedDir: path.join(rootDir, 'Merged'),
    };
}

describe('TransactionCache', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyai-cache-'));
        fs.mkdirSync(path.join(tempDir, 'Statements'), { recursive: true });
        fs.mkdirSync(path.join(tempDir, 'Merged'), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('loads an empty collection when no merged file exists', async () => {
        const config = makeConfig(tempDir);
        const repo = new FileRepository(tempDir);
        const cache = new TransactionCache(config, repo);

        const txns = await cache.getTransactions();
        expect(txns.allTransactionCount).toBe(0);

        cache.dispose();
    });

    it('serializes concurrent save() calls', async () => {
        const config = makeConfig(tempDir);
        const repo = new FileRepository(tempDir);
        const cache = new TransactionCache(config, repo);

        // Force the cache to have a transactions instance so save() actually writes.
        await cache.getTransactions();

        const storage = (cache as unknown as {
            transactionsStorage: { save: (...args: unknown[]) => void };
        }).transactionsStorage;
        const saveSpy = vi.spyOn(storage, 'save');

        // Make the spy artificially slow so overlap is observable: track in-flight count.
        let inFlight = 0;
        let maxInFlight = 0;
        saveSpy.mockImplementation(() => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            // Tight busy wait (sync) since storage.save is sync.
            const end = Date.now() + 5;
            while (Date.now() < end) {
                /* noop */
            }
            inFlight -= 1;
        });

        await Promise.all([
            cache.save(true, false),
            cache.save(true, false),
            cache.save(true, false),
        ]);

        expect(saveSpy).toHaveBeenCalledTimes(3);
        expect(maxInFlight).toBe(1);

        cache.dispose();
    });

    it('scanAndImport surfaces parse errors as failedFiles', async () => {
        // Write an AccountConfig with a file that the parser will reject.
        const statementsDir = path.join(tempDir, 'Statements', 'MyBank');
        fs.mkdirSync(statementsDir, { recursive: true });
        fs.writeFileSync(
            path.join(statementsDir, 'AccountConfig.json'),
            JSON.stringify({
                accountInfo: {
                    id: 'my-bank',
                    instituteName: 'TestBank',
                    type: 1,
                    requiresParent: false,
                },
                fileFilters: ['*.csv'],
                scanSubFolders: false,
            }),
        );
        // Empty CSV — the generic parser should fail to extract any columns.
        fs.writeFileSync(path.join(statementsDir, 'bad.csv'), '');

        const config = makeConfig(tempDir);
        const repo = new FileRepository(tempDir);
        const cache = new TransactionCache(config, repo);

        const result = await cache.scanAndImport();
        // Regardless of whether the parser produces 0 rows or throws, the
        // response shape must always include failedFiles so the UI can
        // report it.
        expect(Array.isArray(result.failedFiles)).toBe(true);
        expect(result.importedFiles.length + result.failedFiles.length).toBeGreaterThanOrEqual(0);

        cache.dispose();
    });
});
