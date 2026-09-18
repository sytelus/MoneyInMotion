import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AccountType,
  ScopeType,
  TransactionReason,
  createScopeFilter,
  type TransactionsData,
} from '@moneyinmotion/core';
import { RulesPage } from '../../src/pages/RulesPage.js';
const useTransactionsMock = vi.fn();
const manageRulesMock = vi.fn();
vi.mock('../../src/api/hooks.js', () => ({
  useTransactions: () => useTransactionsMock(),
  queryKeys: { transactions: ['transactions'] },
}));
vi.mock('../../src/api/client.js', () => ({
  manageRules: (...args: unknown[]) => manageRulesMock(...args),
}));
function makeTransactionsData(): TransactionsData {
  return {
    name: 'latest',
    topItems: {
      'txn-1': {
        id: 'txn-1',
        transactionReason: TransactionReason.Purchase,
        transactionDate: '2024-02-01T00:00:00.000Z',
        postedDate: '2024-02-02T00:00:00.000Z',
        entityName: 'AMAZON MKTPLACE',
        entityNameNormalized: 'Amazon',
        amount: -25.12,
        contentHash: 'hash-1',
        accountId: 'acct-1',
        importId: 'import-1',
        auditInfo: {
          createDate: '2024-02-02T00:00:00.000Z',
          createdBy: 'importer',
          updateDate: null,
          updatedBy: null,
        },
        appliedEditIdsDescending: ['edit-1'],
      },
    },
    accountInfos: {
      'acct-1': {
        id: 'acct-1',
        instituteName: 'Generic',
        title: 'Checking',
        type: AccountType.BankChecking,
        requiresParent: false,
        interAccountNameTags: [],
      },
    },
    importInfos: {
      'import-1': {
        id: 'import-1',
        portableAddress: 'Statements/acct-1/statement.csv',
        createDate: '2024-02-02T00:00:00.000Z',
        updateDate: '2024-02-02T00:00:00.000Z',
        contentHash: 'file-hash-1',
        format: 'csv',
      },
    },
    edits: [
      {
        id: 'edit-1',
        auditInfo: {
          createDate: '2024-03-01T12:30:00.000Z',
          createdBy: 'web-ui',
          updateDate: null,
          updatedBy: null,
        },
        scopeFilters: [
          {
            type: ScopeType.EntityNameNormalized,
            parameters: ['Amazon'],
            referenceParameters: null,
            contentHash: 'Amazon\t4',
          },
        ],
        values: {
          categoryPath: {
            value: ['Shopping', 'Online'],
            isVoided: false,
          },
        },
        sourceId: 'web-ui',
      },
    ],
  };
}

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe('RulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const data = makeTransactionsData();
    data.edits[0]!.scopeFilters = [createScopeFilter(ScopeType.EntityNameNormalized, ['Amazon'])];
    useTransactionsMock.mockReturnValue({ data, isLoading: false, error: null, refetch: vi.fn() });
    manageRulesMock.mockResolvedValue({
      affectedTransactionsCount: 1,
      totalRules: 0,
      missingTargets: 0,
      samples: [],
    });
  });
  it('shows clear rule labels, previews deletion, and saves only after confirmation', async () => {
    renderPage();
    expect(screen.getByText('Category: Shopping / Online')).toBeInTheDocument();
    expect(screen.getByText('1 recorded matches')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));
    expect(await screen.findByText('1 transaction will change')).toBeInTheDocument();
    expect(manageRulesMock).toHaveBeenCalledTimes(1);
    expect(manageRulesMock.mock.calls[0]?.[1]).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete rules' }));
    await waitFor(() => expect(manageRulesMock.mock.calls[1]?.[1]).toBe(false));
    expect(await screen.findByText(/Saved. 1 transaction values changed/)).toBeInTheDocument();
  });
  it('edits existing conditions and changes without rewriting the ID', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule 1' }));
    fireEvent.change(screen.getByLabelText('Category value'), {
      target: { value: 'Home / Office' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    await waitFor(() => expect(manageRulesMock).toHaveBeenCalled());
    const change = manageRulesMock.mock.calls[0]?.[0][0];
    expect(change.previous.id).toBe('edit-1');
    expect(change.next.id).toBe('edit-1');
    expect(change.next.values.categoryPath.value).toEqual(['Home', 'Office']);
  });
  it('creates rules with editable words and rejects an empty condition', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Create rule' }));
    fireEvent.change(screen.getByLabelText('Mark for review'), { target: { value: 'set' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/parameters|empty/i);
    expect(manageRulesMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Condition 1 values'), { target: { value: 'Amazon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    await waitFor(() => expect(manageRulesMock).toHaveBeenCalled());
    expect(manageRulesMock.mock.calls[0]?.[0][0].previous).toBeNull();
  });
  it('paginates hundreds of rules, searches and offers bulk edits', () => {
    const data = makeTransactionsData();
    const original = data.edits[0]!;
    data.edits = Array.from({ length: 431 }, (_, index) => ({
      ...original,
      id: `edit-${index}`,
      values: {
        categoryPath: {
          value: [index === 0 ? 'Unique target' : 'Shopping'],
          isVoided: false as const,
        },
      },
    }));
    useTransactionsMock.mockReturnValue({ data, isLoading: false, error: null });
    renderPage();
    expect(screen.getAllByRole('article')).toHaveLength(25);
    fireEvent.change(screen.getByLabelText('Search rules'), { target: { value: 'Unique target' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Select page' }));
    expect(screen.getByRole('button', { name: 'Edit selected' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Search rules'), { target: { value: 'no such rule' } });
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText('No rules match these filters')).toBeInTheDocument();
  });
  it('explains unavailable targets in a keyboard-accessible popup', async () => {
    const data = makeTransactionsData();
    data.edits[0]!.scopeFilters = [createScopeFilter(ScopeType.TransactionId, ['missing'])];
    useTransactionsMock.mockReturnValue({ data, isLoading: false, error: null });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Explain Unavailable transactions' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('not a missing dollar amount');
    expect(screen.queryByText('Resettable')).not.toBeInTheDocument();
  });
  it('shows a preview failure without enabling commit', async () => {
    manageRulesMock.mockRejectedValue(new Error('Refresh Rules and try again.'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete rule 1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Refresh Rules');
    expect(screen.getByRole('button', { name: 'Delete rules' })).toBeDisabled();
  });
});
