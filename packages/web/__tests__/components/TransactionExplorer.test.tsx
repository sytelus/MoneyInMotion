import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  Transactions,
  Transaction,
  TransactionReason,
  AccountType,
  NetAggregator,
} from '@moneyinmotion/core';
import { TransactionList } from '../../src/components/transactions/TransactionList.js';
import { TransactionSummary } from '../../src/components/transactions/TransactionSummary.js';
import { useTransactionsStore, emptyFilters } from '../../src/store/transactions-store.js';
import {
  reportingTransactions,
  explorerGroups,
  flattenExplorer,
  transactionsCsv,
} from '../../src/lib/transaction-explorer.js';

function fixture(count = 1) {
  const transactions = new Transactions('test');
  for (let index = 0; index < count; index++)
    transactions.addNew(
      Transaction.create('import', 'bank', false, {
        amount: -10 - index,
        transactionDate: '2024-03-15',
        entityName: `Store ${index}`,
        entityNameNormalized: `Store ${index}`,
        transactionReason: TransactionReason.Purchase,
        providerCategoryName: 'Shopping',
      }),
      {
        id: 'bank',
        title: 'Checking',
        instituteName: 'Generic',
        type: AccountType.BankChecking,
        interAccountNameTags: [],
        requiresParent: false,
      },
      { id: 'import', portableAddress: 'sample.csv', format: 'csv', contentHash: 'import' },
      false,
    );
  return transactions;
}
beforeEach(() =>
  useTransactionsStore.setState({
    transactions: null,
    reporting: [],
    searchIndex: new Map(),
    selectedYear: null,
    selectedMonth: null,
    filters: { ...emptyFilters },
    selectedTransactionIds: new Set(),
    expandedGroupIds: new Set(),
  }),
);

describe('Transaction explorer', () => {
  it('uses the statement category consistently in selected details and reporting', () => {
    const collection = fixture();
    useTransactionsStore.getState().setTransactions(collection.serialize());
    useTransactionsStore.getState().selectTransaction([...collection.topLevelTransactions][0]!.id);
    render(<TransactionSummary />);
    expect(screen.queryByText('Uncategorized')).not.toBeInTheDocument();
    expect(screen.getAllByText('Shopping')).toHaveLength(2);
    expect(screen.getByText('Statement category')).toBeInTheDocument();
  });
  it('opens on a dated, collapsed overview with reporting totals', () => {
    useTransactionsStore.getState().setTransactions(fixture(3).serialize());
    render(<TransactionList />);
    expect(screen.getByTestId('reporting-period')).toHaveTextContent('March 2024');
    expect(within(screen.getByRole('grid')).getAllByRole('row')).toHaveLength(2);
    expect(within(screen.getByRole('grid')).getAllByRole('row')[1]).not.toHaveAttribute(
      'aria-expanded',
    );
    expect(
      within(screen.getByRole('grid')).getByRole('button', { name: /Expenses/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Store 0')).not.toBeInTheDocument();
  });
  it('drills through type and provider category without a duplicate singleton merchant group', () => {
    useTransactionsStore.getState().setTransactions(fixture().serialize());
    render(<TransactionList />);
    fireEvent.click(within(screen.getByRole('grid')).getByRole('button', { name: /Expenses/ }));
    fireEvent.click(within(screen.getByRole('grid')).getByRole('button', { name: /Purchases/ }));
    fireEvent.click(within(screen.getByRole('grid')).getByRole('button', { name: /Shopping/ }));
    expect(screen.getByText('Store 0')).toBeInTheDocument();
    expect(
      within(screen.getByRole('grid')).queryByRole('button', { name: /Store 0/ }),
    ).not.toBeInTheDocument();
  });
  it('paginates and sorts results, selects with checkboxes, and clears selections on filtering', () => {
    useTransactionsStore.getState().setTransactions(fixture(251).serialize());
    render(<TransactionList />);
    fireEvent.click(screen.getByRole('button', { name: 'All matching items' }));
    expect(within(screen.getByRole('grid')).getAllByRole('checkbox')).toHaveLength(100);
    fireEvent.change(screen.getByLabelText('Sort transactions'), {
      target: { value: 'amountAsc' },
    });
    const checkboxes = within(screen.getByRole('grid')).getAllByRole('checkbox');
    expect(checkboxes[0]).toHaveAccessibleName('Select Store 250');
    fireEvent.click(checkboxes[0]!);
    expect(screen.getByRole('button', { name: 'Edit selected items' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Search transactions'), {
      target: { value: 'Store 250' },
    });
    expect(within(screen.getByRole('grid')).getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Edit selected items' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('101–200 of 251 transactions')).toBeInTheDocument();
  });
  it('keeps the other date boundary when changing from a selected month to custom dates', () => {
    useTransactionsStore.getState().setTransactions(fixture().serialize());
    render(<TransactionList />);
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2024-03-10' } });
    expect(useTransactionsStore.getState().filters).toMatchObject({
      from: '2024-03-10',
      to: '2024-03-31',
    });
    expect(screen.getByTestId('reporting-period')).toHaveTextContent('2024-03-10 – 2024-03-31');
    act(() => useTransactionsStore.getState().setFilters({ account: 'nonexistent' }));
    expect(screen.getByText(/No transactions to display/)).toBeInTheDocument();
  });
  it('counts complete children once, uses their own dates, and retains incomplete parents', () => {
    const collection = fixture(2);
    const [parent, child] = [...collection.topLevelTransactions];
    parent!.addChild(child!);
    parent!.completeParent();
    const data = collection.serialize();
    data.topItems = { [parent!.id]: parent!.toData() };
    // Imported amounts differ: the parent must be reported, not the partial child.
    let graph = Transactions.fromData(data);
    expect(reportingTransactions(graph).map((tx) => tx.id)).toEqual([parent!.id]);
    data.topItems[parent!.id]!.amount = -11;
    data.topItems[parent!.id]!.hasMissingChild = false;
    data.topItems[parent!.id]!.children![child!.id]!.transactionDate = '2024-04-01T00:00:00.000Z';
    graph = Transactions.fromData(data);
    expect(reportingTransactions(graph).map((tx) => tx.id)).toEqual([child!.id]);
    const groups = explorerGroups(reportingTransactions(graph));
    expect(groups.reduce((sum, g) => sum + g.sum, 0)).toBe(
      new NetAggregator([...graph.topLevelTransactions]).netIncomeAmount,
    );
    useTransactionsStore.getState().setTransactions(graph.serialize());
    expect(useTransactionsStore.getState().selectedMonth).toBe('04');
  });
  it('keeps large histories collapsed and never mutates the source data', () => {
    const collection = fixture(10000);
    const before = JSON.stringify(collection.serialize());
    const groups = explorerGroups(reportingTransactions(collection));
    expect(flattenExplorer(groups, new Set())).toHaveLength(1);
    expect(groups[0]?.count).toBe(10000);
    expect(JSON.stringify(collection.serialize())).toBe(before);
  });
  it('escapes CSV and prevents spreadsheet formulas in exported text', () => {
    const tx = Transaction.create('i', 'a', false, {
      amount: -10,
      entityName: '=HYPERLINK("bad")',
      entityNameNormalized: '=HYPERLINK("bad")',
      transactionDate: '2024-01-01',
      transactionReason: TransactionReason.Purchase,
    });
    const csv = transactionsCsv([tx]);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"-10"');
  });
});
