import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  AccountType,
  ScopeType,
  TransactionReason,
  type TransactionsData,
} from '@moneyinmotion/core';
import { RulesPage } from '../../src/pages/RulesPage.js';

const useTransactionsMock = vi.fn();
const useApplyEditsMock = vi.fn();

vi.mock('../../src/api/hooks.js', () => ({
  useTransactions: () => useTransactionsMock(),
  useApplyEdits: () => useApplyEditsMock(),
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
    <MemoryRouter>
      <RulesPage />
    </MemoryRouter>,
  );
}

describe('RulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders persisted rules and creates a new voiding edit on revert', async () => {
    const mutateMock = vi.fn((_edits, options) => {
      options?.onSuccess?.({ affectedTransactionsCount: 1 }, undefined, undefined);
    });

    useTransactionsMock.mockReturnValue({
      data: makeTransactionsData(),
      isLoading: false,
      error: null,
    });
    useApplyEditsMock.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    });

    renderPage();

    expect(await screen.findByText('Scoped Edits')).toBeInTheDocument();
    expect(screen.getByText('Normalized entity: Amazon')).toBeInTheDocument();
    expect(screen.getByText('Shopping > Online')).toBeInTheDocument();
    expect(screen.getByText(/Amazon \(-\$25\.12 on Feb 1, 2024\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Revert to Imported Values/i }));

    expect(await screen.findByText('Revert Edit Rule')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Revert Rule/i }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            sourceId: 'rules-ui',
            auditInfo: expect.objectContaining({
              createdBy: 'rules-ui',
            }),
            scopeFilters: [
              expect.objectContaining({
                type: ScopeType.EntityNameNormalized,
                parameters: ['Amazon'],
              }),
            ],
            values: expect.objectContaining({
              categoryPath: expect.objectContaining({
                isVoided: true,
              }),
            }),
          }),
        ],
        expect.any(Object),
      );
    });

    expect(await screen.findByText(/Reverted rule for 1 transaction/i)).toBeInTheDocument();
  });

  it('disables revert when an edit is already a voiding rule', async () => {
    const data = makeTransactionsData();
    data.edits = [
      {
        ...data.edits[0]!,
        id: 'edit-void',
        values: {
          note: {
            value: '',
            isVoided: true,
          },
        },
      },
    ];

    useTransactionsMock.mockReturnValue({
      data,
      isLoading: false,
      error: null,
    });
    useApplyEditsMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    renderPage();

    expect(await screen.findByText('Audit Only')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Revert to Imported Values/i }),
    ).toBeDisabled();
  });
});
