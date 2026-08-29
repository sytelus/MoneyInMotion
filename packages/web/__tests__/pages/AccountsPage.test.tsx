import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountType } from '@moneyinmotion/core';
import { AccountsPage } from '../../src/pages/AccountsPage.js';
import type { AccountSummary } from '../../src/api/client.js';

const useAccountsMock = vi.fn();
const useUploadStatementFolderMock = vi.fn();
const getConfigMock = vi.fn();
const createAccountMock = vi.fn();
const updateAccountMock = vi.fn();
const deleteAccountMock = vi.fn();

vi.mock('../../src/api/hooks.js', () => ({
  useAccounts: () => useAccountsMock(),
  useUploadStatementFolder: () => useUploadStatementFolderMock(),
}));

vi.mock('../../src/api/client.js', () => ({
  getConfig: (...args: unknown[]) => getConfigMock(...args),
  createAccount: (...args: unknown[]) => createAccountMock(...args),
  updateAccount: (...args: unknown[]) => updateAccountMock(...args),
  deleteAccount: (...args: unknown[]) => deleteAccountMock(...args),
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
    relativeDirectory: 'acct-checking',
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
      dataRoot: '/tmp',
      username: 'mim-data',
      userDataPath: '/tmp/mim-data',
      statementsDir: '/tmp/mim-data/Statements',
      mergedDir: '/tmp/mim-data/Merged',
      stagingDir: '/tmp/mim-data/staging',
      activePort: 3001,
      activeDataRoot: '/tmp',
      activeUsername: 'mim-data',
      activeUserDataPath: '/tmp/mim-data',
      restartRequired: false,
    });
    useAccountsMock.mockReturnValue({
      data: [makeAccount()],
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useUploadStatementFolderMock.mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
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

    // Institution names are user data, not a closed enum. A custom value must
    // survive opening and saving the form even though it is not in the datalist.
    expect(screen.getByLabelText('Institution')).toHaveValue('TestBank');
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

  it('explains unsupported order-history settings before sending them', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Add Account/i }));
    fireEvent.change(screen.getByLabelText('Account ID'), { target: { value: 'orders' } });
    fireEvent.change(screen.getByLabelText('Account Title'), { target: { value: 'Orders' } });
    fireEvent.click(screen.getByLabelText('Order History'));
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(
      screen.getByText('Order History accounts currently support only Amazon and Etsy.'),
    ).toBeInTheDocument();
    expect(createAccountMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Institution'), { target: { value: 'Amazon' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(
      screen.getByText(
        'Order History accounts require at least one match tag for financial-charge matching.',
      ),
    ).toBeInTheDocument();
    expect(createAccountMock).not.toHaveBeenCalled();
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

  it('preserves relative paths when uploading a statement folder', async () => {
    const mutate = vi.fn();
    useUploadStatementFolderMock.mockReturnValue({
      mutate,
      reset: vi.fn(),
      isPending: false,
      data: null,
      isError: false,
      error: null,
    });

    renderPage();

    const input = await screen.findByLabelText(/Choose statement folder/i);
    const file = new File(['Date,Amount\n'], 'statement.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'exports/acct-checking/statement.csv',
    });

    fireEvent.change(input, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Upload & build snapshot/i }));

    expect(mutate).toHaveBeenCalledWith([
      {
        file,
        relativePath: 'exports/acct-checking/statement.csv',
      },
    ]);
    expect(screen.getByText(/1 file ready from exports/i)).toBeInTheDocument();
  });
});
