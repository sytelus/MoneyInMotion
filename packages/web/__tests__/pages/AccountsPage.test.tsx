import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountType } from '@moneyinmotion/core';
import { AccountsPage } from '../../src/pages/AccountsPage.js';
import { StatementFolderUpload } from '../../src/components/importing/StatementFolderUpload.js';
import type { AccountSummary } from '../../src/api/client.js';

const useAccountsMock = vi.fn();
const useUploadStatementFolderMock = vi.fn();
const getConfigMock = vi.fn();
const createAccountMock = vi.fn();
const updateAccountMock = vi.fn();
const deleteAccountMock = vi.fn();
const disconnectedFoldersMock = vi.fn();
const reconnectAccountMock = vi.fn();

vi.mock('../../src/api/imports.js', () => ({
  getDisconnectedFolders: () => disconnectedFoldersMock(),
  reconnectAccount: (...args: unknown[]) => reconnectAccountMock(...args),
}));

vi.mock('../../src/api/hooks.js', () => ({
  useAccounts: () => useAccountsMock(),
  useUploadStatementFolder: () => useUploadStatementFolderMock(),
  useRebuildSnapshot: () => ({ mutate: vi.fn(), isPending: false }),
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
    disconnectedFoldersMock.mockResolvedValue([]);
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

    expect(await screen.findByText('Snapshot records')).toBeInTheDocument();
    expect(screen.getByText(/Latest record build: 2024-03-01 08:00:00 UTC/)).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: /Remove config/i }));
    expect(screen.getByText(/Raw statement files are preserved/i)).toBeInTheDocument();

    expect(screen.getByText(/The next rebuild excludes this account/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remove configuration/i }));

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

    render(
      <MemoryRouter>
        <StatementFolderUpload accounts={[makeAccount()]} />
      </MemoryRouter>,
    );

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

  it('blocks misspelled account folders before any upload starts', async () => {
    const mutate = vi.fn();
    useUploadStatementFolderMock.mockReturnValue({
      mutate,
      reset: vi.fn(),
      isPending: false,
      data: null,
      isError: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <StatementFolderUpload accounts={[makeAccount()]} />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText(/Choose statement folder/i);
    const file = new File(['Date,Amount\n'], 'statement.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'exports/acct-cheking/statement.csv',
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText(/Fix the selected folder names before uploading/i)).toBeInTheDocument();
    expect(screen.getByText(/acct-cheking\/statement.csv/i)).toBeInTheDocument();
    expect(screen.getByText(/No files have been uploaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload & build snapshot/i })).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('filters accounts and links to the account reporting scope', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'Inspect account records' })).toHaveAttribute(
      'href',
      expect.stringContaining('account=acct-checking'),
    );
    fireEvent.change(screen.getByLabelText('Search accounts'), {
      target: { value: 'missing-bank' },
    });
    expect(screen.getByText('No accounts match these filters')).toBeInTheDocument();
  });

  it('reconnects an existing folder explicitly and explains the required rebuild', async () => {
    disconnectedFoldersMock.mockResolvedValue([{ relativeDirectory: 'old-bank' }]);
    reconnectAccountMock.mockResolvedValue(makeAccount({ hasStatementFiles: true }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reconnect folder' }));
    fireEvent.change(screen.getByLabelText('Account ID'), { target: { value: 'original-id' } });
    fireEvent.change(screen.getByLabelText('Account Title'), {
      target: { value: 'Restored account' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect folder' }));
    await waitFor(() =>
      expect(reconnectAccountMock).toHaveBeenCalledWith(
        'old-bank',
        expect.objectContaining({ accountInfo: expect.objectContaining({ id: 'original-id' }) }),
      ),
    );
    expect(await screen.findByText('Account folder reconnected')).toBeInTheDocument();
    expect(
      screen.getByText(/Existing snapshot records are unchanged until you rebuild/i),
    ).toBeInTheDocument();
  });

  it('prefills and locks a known original account identity rather than using its folder name', async () => {
    disconnectedFoldersMock.mockResolvedValue([
      {
        relativeDirectory: 'old-folder',
        identityStatus: 'known',
        originalAccount: {
          ...makeAccount().config.accountInfo,
          id: 'original-id',
          title: 'Original account',
        },
      },
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reconnect folder' }));
    expect(screen.getByLabelText('Account ID')).toHaveValue('original-id');
    expect(screen.getByLabelText('Account ID')).toBeDisabled();
    expect(screen.getByLabelText('Account Title')).toHaveValue('Original account');
    expect(screen.getByLabelText('Institution')).toHaveValue('TestBank');
    expect(
      screen.getByText(/File filters and subfolder settings are not retained/),
    ).toBeInTheDocument();
  });
});
