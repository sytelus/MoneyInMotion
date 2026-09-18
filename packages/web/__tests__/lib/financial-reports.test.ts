import { describe, expect, it } from 'vitest';
import { AccountType, Transaction, Transactions, TransactionReason } from '@moneyinmotion/core';
import {
  activityTotals,
  buildFinancialReport,
  financialReportCsv,
  monthBounds,
  reportCoverage,
  reportDay,
} from '../../src/lib/financial-reports.js';

const scope = { from: '2024-03-01', to: '2024-03-31', account: '' };
function fixture() {
  const collection = new Transactions('reports');
  let sequence = 0;
  function add(
    amount: number,
    options: {
      account?: string;
      reason?: number;
      date?: string;
      name?: string;
      requiresParent?: boolean;
      category?: string;
    } = {},
  ) {
    const account = options.account ?? 'checking';
    const tx = Transaction.create('statement', account, options.requiresParent ?? false, {
      amount,
      transactionDate: options.date ?? '2024-03-15',
      entityName: options.name ?? `Merchant ${sequence++}`,
      entityNameNormalized: options.name,
      transactionReason: options.reason ?? TransactionReason.Purchase,
      providerCategoryName: options.category,
    });
    collection.addNew(
      tx,
      {
        id: account,
        instituteName: 'Generic',
        title: account.toUpperCase(),
        type: AccountType.BankChecking,
        requiresParent: options.requiresParent ?? false,
      },
      { id: 'statement', portableAddress: 'Statements/checking/march.csv', contentHash: 'path-id' },
      false,
    );
    return tx;
  }
  return { collection, add };
}

describe('financial report projections', () => {
  it('separates credits from earnings, excludes transfers/unmatched, and uses effective values', () => {
    const { collection, add } = fixture();
    add(-80, { category: 'Shopping' });
    add(-20, { reason: TransactionReason.Fee, category: 'Fees' });
    add(10, { reason: TransactionReason.DiscountRecieved });
    add(200, { reason: TransactionReason.PaymentRecieved });
    const debit = add(-50, { reason: TransactionReason.InterAccountTransfer });
    const credit = add(50, { reason: TransactionReason.InterAccountTransfer, account: 'savings' });
    debit.matchInterAccount(credit);
    add(-40, { account: 'orders', requiresParent: true });
    const report = buildFinancialReport(collection, scope);
    expect(report.totals).toEqual({ count: 4, credits: 210, debits: 100, net: 110 });
    expect(report.excluded).toEqual({ transfers: 2, unmatched: 1 });
    expect(report.creditTypes.map((row) => row.label)).toContain('Discount');
    expect(report.transfers).toHaveLength(1);
    expect(report.transfers[0]).toMatchObject({
      fromAccount: 'checking',
      toAccount: 'savings',
      amount: 50,
      inconsistent: false,
    });
    expect(report.categories[0]).toMatchObject({ label: 'Shopping', debits: 80 });
  });

  it('replaces complete parents, retains hidden parent flags, and keeps source-account attribution', () => {
    const { collection, add } = fixture();
    const parent = add(-100);
    const child = add(-100, { account: 'orders', requiresParent: true, date: '2024-04-02' });
    parent.addChild(child);
    parent.completeParent();
    const data = collection.serialize();
    delete data.topItems[child.id];
    data.topItems[parent.id]!.mergedEdit = { isFlagged: { value: true, isVoided: false } };
    const graph = Transactions.fromData(data);
    const march = buildFinancialReport(graph, scope);
    expect(march.totals.count).toBe(0);
    expect(march.review.flagged).toBe(1);
    const all = buildFinancialReport(graph, { ...scope, to: '2024-04-30' });
    expect(all.totals.debits).toBe(100);
    expect(all.accounts.map((row) => row.key)).toEqual(['orders']);
    expect(reportCoverage(graph).to).toBe('2024-04-02');
  });

  it('counts an incomplete payment once and exposes its review state without mutating source', () => {
    const { collection, add } = fixture();
    const parent = add(-100);
    const child = add(-30, { account: 'orders', requiresParent: true });
    parent.addChild(child);
    parent.completeParent();
    const data = collection.serialize();
    delete data.topItems[child.id];
    const graph = Transactions.fromData(data);
    const before = JSON.stringify(graph.serialize());
    const report = buildFinancialReport(graph, scope);
    expect(report.totals.debits).toBe(100);
    expect(report.review.incomplete).toBe(1);
    expect(report.rows.map((row) => row.id)).toEqual([parent.id]);
    expect(JSON.stringify(graph.serialize())).toBe(before);
  });

  it('includes a linked counterpart outside the period once and warns on effective amount changes', () => {
    const { collection, add } = fixture();
    const outgoing = add(-25, {
      date: '2024-03-31',
      reason: TransactionReason.InterAccountTransfer,
    });
    const incoming = add(25, {
      date: '2024-04-01',
      reason: TransactionReason.InterAccountTransfer,
      account: 'savings',
    });
    outgoing.matchInterAccount(incoming);
    const data = collection.serialize();
    data.topItems[incoming.id]!.mergedEdit = { amount: { value: 20, isVoided: false } };
    const report = buildFinancialReport(Transactions.fromData(data), {
      ...scope,
      account: 'checking',
    });
    expect(report.transfers).toHaveLength(1);
    expect(report.transfers[0]).toMatchObject({ outsidePeriod: true, inconsistent: true });
    expect(report.totals.count).toBe(0);
  });

  it('honors UTC days, inclusive custom bounds, edited dates and amounts, and empty scope', () => {
    const { collection, add } = fixture();
    const tx = add(-5, { date: '2024-03-01T00:00:00Z' });
    expect(reportDay(tx)).toBe('2024-03-01');
    expect(reportDay(add(-1, { date: '2024-03-01T00:30:00+02:00' }))).toBe('2024-02-29');
    const data = collection.serialize();
    data.topItems[tx.id]!.mergedEdit = {
      amount: { value: -9, isVoided: false },
      transactionDate: { value: '2024-04-01T00:00:00Z', isVoided: false },
      categoryPath: { value: ['User', 'Category'], isVoided: false },
    };
    const graph = Transactions.fromData(data);
    expect(buildFinancialReport(graph, scope).totals.count).toBe(0);
    const report = buildFinancialReport(graph, { ...scope, from: '2024-04-01', to: '2024-04-01' });
    expect(report.totals.debits).toBe(9);
    expect(report.categories[0]?.key).toBe('User / Category');
    expect(buildFinancialReport(graph, { ...scope, account: 'missing' }).months).toEqual([]);
    expect(monthBounds('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('exports aggregate scope and safe labels while retaining negative numeric amounts', () => {
    const { collection, add } = fixture();
    add(-10, { name: '=HYPERLINK("bad")' });
    const csv = financialReportCsv(buildFinancialReport(collection, scope));
    expect(csv).toContain('"From (UTC)"');
    expect(csv).toContain('"2024-03-01","2024-03-31"');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"-10"');
    expect(csv).not.toContain('"\'-10"');
    expect(activityTotals([])).toEqual({ count: 0, credits: 0, debits: 0, net: 0 });
  });
});
