import { describe, expect, it } from 'vitest';
import {
  AccountType,
  ScopeType,
  Transaction,
  TransactionEdits,
  TransactionReason,
  Transactions,
  createAuditInfo,
  createScopeFilter,
  editValue,
  migrateLegacyEditTargets,
  type AccountInfo,
  type ImportInfo,
  type TransactionEditData,
} from '../../src/index.js';

const account: AccountInfo = {
  id: 'card',
  instituteName: 'Generic',
  title: 'Card',
  type: AccountType.CreditCard,
  requiresParent: false,
  interAccountNameTags: null,
};

const importInfo: ImportInfo = {
  id: 'source',
  portableAddress: 'statement.csv',
  contentHash: 'source',
  format: 'csv',
};

function addTransaction(
  transactions: Transactions,
  id: string,
  entityName: string = 'Coffee Shop',
  transactionDate: string = '2024-01-02T08:00:00.000Z',
): Transaction {
  const generated = Transaction.create('source', 'card', false, {
    amount: -12.34,
    transactionDate,
    entityName,
    transactionReason: TransactionReason.Purchase,
  });
  const transaction = Transaction.fromData({
    ...generated.toData(),
    id,
    contentHash: `${id}-content`,
  });
  transactions.addNew(transaction, account, importInfo, true);
  return transaction;
}

function oneEdit(targetId: string): TransactionEdits {
  const edits = new TransactionEdits('legacy');
  const edit: TransactionEditData = {
    id: 'edit-1',
    auditInfo: createAuditInfo('legacy-user'),
    scopeFilters: [createScopeFilter(ScopeType.TransactionId, [targetId])],
    values: { categoryPath: editValue(['Dining']) },
    sourceId: 'legacy',
  };
  edits.add(edit);
  return edits;
}

describe('migrateLegacyEditTargets', () => {
  it('retargets one missing ID to one semantically equivalent transaction', () => {
    const previous = new Transactions('old');
    const rebuilt = new Transactions('new');
    addTransaction(previous, 'legacy-id');
    const replacement = addTransaction(rebuilt, 'modern-id');

    const result = migrateLegacyEditTargets(oneEdit('legacy-id'), previous, rebuilt);
    const migrated = [...result.edits][0]!;

    expect(migrated.scopeFilters[0]?.parameters).toEqual(['modern-id']);
    expect(result.migratedTargetCount).toBe(1);
    expect(result.unresolvedTargetCount).toBe(0);
    rebuilt.applyEdits(result.edits);
    expect(replacement.categoryPath).toEqual(['Dining']);
  });

  it('retains an ambiguous old ID instead of broadening the edit', () => {
    const previous = new Transactions('old');
    const rebuilt = new Transactions('new');
    addTransaction(previous, 'legacy-id');
    addTransaction(rebuilt, 'modern-id-1');
    addTransaction(rebuilt, 'modern-id-2');

    const result = migrateLegacyEditTargets(oneEdit('legacy-id'), previous, rebuilt);

    expect([...result.edits][0]?.scopeFilters[0]?.parameters).toEqual(['legacy-id']);
    expect(result.migratedTargetCount).toBe(0);
    expect(result.unresolvedTargetCount).toBe(1);
  });

  it('leaves an ID that already exists in the rebuilt graph unchanged', () => {
    const previous = new Transactions('old');
    const rebuilt = new Transactions('new');
    addTransaction(previous, 'stable-id');
    addTransaction(rebuilt, 'stable-id');

    const result = migrateLegacyEditTargets(oneEdit('stable-id'), previous, rebuilt);

    expect([...result.edits][0]?.scopeFilters[0]?.parameters).toEqual(['stable-id']);
    expect(result.migratedTargetCount).toBe(0);
    expect(result.unresolvedTargetCount).toBe(0);
  });

  it('retargets a date-only transaction whose midnight timezone representation changed', () => {
    const previous = new Transactions('old');
    const rebuilt = new Transactions('new');
    addTransaction(previous, 'legacy-id', 'Coffee Shop', '2024-01-02T08:00:00.000Z');
    const replacement = addTransaction(
      rebuilt,
      'modern-id',
      'Coffee Shop',
      '2024-01-02T00:00:00.000Z',
    );

    const result = migrateLegacyEditTargets(oneEdit('legacy-id'), previous, rebuilt);

    expect([...result.edits][0]?.scopeFilters[0]?.parameters).toEqual([replacement.id]);
    expect(result.migratedTargetCount).toBe(1);
    expect(result.unresolvedTargetCount).toBe(0);
  });

  it('does not broaden a calendar fallback when multiple candidates exist', () => {
    const previous = new Transactions('old');
    const rebuilt = new Transactions('new');
    addTransaction(previous, 'legacy-id', 'Coffee Shop', '2024-01-02T08:00:00.000Z');
    addTransaction(rebuilt, 'modern-id-1', 'Coffee Shop', '2024-01-02T00:00:00.000Z');
    addTransaction(rebuilt, 'modern-id-2', 'Coffee Shop', '2024-01-02T05:00:00.000Z');

    const result = migrateLegacyEditTargets(oneEdit('legacy-id'), previous, rebuilt);

    expect([...result.edits][0]?.scopeFilters[0]?.parameters).toEqual(['legacy-id']);
    expect(result.migratedTargetCount).toBe(0);
    expect(result.unresolvedTargetCount).toBe(1);
  });
});
