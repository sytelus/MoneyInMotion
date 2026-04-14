import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountType } from '@moneyinmotion/core';
import { WelcomePage } from '../../src/pages/WelcomePage.js';
import type { AccountSummary } from '../../src/api/client.js';

const getConfigMock = vi.fn();
const getAccountsMock = vi.fn();
const useScanStatementsMock = vi.fn();

vi.mock('../../src/api/client.js', () => ({
  getConfig: (...args: unknown[]) => getConfigMock(...args),
  getAccounts: (...args: unknown[]) => getAccountsMock(...args),
}));

vi.mock('../../src/api/hooks.js', () => ({
  useScanStatements: () => useScanStatementsMock(),
}));

function makeAccount(
  hasStatementFiles: boolean,
  transactionCount = 0,
): AccountSummary {
  return {
    config: {
      accountInfo: {
        id: 'acct-checking',
        instituteName: 'Generic',
        title: 'Checking',
        type: AccountType.BankChecking,
        requiresParent: false,
        interAccountNameTags: [],
      },
      fileFilters: ['*.csv'],
      scanSubFolders: true,
    },
    stats: {
      transactionCount,
      lastImportedAt: transactionCount > 0 ? '2024-01-01T00:00:00Z' : null,
    },
    hasStatementFiles,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WelcomePage />
    </MemoryRouter>,
  );
}

describe('WelcomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({
      port: 3001,
      dataPath: '/tmp/mim-data',
      statementsDir: '/tmp/mim-data/Statements',
      mergedDir: '/tmp/mim-data/Merged',
    });
    useScanStatementsMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      data: null,
      isError: false,
      error: null,
    });
  });

  it('leaves the import step incomplete before any transactions are imported', async () => {
    getAccountsMock.mockResolvedValue([makeAccount(false)]);

    renderPage();

    expect(
      await screen.findByText('No statement files uploaded yet.'),
    ).toBeInTheDocument();
    // Only step 1 (data folder) and step 2 (accounts) should be complete.
    expect(screen.getAllByText('Complete')).toHaveLength(2);
  });

  it('marks the import step complete once transactions have been imported', async () => {
    getAccountsMock.mockResolvedValue([makeAccount(true, 42)]);

    renderPage();

    expect(
      await screen.findByText('Statement files detected for 1 account.'),
    ).toBeInTheDocument();
    // All three steps should now show Complete.
    expect(screen.getAllByText('Complete')).toHaveLength(3);
  });

  it('surfaces per-file import errors in the scan success banner', async () => {
    getAccountsMock.mockResolvedValue([makeAccount(true)]);
    useScanStatementsMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: true,
      data: {
        newTransactions: 5,
        totalTransactions: 5,
        importedFiles: ['MyBank/ok.csv'],
        failedFiles: [
          { path: 'MyBank/bad.csv', error: 'Could not parse header row' },
        ],
      },
      isError: false,
      error: null,
    });

    renderPage();

    expect(
      await screen.findByText(/1 file could not be parsed:/i),
    ).toBeInTheDocument();
    expect(screen.getByText('MyBank/bad.csv')).toBeInTheDocument();
    expect(
      screen.getByText(/Could not parse header row/i),
    ).toBeInTheDocument();
  });
});
