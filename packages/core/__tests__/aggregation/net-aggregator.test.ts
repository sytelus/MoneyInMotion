import { describe, expect, it } from 'vitest';
import {
  NetAggregator,
  ScopeType,
  Transaction,
  TransactionReason,
  createAuditInfo,
  createScopeFilter,
  editValue,
  type ImportedValues,
  type TransactionAggregator,
} from '../../src/index.js';

let lineNumber = 0;

function makeTransaction(overrides?: Partial<ImportedValues>): Transaction {
  lineNumber += 1;
  return Transaction.create('import', 'checking', false, {
    amount: -25,
    transactionDate: '2024-03-15',
    entityName: 'Example Market',
    transactionReason: TransactionReason.Purchase,
    lineNumber,
    ...overrides,
  });
}

function childNamed(group: TransactionAggregator, name: string) {
  return group.getSubAggregators().find((candidate) => candidate.name === name);
}

describe('NetAggregator', () => {
  it('routes financial meanings into deterministic top-level groups', () => {
    const expense = makeTransaction();
    expense.applyEdit({
      id: 'category-edit',
      auditInfo: createAuditInfo('test'),
      scopeFilters: [createScopeFilter(ScopeType.TransactionId, [expense.id])],
      values: { categoryPath: editValue(['Food', 'Groceries']) },
      sourceId: 'test',
    });
    const income = makeTransaction({
      amount: 100,
      entityName: 'Savings Bank',
      transactionReason: TransactionReason.Interest,
    });
    const transfer = makeTransaction({
      amount: -50,
      entityName: 'Account Transfer',
      transactionReason: TransactionReason.InterAccountPayment,
    });
    const unmatched = makeTransaction({
      amount: -12,
      entityName: 'Unmatched Order',
      requiresParent: true,
    });

    const net = new NetAggregator([expense, income, transfer, unmatched]);
    const topGroups = net.aggregator.getSubAggregatorsBySortOrder();

    expect(topGroups.map((group) => group.name)).toEqual([
      'Income',
      'Expenses',
      'Transfers',
      'Unmatched',
    ]);
    expect(net.netIncomeAmount).toBe(75);

    const expenses = topGroups[1]!;
    const food = childNamed(expenses, 'CAT_Food');
    expect(food).toBeDefined();
    expect(childNamed(food!, 'NAM_Example Market')?.getTransactions()).toEqual([expense]);
    expect(topGroups[3]?.sum).toBe(-12);
  });

  it('uses effective edited amount and reason for routing and totals', () => {
    const transaction = makeTransaction();
    transaction.applyEdit({
      id: 'financial-edit',
      auditInfo: createAuditInfo('test'),
      scopeFilters: [createScopeFilter(ScopeType.TransactionId, [transaction.id])],
      values: {
        amount: editValue(40),
        transactionReason: editValue(TransactionReason.Interest),
      },
      sourceId: 'test',
    });

    const net = new NetAggregator([transaction]);

    expect(net.aggregator.getSubAggregatorsBySortOrder().map((group) => group.name)).toEqual([
      'Income',
    ]);
    expect(net.netIncomeAmount).toBe(40);
  });

  it('aggregates complete parent hierarchies from their leaf children', () => {
    const parent = makeTransaction({ amount: -100, entityName: 'Order' });
    const item = makeTransaction({ amount: -60, entityName: 'Item' });
    const taxAndShipping = makeTransaction({ amount: -40, entityName: 'Tax and shipping' });
    parent.addChild(item);
    parent.addChild(taxAndShipping);
    expect(parent.completeParent().isComplete).toBe(true);

    const net = new NetAggregator([parent]);
    const expenses = net.aggregator.getSubAggregatorsBySortOrder()[0]!;

    expect(expenses).toMatchObject({ name: 'Expenses', count: 2, sum: -100 });
    expect(net.netIncomeAmount).toBe(-100);
  });

  it('shows an incomplete parent once instead of double-counting known children', () => {
    const parent = makeTransaction({ amount: -100, entityName: 'Incomplete Order' });
    parent.addChild(makeTransaction({ amount: -60, entityName: 'Known Item' }));
    expect(parent.completeParent().isComplete).toBe(false);

    const net = new NetAggregator([parent]);
    const expenses = net.aggregator.getSubAggregatorsBySortOrder()[0]!;

    expect(expenses).toMatchObject({ count: 1, sum: -100 });
  });

  it('supports the flat summary mode without semantic header groups', () => {
    const expense = makeTransaction({ amount: -25 });
    const income = makeTransaction({
      amount: 100,
      transactionReason: TransactionReason.Interest,
    });

    const net = new NetAggregator([expense, income], { enableGrouping: false });
    const flat = net.aggregator.getSubAggregatorsBySortOrder()[0]!;

    expect(flat).toMatchObject({ name: 'flatAggregator', isOptional: true, count: 2, sum: 75 });
    expect(flat.getTransactions()).toEqual([expense, income]);
    expect(net.netIncomeAmount).toBe(75);
  });
});
