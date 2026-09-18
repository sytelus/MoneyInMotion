import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Transactions, Transaction, TransactionReason, AccountType } from '@moneyinmotion/core';
import { AppShell } from '../../src/components/layout/AppShell.js';
import { ExistingStatements } from '../../src/components/importing/ExistingStatements.js';
import { useTransactionsStore } from '../../src/store/transactions-store.js';
import type { AccountSummary } from '../../src/api/client.js';

const state = vi.hoisted(() => ({ transactions: vi.fn(), rebuild: vi.fn(), quickEdit: vi.fn() }));
const account: AccountSummary = {
  config: {
    accountInfo: {
      id: 'bank',
      instituteName: 'Generic',
      type: AccountType.BankChecking,
      requiresParent: false,
    },
    fileFilters: ['*.csv'],
    scanSubFolders: true,
  },
  stats: { transactionCount: 0, lastImportedAt: null },
  hasStatementFiles: true,
  relativeDirectory: 'Bank',
};
vi.mock('../../src/api/hooks.js', () => ({
  useTransactions: () => state.transactions(),
  useAccounts: () => ({ data: [account], isLoading: false, error: null }),
  useApplyEdits: () => ({ mutate: state.quickEdit }),
  useRebuildSnapshot: () => state.rebuild(),
}));
vi.mock('../../src/components/editing/TransactionEditWorkflow.js', () => ({
  TransactionEditWorkflow: ({
    transactions,
    initialField,
  }: {
    transactions: unknown[];
    initialField?: string;
  }) => (
    <div role="dialog" aria-label="Selection editor">
      Editing {transactions.length} records: {initialField}
    </div>
  ),
}));

beforeEach(() => {
  useTransactionsStore.setState({
    transactions: null,
    selectedYear: null,
    selectedMonth: null,
    selectedTransactionIds: new Set(),
    expandedGroupIds: new Set(),
  });
  state.rebuild.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe('existing data workflow', () => {
  it('applies keyboard editing to the full selection and never silently flags only its first record', async () => {
    const collection = new Transactions('selection');
    for (let i = 0; i < 2; i++)
      collection.addNew(
        Transaction.create('file', 'bank', false, {
          amount: -10 - i,
          transactionDate: '2024-01-01',
          entityName: `Store ${i}`,
          transactionReason: TransactionReason.Purchase,
        }),
        account.config.accountInfo,
        { id: 'file', portableAddress: 'Bank/file.csv', format: 'csv', contentHash: 'file' },
        false,
      );
    state.transactions.mockReturnValue({
      data: collection.serialize(),
      isLoading: false,
      error: null,
    });
    state.quickEdit.mockClear();
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );
    await screen.findByRole('grid');
    act(() =>
      useTransactionsStore
        .getState()
        .selectTransactions([...collection.allParentChildTransactions].map((tx) => tx.id)),
    );
    fireEvent.keyDown(document.body, { key: 'n', altKey: true });
    expect(screen.getByRole('dialog')).toHaveTextContent('Editing 2 records: note');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: 'f', altKey: true });
    expect(screen.getByRole('dialog')).toHaveTextContent('Editing 2 records: isFlagged');
    expect(state.quickEdit).not.toHaveBeenCalled();
  });
  it('offers a build instead of onboarding when statements exist without a snapshot', async () => {
    state.transactions.mockReturnValue({
      data: new Transactions('empty').serialize(),
      isLoading: false,
      error: null,
    });
    const mutate = vi.fn();
    state.rebuild.mockReturnValue({ mutate, isPending: false });
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Build from existing statements' }));
    expect(mutate).toHaveBeenCalledWith(undefined);
    expect(screen.queryByRole('link', { name: 'Get Started' })).not.toBeInTheDocument();
  });

  it('renders loaded history and updates the period without a store render loop', async () => {
    const transactions = new Transactions('existing');
    transactions.addNew(
      Transaction.create('import', 'bank', false, {
        amount: -12,
        transactionDate: '2024-01-01',
        entityName: 'Example',
        transactionReason: TransactionReason.Purchase,
      }),
      account.config.accountInfo,
      {
        id: 'import',
        portableAddress: 'Bank/statement.csv',
        format: 'csv',
        contentHash: 'statement-hash',
      },
      false,
    );
    state.transactions.mockReturnValue({
      data: transactions.serialize(),
      isLoading: false,
      error: null,
    });
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('grid', { name: 'Transaction list' })).toBeInTheDocument();
    const period = screen.getByRole('button', { name: '2024-01' });
    fireEvent.click(period);
    expect(period).toHaveAttribute('aria-expanded', 'true');
    const summary = screen
      .getAllByRole('button', { name: 'Summary', exact: true })
      .find((button) => button.hasAttribute('aria-controls'))!;
    fireEvent.click(summary);
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    expect(period).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('compact-period')).not.toBeVisible();
    expect(document.getElementById('compact-details')).toBeVisible();
    act(() => useTransactionsStore.getState().selectYearMonth('2024', '01'));
    expect(screen.getByRole('grid', { name: 'Transaction list' })).toBeInTheDocument();
    act(() => useTransactionsStore.getState().selectYearMonth('2023', '01'));
    expect(screen.queryByRole('grid', { name: 'Transaction list' })).not.toBeInTheDocument();
    expect(screen.getByText(/No transactions to display/)).toBeInTheDocument();
  });

  it('shows failed source paths and keeps recovery available after an unsuccessful build', () => {
    state.rebuild.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      data: {
        committed: false,
        importedFiles: [],
        totalTransactions: 0,
        appliedEdits: 0,
        unresolvedEditTargets: 0,
        failedFiles: [{ path: 'Bank/broken.csv', error: 'Invalid date' }],
      },
    });
    render(
      <MemoryRouter>
        <ExistingStatements accounts={[account]} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Previous data was kept/)).toBeInTheDocument();
    expect(screen.getByText('Bank/broken.csv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build from existing statements' })).toBeEnabled();
  });
});
