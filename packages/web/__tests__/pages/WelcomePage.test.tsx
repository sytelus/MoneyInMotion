import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountType } from '@moneyinmotion/core';
import { WelcomePage } from '../../src/pages/WelcomePage.js';
import type { AccountSummary } from '../../src/api/client.js';

const getConfigMock = vi.fn();
const getAccountsMock = vi.fn();
vi.mock('../../src/api/hooks.js', () => ({
  useRebuildSnapshot: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../src/api/client.js', () => ({
  getConfig: (...args: unknown[]) => getConfigMock(...args),
  getAccounts: (...args: unknown[]) => getAccountsMock(...args),
}));

function makeAccount(hasStatementFiles: boolean, transactionCount = 0): AccountSummary {
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
    relativeDirectory: 'acct-checking',
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
      dataRoot: '/tmp/mim_root',
      username: 'alex',
      userDataPath: '/tmp/mim_root/alex',
      statementsDir: '/tmp/mim_root/alex/Statements',
      mergedDir: '/tmp/mim_root/alex/Merged',
      stagingDir: '/tmp/mim_root/alex/staging',
      activePort: 3001,
      activeDataRoot: '/tmp/mim_root',
      activeUsername: 'alex',
      activeUserDataPath: '/tmp/mim_root/alex',
      restartRequired: false,
    });
  });

  it('leaves the import step incomplete before any transactions are imported', async () => {
    getAccountsMock.mockResolvedValue([makeAccount(false)]);

    renderPage();

    expect(await screen.findByText('No statement files uploaded yet.')).toBeInTheDocument();
    // Only step 1 (data folder) and step 2 (accounts) should be complete.
    expect(screen.getAllByText('Complete')).toHaveLength(2);
  });

  it('marks the import step complete once transactions have been imported', async () => {
    getAccountsMock.mockResolvedValue([makeAccount(true, 42)]);

    renderPage();

    expect(await screen.findByText('Statement files detected for 1 account.')).toBeInTheDocument();
    // All three steps should now show Complete.
    expect(screen.getAllByText('Complete')).toHaveLength(3);
  });

  it('explains that folder upload automatically builds the snapshot', async () => {
    getAccountsMock.mockResolvedValue([makeAccount(true)]);

    renderPage();

    expect(await screen.findByText(/builds the snapshot automatically/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Choose Statement Folder/i })).toBeInTheDocument();
  });
});
