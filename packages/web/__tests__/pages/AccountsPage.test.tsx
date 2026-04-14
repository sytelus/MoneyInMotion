import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountType } from '@moneyinmotion/core';
import { AccountsPage } from '../../src/pages/AccountsPage.js';
import type { AccountSummary } from '../../src/api/client.js';

const useAccountsMock = vi.fn();
const useScanStatementsMock = vi.fn();
const getConfigMock = vi.fn();
const createAccountMock = vi.fn();
const updateAccountMock = vi.fn();
const deleteAccountMock = vi.fn();
const uploadAccountFilesMock = vi.fn();

vi.mock('../../src/api/hooks.js', () => ({
  useAccounts: () => useAccountsMock(),
  useScanStatements: () => useScanStatementsMock(),
}));

vi.mock('../../src/api/client.js', () => ({
  getConfig: (...args: unknown[]) => getConfigMock(...args),
  createAccount: (...args: unknown[]) => createAccountMock(...args),
  updateAccount: (...args: unknown[]) => updateAccountMock(...args),
  deleteAccount: (...args: unknown[]) => deleteAccountMock(...args),
  uploadAccountFiles: (...args: unknown[]) => uploadAccountFilesMock(...args),
}));

function makeAccount(overrides?: Partial<AccountSummary>): AccountSummary {
  return {
    config: {
      accountInfo: {
        id: 'acct-checking',
        instituteName: 'TestBank',
        title: 'Checking',
        type: AccountType.BankChecking,
        requiresParent: false,
        interAccountNameTags: ['TRANSFER'],
      },
      fileFilters: ['*.csv'],
      scanSubFolders: true,
    },
    stats: {
      transactionCount: 2,
      lastImportedAt: '2024-03-01T08:00:00Z',
    },
    hasStatementFiles: false,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountsPage />
    </MemoryRouter>,
  );
}

describe('AccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({
      port: 3001,
      dataPath: '/tmp/mim-data',
      statementsDir: '/tmp/mim-data/Statements',
      mergedDir: '/tmp/mim-data/Merged',
      activePort: 3001,
      activeDataPath: '/tmp/mim-data',
      restartRequired: false,
    });
    useAccountsMock.mockReturnValue({
      data: [makeAccount()],
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useScanStatementsMock.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({
        newTransactions: 0,
        totalTransactions: 0,
        importedFiles: [],
        failedFiles: [],
      }),
      isPending: false,
      isSuccess: false,
      data: null,
      isError: false,
      error: null,
    });
  });

  it('renders per-account import stats and match tags', async () => {
    renderPage();

    expect(await screen.findByText(/Imported: 2 transactions/)).toBeInTheDocument();
    expect(screen.getByText(/Imported: 2 transactions/)).toBeInTheDocument();
    expect(screen.getByText(/Last import: 2024-03-01 08:00:00 UTC/)).toBeInTheDocument();
    expect(screen.getByText(/Match tags: TRANSFER/)).toBeInTheDocument();
    expect(await screen.findByText('/tmp/mim-data/Statements/acct-checking/')).toBeInTheDocument();
  });

  it('submits account edits through the update API', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    useAccountsMock.mockReturnValue({
      data: [makeAccount()],
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    updateAccountMock.mockResolvedValue(
      makeAccount({
        config: {
          accountInfo: {
            id: 'acct-checking',
            instituteName: 'TestBank',
            title: 'Updated Checking',
            type: AccountType.BankChecking,
            requiresParent: false,
            interAccountNameTags: ['AMEX', 'TRANSFER'],
          },
          fileFilters: ['*.csv', '*.txt'],
          scanSubFolders: false,
        },
      }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Edit/i }));

    fireEvent.change(screen.getByLabelText('Account Title'), {
      target: { value: 'Updated Checking' },
    });
    fireEvent.change(screen.getByLabelText('Match Tags'), {
      target: { value: 'AMEX, TRANSFER' },
    });
    fireEvent.change(screen.getByLabelText('File Filters'), {
      target: { value: '*.csv, *.txt' },
    });
    fireEvent.click(screen.getByLabelText(/Scan subfolders/i));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateAccountMock).toHaveBeenCalledWith(
        'acct-checking',
        expect.objectContaining({
          accountInfo: expect.objectContaining({
            id: 'acct-checking',
            title: 'Updated Checking',
            interAccountNameTags: ['AMEX', 'TRANSFER'],
          }),
          fileFilters: ['*.csv', '*.txt'],
          scanSubFolders: false,
        }),
      );
    });
    expect(refetchMock).toHaveBeenCalled();
  });

  it('confirms deletion and calls the delete API', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    useAccountsMock.mockReturnValue({
      data: [makeAccount()],
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    deleteAccountMock.mockResolvedValue({
      deletedId: 'acct-checking',
      removedDirectory: false,
      keptStatementFiles: true,
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Delete/i }));
    expect(screen.getByText(/Raw statement files are preserved/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Delete Account Config/i }));

    await waitFor(() => {
      expect(deleteAccountMock).toHaveBeenCalledWith('acct-checking');
    });
    expect(refetchMock).toHaveBeenCalled();
  });

  it('uploads statement files through the account upload API', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);
    useAccountsMock.mockReturnValue({
      data: [makeAccount()],
      isLoading: false,
      error: null,
      refetch: refetchMock,
    });
    uploadAccountFilesMock.mockResolvedValue({
      accountId: 'acct-checking',
      uploadedFiles: [
        {
          originalName: 'statement.csv',
          storedName: 'statement.csv',
          portablePath: 'Statements/acct-checking/statement.csv',
          sizeBytes: 18,
        },
      ],
    });

    renderPage();

    const input = await screen.findByLabelText(/Upload statement files for Checking/i);
    const file = new File(['Date,Amount\n'], 'statement.csv', { type: 'text/csv' });

    fireEvent.change(input, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(uploadAccountFilesMock).toHaveBeenCalledWith('acct-checking', [file]);
    });
    expect(refetchMock).toHaveBeenCalled();
    // After a successful upload the page now auto-triggers a scan, so the
    // banner says "Uploaded and imported 1 file" instead of just "Uploaded
    // 1 file".
    expect(
      await screen.findByText(/Uploaded and imported 1 file/i),
    ).toBeInTheDocument();
  });
});
