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

function makeAccount(hasStatementFiles: boolean): AccountSummary {
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
      transactionCount: 0,
      lastImportedAt: null,
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

  it('does not mark statement upload complete before files exist', async () => {
    getAccountsMock.mockResolvedValue([makeAccount(false)]);

    renderPage();

    expect(await screen.findByText('No statement files detected yet.')).toBeInTheDocument();
    expect(screen.getAllByText('Complete')).toHaveLength(2);
  });

  it('marks statement upload complete when statement files are detected', async () => {
    getAccountsMock.mockResolvedValue([makeAccount(true)]);

    renderPage();

    expect(
      await screen.findByText('Statement files detected for 1 account.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Complete')).toHaveLength(3);
  });
});
