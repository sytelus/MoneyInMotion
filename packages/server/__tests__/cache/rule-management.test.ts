import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import express from 'express';
import request from 'supertest';
import {
  Transactions,
  Transaction,
  TransactionEdits,
  TransactionReason,
  AccountType,
  ScopeType,
  createScopeFilter,
  createAuditInfo,
  editValue,
  type TransactionEditData,
} from '@moneyinmotion/core';
import { FileRepository } from '../../src/storage/file-repository.js';
import { TransactionsStorage } from '../../src/storage/transactions-storage.js';
import { TransactionEditsStorage } from '../../src/storage/transaction-edits-storage.js';
import { TransactionCache } from '../../src/cache/transaction-cache.js';
import { prepareRuleChanges } from '../../src/cache/rule-management.js';
import { createTransactionEditsRouter } from '../../src/routes/transaction-edits.js';

function fixture() {
  const transactions = new Transactions('test');
  const account = {
    id: 'bank',
    title: 'Bank',
    instituteName: 'Generic',
    type: AccountType.BankChecking,
    requiresParent: false,
    interAccountNameTags: [],
  };
  const source = {
    id: 'import',
    portableAddress: 'Bank/example.csv',
    contentHash: 'hash',
    format: 'csv',
  };
  for (const name of ['Alpha', 'Beta'])
    transactions.addNew(
      Transaction.create('import', 'bank', false, {
        amount: -10,
        transactionDate: '2024-01-01',
        entityName: name,
        transactionReason: TransactionReason.Purchase,
      }),
      account,
      source,
      false,
    );
  return transactions;
}
function rule(id: string, category: string): TransactionEditData {
  return {
    id,
    auditInfo: createAuditInfo('test'),
    sourceId: 'test',
    scopeFilters: [createScopeFilter(ScopeType.All, [])],
    values: { categoryPath: editValue([category]) },
  };
}
describe('rule management', () => {
  let directory: string;
  let repo: FileRepository;
  let cache: TransactionCache;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mim-rule-management-'));
    repo = new FileRepository(directory);
    fs.mkdirSync(path.dirname(repo.latestMergedPath), { recursive: true });
    new TransactionsStorage().save(repo.latestMergedPath, fixture());
    cache = new TransactionCache(repo);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('previews without writing, then creates and reloads a rule without statements', async () => {
    const before = fs.readFileSync(repo.latestMergedPath, 'utf8');
    const changes = [{ previous: null, next: rule('one', 'Food') }];
    expect(await cache.manageRules(changes, true)).toMatchObject({
      affectedTransactionsCount: 2,
      totalRules: 1,
    });
    expect(fs.readFileSync(repo.latestMergedPath, 'utf8')).toBe(before);
    expect(fs.existsSync(repo.latestMergedEditsPath)).toBe(false);
    expect((await cache.getTransactions()).editsCount).toBe(0);
    await cache.manageRules(changes, false);
    const restored = await new TransactionCache(repo).getTransactions();
    expect(restored.editsCount).toBe(1);
    expect([...restored.topLevelTransactions].every((tx) => tx.categoryPath[0] === 'Food')).toBe(
      true,
    );
    expect(
      [...restored.topLevelTransactions].every(
        (tx) => tx.toData().amount === -10 && tx.correctedAmount === -10,
      ),
    ).toBe(true);
  });

  it('retains precedence on edit and reveals earlier values on delete, including after reload', async () => {
    const first = rule('first', 'Food');
    const last = rule('last', 'Shopping');
    await cache.manageRules(
      [
        { previous: null, next: first },
        { previous: null, next: last },
      ],
      false,
    );
    const changedFirst = { ...first, values: { categoryPath: editValue(['Groceries']) } };
    expect(await cache.manageRules([{ previous: first, next: changedFirst }], true)).toMatchObject({
      affectedTransactionsCount: 0,
    });
    await cache.manageRules([{ previous: first, next: changedFirst }], false);
    expect(await cache.manageRules([{ previous: last, next: null }], false)).toMatchObject({
      affectedTransactionsCount: 2,
    });
    const restored = await new TransactionCache(repo).getTransactions();
    expect(restored.getClonedEdits().get('last')).toBeUndefined();
    expect([...restored.topLevelTransactions][0]?.categoryPath).toEqual(['Groceries']);
    expect(
      fs
        .readdirSync(path.dirname(repo.latestMergedEditsPath))
        .some((name) => /^LatestMergedEdits\.\d/.test(name)),
    ).toBe(true);
  });

  it('removes old effects when an edited condition stops matching', async () => {
    const first = rule('first', 'Food');
    await cache.manageRules([{ previous: null, next: first }], false);
    const narrowed = {
      ...first,
      scopeFilters: [createScopeFilter(ScopeType.EntityName, ['Alpha'])],
    };
    await cache.manageRules([{ previous: first, next: narrowed }], false);
    const values = [...(await cache.getTransactions()).topLevelTransactions];
    expect(values.find((tx) => tx.entityName === 'Alpha')?.categoryPath).toEqual(['Food']);
    expect(values.find((tx) => tx.entityName === 'Beta')?.categoryPath).toEqual([]);
  });

  it('rejects stale edits and the whole mixed batch before changing anything', async () => {
    const first = rule('first', 'Food');
    await cache.manageRules([{ previous: null, next: first }], false);
    const before = fs.readFileSync(repo.latestMergedPath, 'utf8');
    await expect(
      cache.manageRules(
        [
          { previous: null, next: rule('second', 'A') },
          { previous: rule('first', 'outdated'), next: null },
        ],
        false,
      ),
    ).rejects.toThrow('changed since');
    expect(fs.readFileSync(repo.latestMergedPath, 'utf8')).toBe(before);
  });

  it('serializes concurrent updates and rejects the stale second writer', async () => {
    const first = rule('first', 'Food');
    await cache.manageRules([{ previous: null, next: first }], false);
    const results = await Promise.allSettled([
      cache.manageRules([{ previous: first, next: rule('first', 'A') }], false),
      cache.manageRules([{ previous: first, next: rule('first', 'B') }], false),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
  });

  it('invalidates a preview when an unrelated rule changes its effects', async () => {
    const changes = [{ previous: null, next: rule('previewed', 'Food') }];
    const preview = await cache.manageRules(changes, true);
    await cache.manageRules([{ previous: null, next: rule('unrelated', 'Other') }], false);
    await expect(cache.manageRules(changes, false, preview.revision)).rejects.toThrow(
      'changed after this preview',
    );
    expect((await cache.getTransactions()).getClonedEdits().get('previewed')).toBeUndefined();
  });

  it('keeps quick corrections consistent with full rule replay', async () => {
    const first = { ...rule('rename', 'A'), values: { entityName: editValue('Changed') } };
    await cache.applyEdits([first]);
    const second = {
      ...rule('category', 'Food'),
      scopeFilters: [createScopeFilter(ScopeType.EntityNameNormalized, ['Alpha'])],
    };
    expect(await cache.applyEdits([second])).toMatchObject({ affectedTransactionsCount: 1 });
    const current = await cache.getTransactions();
    const replayed = current.withReplayedEdits(current.getClonedEdits());
    for (const tx of current.allParentChildTransactions)
      expect(replayed.getTransaction(tx.id)?.categoryPath).toEqual(tx.categoryPath);
  });

  it('preserves existing missing references but refuses new missing targets', () => {
    const transactions = fixture();
    const missing = {
      ...rule('old', 'Food'),
      scopeFilters: [createScopeFilter(ScopeType.TransactionId, ['legacy-missing'])],
    };
    const edits = new TransactionEdits();
    edits.add(missing);
    transactions.applyEdits(edits, true);
    expect(
      prepareRuleChanges(transactions, [
        { previous: missing, next: { ...missing, values: { note: editValue('Retain') } } },
      ]).result.missingTargets,
    ).toBe(1);
    expect(() =>
      prepareRuleChanges(transactions, [{ previous: null, next: { ...missing, id: 'new' } }]),
    ).toThrow('no longer exists');
  });

  it('rejects incomplete correction history rather than erasing unknown corrections', () => {
    const transactions = fixture();
    [...transactions.topLevelTransactions][0]!.applyEdit(rule('orphan', 'Keep me'));
    expect(() =>
      prepareRuleChanges(transactions, [{ previous: null, next: rule('new', 'Food') }]),
    ).toThrow('full rule history');
  });

  it('recalculates parent completeness when an amount correction is deleted', () => {
    const transactions = fixture();
    const [parent, child] = [...transactions.topLevelTransactions];
    const data = transactions.serialize();
    parent!.addChild(child!);
    parent!.completeParent();
    data.topItems = { [parent!.id]: parent!.toData() };
    const graph = Transactions.fromData(data);
    const amountRule = {
      ...rule('amount', 'Food'),
      scopeFilters: [createScopeFilter(ScopeType.TransactionId, [child!.id])],
      values: { amount: editValue(-7) },
    };
    const edits = new TransactionEdits();
    edits.add(amountRule);
    graph.applyEdits(edits);
    expect(graph.getTransaction(parent!.id)?.hasMissingChild).toBe(true);
    const { candidate } = prepareRuleChanges(graph, [{ previous: amountRule, next: null }]);
    expect(candidate.getTransaction(parent!.id)?.hasMissingChild).toBe(false);
    expect(candidate.getTransaction(child!.id)?.correctedAmount).toBe(-10);
  });

  it('rolls back both durable files if the second write fails', async () => {
    const first = rule('first', 'Food');
    await cache.manageRules([{ previous: null, next: first }], false);
    const before = [repo.latestMergedPath, repo.latestMergedEditsPath].map((file) =>
      fs.readFileSync(file, 'utf8'),
    );
    vi.spyOn(TransactionEditsStorage.prototype, 'save').mockImplementation(() => {
      throw new Error('disk full');
    });
    await expect(cache.manageRules([{ previous: first, next: null }], false)).rejects.toThrow(
      'disk full',
    );
    expect(
      [repo.latestMergedPath, repo.latestMergedEditsPath].map((file) =>
        fs.readFileSync(file, 'utf8'),
      ),
    ).toEqual(before);
    expect((await new TransactionCache(repo).getTransactions()).editsCount).toBe(1);
  });

  it('never leaks a failed quick edit into an already-corrected live transaction', async () => {
    await cache.applyEdits([rule('existing', 'Food')]);
    const before = JSON.stringify((await cache.getTransactions()).serialize());
    vi.spyOn(TransactionsStorage.prototype, 'save').mockImplementation(() => {
      throw new Error('disk full');
    });
    await expect(
      cache.applyEdits([{ ...rule('failed', 'A'), values: { note: editValue('Do not leak') } }]),
    ).rejects.toThrow('disk full');
    expect(JSON.stringify((await cache.getTransactions()).serialize())).toBe(before);
  });

  it('validates API bodies, returns helpful conflicts, and accepts valid preview requests', async () => {
    const app = express();
    app.use(express.json());
    app.use('/rules', createTransactionEditsRouter(cache));
    expect(
      (
        await request(app)
          .post('/rules/manage')
          .send({
            preview: false,
            changes: [
              {
                previous: null,
                next: { ...rule('new', 'A'), values: { amount: editValue('invalid') } },
              },
            ],
          })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/rules/manage')
          .send({ preview: false, changes: [{ previous: rule('missing', 'A'), next: null }] })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post('/rules/manage')
          .send({ preview: true, changes: [{ previous: null, next: rule('new', 'A') }] })
      ).body.affectedTransactionsCount,
    ).toBe(2);
    expect((await cache.getTransactions()).editsCount).toBe(0);
  });

  it('lets users edit legacy rules without erasing unchanged empty values', async () => {
    const legacy = {
      ...rule('legacy', 'Food'),
      values: { categoryPath: editValue(['Food']), note: editValue('') },
    };
    await cache.manageRules([{ previous: null, next: legacy }], false);
    const app = express();
    app.use(express.json());
    app.use('/rules', createTransactionEditsRouter(cache));
    const next = { ...legacy, values: { ...legacy.values, categoryPath: editValue(['Updated']) } };
    expect(
      (
        await request(app)
          .post('/rules/manage')
          .send({ preview: true, changes: [{ previous: legacy, next }] })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post('/rules/manage')
          .send({ preview: true, changes: [{ previous: null, next: { ...next, id: 'new' } }] })
      ).status,
    ).toBe(400);
  });
});
