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
const useAccountsMock = vi.fn();
const manageRulesMock = vi.fn();
const downloadTextMock = vi.fn();
vi.mock('../../src/api/hooks.js', () => ({
  useTransactions: () => useTransactionsMock(),
  useAccounts: () => useAccountsMock(),
  queryKeys: { transactions: ['transactions'] },
}));
vi.mock('../../src/api/client.js', () => ({
  manageRules: (...args: unknown[]) => manageRulesMock(...args),
}));
vi.mock('../../src/lib/download.js', () => ({
  downloadText: (...args: unknown[]) => downloadTextMock(...args),
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
    useAccountsMock.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
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
  it('inspects recorded effects, filters by purpose and account, and preserves edit drafts', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect results' }));
    expect(screen.getByRole('dialog', { name: 'Rule 1 · results & details' })).toHaveTextContent(
      'Controls: Category',
    );
    expect(manageRulesMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule' }));
    fireEvent.change(screen.getByLabelText('Category value'), {
      target: { value: 'Retained draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    await screen.findByText('1 transaction will change');
    fireEvent.click(screen.getByRole('button', { name: 'Back to editing' }));
    expect(screen.getByLabelText('Category value')).toHaveValue('Retained draft');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.change(screen.getByLabelText('Rule purpose'), { target: { value: 'correction' } });
    expect(screen.getByText('No rules match these filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    fireEvent.change(screen.getByLabelText('Account scope or recorded match'), {
      target: { value: 'acct-1' },
    });
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
  it('duplicates into a new draft without altering the original identity', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('dialog', { name: 'Duplicate rule' })).toBeInTheDocument();
    expect(screen.getByLabelText('Category value')).toHaveValue('Shopping / Online');
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    await waitFor(() => expect(manageRulesMock).toHaveBeenCalled());
    expect(manageRulesMock.mock.calls[0]?.[0][0].previous).toBeNull();
    expect(manageRulesMock.mock.calls[0]?.[0][0].next.id).not.toBe('edit-1');
  });
  it('targets a configured empty account before the first import, with a read-failure fallback', async () => {
    useAccountsMock.mockReturnValue({
      data: [{ config: { accountInfo: { id: 'new-account', title: 'New savings' } } }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const page = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Create rule' }));
    fireEvent.change(screen.getByLabelText('Condition 1 type'), {
      target: { value: String(ScopeType.AccountId) },
    });
    expect(
      screen.getByRole('option', { name: 'New savings · no imported records' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Account condition'), {
      target: { value: 'new-account' },
    });
    fireEvent.change(screen.getByLabelText('Mark for review'), { target: { value: 'set' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    await waitFor(() => expect(manageRulesMock).toHaveBeenCalled());
    expect(manageRulesMock.mock.calls[0]?.[0][0].next.scopeFilters[0].parameters).toEqual([
      'new-account',
    ]);
    page.unmount();
    useAccountsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('offline'),
      refetch: vi.fn(),
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Create rule' }));
    fireEvent.change(screen.getByLabelText('Condition 1 type'), {
      target: { value: String(ScopeType.AccountId) },
    });
    expect(screen.getByRole('option', { name: 'Checking' })).toBeInTheDocument();
    expect(screen.getByText(/Could not load configured accounts/)).toBeInTheDocument();
  });
  it('exports filtered or selected saved rules locally without calling the mutation API', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Export results' }));
    expect(JSON.parse(downloadTextMock.mock.calls[0]?.[0])).toMatchObject([{ id: 'edit-1' }]);
    expect(downloadTextMock.mock.calls[0]?.[1]).toMatch(/^moneyinmotion-rules-.*\.json$/);
    expect(downloadTextMock.mock.calls[0]?.[2]).toBe('application/json');
    fireEvent.click(screen.getByRole('button', { name: 'Select page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export selected' }));
    expect(screen.getByRole('status')).toHaveTextContent('Exported 1 selected rules as JSON');
    expect(downloadTextMock).toHaveBeenCalledTimes(2);
    expect(manageRulesMock).not.toHaveBeenCalled();
  });
});
