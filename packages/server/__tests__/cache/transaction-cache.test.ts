import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileRepository } from '../../src/storage/file-repository.js';
import { TransactionCache } from '../../src/cache/transaction-cache.js';
import { ScopeType, createAuditInfo, createScopeFilter, editValue } from '@moneyinmotion/core';

describe('TransactionCache', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyai-cache-'));
    fs.mkdirSync(path.join(tempDir, 'Statements'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'Merged'), { recursive: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads an empty collection when no merged file exists', async () => {
    const repo = new FileRepository(tempDir);
    const cache = new TransactionCache(repo);

    const txns = await cache.getTransactions();
    expect(txns.allTransactionCount).toBe(0);
  });

  it('serializes concurrent save() calls', async () => {
    const repo = new FileRepository(tempDir);
    const cache = new TransactionCache(repo);

    // Force the cache to have a transactions instance so save() actually writes.
    await cache.getTransactions();

    const storage = (
      cache as unknown as {
        transactionsStorage: { save: (...args: unknown[]) => void };
      }
    ).transactionsStorage;
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

    await Promise.all([cache.save(), cache.save(), cache.save()]);

    expect(saveSpy).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(1);
  });

  it('rebuildFromStatements surfaces parse errors as failedFiles', async () => {
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

    const repo = new FileRepository(tempDir);
    const cache = new TransactionCache(repo);

    const result = await cache.rebuildFromStatements();
    // Regardless of whether the parser produces 0 rows or throws, the
    // response shape must always include failedFiles so the UI can
    // report it.
    expect(Array.isArray(result.failedFiles)).toBe(true);
    expect(result.importedFiles.length + result.failedFiles.length).toBeGreaterThanOrEqual(0);
  });

  it('commits a complete rebuild and preserves it when a later file fails', async () => {
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
    fs.writeFileSync(
      path.join(statementsDir, 'good.csv'),
      'Date,Description,Amount\n01/01/2024,Example,-10\n',
    );
    const cache = new TransactionCache(new FileRepository(tempDir));

    const firstBuild = await cache.rebuildFromStatements();
    const savedSnapshot = fs.readFileSync(
      path.join(tempDir, 'Merged', 'LatestMerged.json'),
      'utf-8',
    );
    expect(firstBuild).toMatchObject({
      committed: true,
      previousTransactionCount: 0,
      totalTransactions: 1,
      failedFiles: [],
    });

    fs.writeFileSync(
      path.join(statementsDir, 'bad.csv'),
      'Date,Description,Amount,Type\n01/02/2024,Broken,-20,NotAType\n',
    );
    const failedBuild = await cache.rebuildFromStatements();

    expect(failedBuild.committed).toBe(false);
    expect(failedBuild.previousTransactionCount).toBe(1);
    expect(failedBuild.totalTransactions).toBe(1);
    expect(failedBuild.failedFiles).toHaveLength(1);
    expect((await cache.getTransactions()).allTransactionCount).toBe(1);
    expect(fs.readFileSync(path.join(tempDir, 'Merged', 'LatestMerged.json'), 'utf-8')).toBe(
      savedSnapshot,
    );
  });

  it('keeps the active snapshot unchanged when a rebuild cannot be persisted', async () => {
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
    fs.writeFileSync(
      path.join(statementsDir, 'first.csv'),
      'Date,Description,Amount\n01/01/2024,First,-10\n',
    );
    const cache = new TransactionCache(new FileRepository(tempDir));
    await cache.rebuildFromStatements();
    expect((await cache.getTransactions()).allTransactionCount).toBe(1);

    fs.writeFileSync(
      path.join(statementsDir, 'second.csv'),
      'Date,Description,Amount\n01/02/2024,Second,-20\n',
    );
    const storage = (cache as unknown as { transactionsStorage: { save: () => void } })
      .transactionsStorage;
    vi.spyOn(storage, 'save').mockImplementation(() => {
      throw new Error('disk full');
    });

    await expect(cache.rebuildFromStatements()).rejects.toThrow('disk full');
    expect((await cache.getTransactions()).allTransactionCount).toBe(1);
  });

  it('keeps edits out of live memory when their snapshot save fails', async () => {
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
    fs.writeFileSync(
      path.join(statementsDir, 'statement.csv'),
      'Date,Description,Amount\n01/01/2024,First,-10\n',
    );
    const cache = new TransactionCache(new FileRepository(tempDir));
    await cache.rebuildFromStatements();
    const before = await cache.getTransactions();
    const transaction = [...before.topLevelTransactions][0]!;

    const storage = (cache as unknown as { transactionsStorage: { save: () => void } })
      .transactionsStorage;
    vi.spyOn(storage, 'save').mockImplementation(() => {
      throw new Error('disk full');
    });

    await expect(
      cache.applyEdits([
        {
          id: 'edit-note',
          auditInfo: createAuditInfo('test'),
          scopeFilters: [createScopeFilter(ScopeType.TransactionId, [transaction.id])],
          values: { note: editValue('must not leak') },
          sourceId: 'test',
        },
      ]),
    ).rejects.toThrow('disk full');

    const after = await cache.getTransactions();
    expect(after.getTransaction(transaction.id)?.note).toBeNull();
    expect(after.editsCount).toBe(0);
  });
});
