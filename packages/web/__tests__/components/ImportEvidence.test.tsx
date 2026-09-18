import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountType, Transaction, TransactionReason, Transactions } from '@moneyinmotion/core';
import { SourceInventory } from '../../src/components/importing/SourceInventory.js';
import { UploadHistory } from '../../src/components/importing/UploadHistory.js';
import { preflightFolder } from '../../src/lib/import-preflight.js';
import { sourceInventory } from '../../src/lib/import-evidence.js';
import type { AccountSummary, FolderUploadItem } from '../../src/api/client.js';

const getHistory = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/imports.js', () => ({ getUploadHistory: getHistory }));

const account: AccountSummary = {
  config: {
    accountInfo: {
      id: 'bank',
      instituteName: 'Generic',
      title: 'Checking',
      type: AccountType.BankChecking,
      requiresParent: false,
    },
    fileFilters: ['*.csv'],
    scanSubFolders: true,
  },
  relativeDirectory: 'Bank',
  hasStatementFiles: true,
  stats: { transactionCount: 2, lastImportedAt: null },
};
const item = (relativePath: string, bytes = 1): FolderUploadItem => {
  const file = new File(['x'], relativePath.split('/').at(-1)!);
  Object.defineProperty(file, 'size', { value: bytes });
  return { file, relativePath };
};

describe('local import preflight', () => {
  it('maps a picker root case-insensitively and excludes settings/files without sending them', () => {
    const result = preflightFolder(
      [
        item('export/bank/2024/statement.CSV'),
        item('export/bank/AccountConfig.json'),
        item('export/bank/readme.txt'),
      ],
      [account],
    );
    expect(result.eligible).toHaveLength(1);
    expect(result.skipped).toHaveLength(2);
    expect(result.selectedFolders).toEqual(['Bank']);
    expect(result.errors).toEqual([]);
    expect(result.unmatchedPaths).toEqual([]);
  });
  it('does not quietly accept misspelled folders or subfolders disabled by configuration', () => {
    expect(preflightFolder([item('export/Bnak/statement.csv')], [account]).unmatchedPaths).toEqual([
      'Bnak/statement.csv',
    ]);
    const result = preflightFolder(
      [item('Bank/2024/statement.csv')],
      [{ ...account, config: { ...account.config, scanSubFolders: false } }],
    );
    expect(result.eligible).toHaveLength(0);
    expect(result.skipped[0]?.reason).toContain('disabled');
    expect(result.errors[0]).toContain('No statement files');
  });
  it('blocks request, per-file and count limits before upload', () => {
    expect(preflightFolder([item('Bank/large.csv', 21 * 1024 * 1024)], [account]).errors).toContain(
      'Bank/large.csv exceeds the 20 MiB per-file limit.',
    );
    expect(
      preflightFolder(
        Array.from({ length: 201 }, (_, i) => item(`Bank/${i}.csv`)),
        [account],
      ).errors.join(' '),
    ).toContain('200');
    expect(
      preflightFolder(
        Array.from({ length: 6 }, (_, i) => item(`Bank/${i}.csv`, 18 * 1024 * 1024)),
        [account],
      ).errors.join(' '),
    ).toContain('100 MiB');
  });
});

function collection() {
  const data = new Transactions('source-test');
  for (const [i, date] of ['2024-03-03', '2023-01-01'].entries()) {
    data.addNew(
      Transaction.create('source', 'bank', false, {
        transactionDate: date,
        amount: -10 - i,
        entityName: `Store ${i}`,
        transactionReason: TransactionReason.Purchase,
      }),
      account.config.accountInfo,
      {
        id: 'source',
        portableAddress: 'Bank/yearly.csv',
        contentHash: 'path-derived-not-a-checksum',
        createDate: '2025-01-01T00:00:00Z',
        updateDate: '2025-01-02T00:00:00Z',
        format: 'csv',
      },
      false,
    );
  }
  return data;
}

describe('source evidence', () => {
  it('groups records by source with actual transaction-date coverage', () => {
    const result = sourceInventory(collection());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      accountIds: ['bank'],
      recordCount: 2,
      from: '2023-01-01',
      to: '2024-03-03',
    });
  });
  it('links source records, labels filesystem times and never presents the legacy path hash as a checksum', () => {
    render(
      <MemoryRouter>
        <SourceInventory transactions={collection()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Bank/yearly.csv')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inspect records' })).toHaveAttribute(
      'href',
      expect.stringContaining('source=source'),
    );
    expect(screen.getByRole('link', { name: 'Inspect records' })).toHaveAttribute(
      'href',
      expect.stringContaining('basis=records'),
    );
    expect(screen.getByText('Filesystem created')).toBeInTheDocument();
    expect(screen.queryByText('path-derived-not-a-checksum')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search statement sources'), {
      target: { value: 'missing' },
    });
    expect(screen.getByText(/No sources match/)).toBeInTheDocument();
  });
});

describe('saved upload receipts', () => {
  beforeEach(() => {
    getHistory.mockReset();
  });
  function showHistory() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    return render(
      <QueryClientProvider client={client}>
        <UploadHistory />
      </QueryClientProvider>,
    );
  }
  it('shows receipt evidence and warns that historical rebuild outcomes are unknown', async () => {
    getHistory.mockResolvedValue({
      page: 0,
      pageSize: 10,
      total: 1,
      totalRecorded: 1,
      unreadableCount: 1,
      entries: [
        {
          batchId: 'sample',
          stagedAt: '2024-01-01T00:00:00.000Z',
          sourceFileCount: 1,
          files: [
            {
              relativePath: 'Bank/sample.csv',
              accountId: 'bank',
              status: 'duplicate',
              sha256: 'a'.repeat(64),
              destinationPath: null,
              duplicateOf: 'Bank/original.csv',
              message: 'Already stored',
              sizeBytes: 1024,
            },
          ],
        },
      ],
    });
    showHistory();
    expect(await screen.findByText('Bank/sample.csv')).toBeInTheDocument();
    expect(screen.getByText(/not a successful snapshot rebuild/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('1 upload receipt(s) could not be read');
    expect(screen.getByText('Content checksum (SHA-256)')).toBeInTheDocument();
  });
  it('makes read failures visible and provides retry', async () => {
    getHistory.mockRejectedValue(new Error('Manifest storage unavailable'));
    showHistory();
    expect(await screen.findByRole('alert')).toHaveTextContent('Manifest storage unavailable');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('refreshes a cached empty history when returning after a new upload receipt exists', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    const empty = {
      page: 0,
      pageSize: 10,
      total: 0,
      totalRecorded: 0,
      unreadableCount: 0,
      entries: [],
    };
    getHistory.mockResolvedValue(empty);
    const first = render(
      <QueryClientProvider client={client}>
        <UploadHistory />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/No browser upload receipts yet/)).toBeInTheDocument();
    first.unmount();
    // A successful upload creates a receipt while this tab is unmounted.
    getHistory.mockResolvedValue({
      ...empty,
      total: 1,
      totalRecorded: 1,
      entries: [
        {
          batchId: 'new-upload',
          stagedAt: '2024-01-02T00:00:00.000Z',
          sourceFileCount: 0,
          files: [],
        },
      ],
    });
    render(
      <QueryClientProvider client={client}>
        <UploadHistory />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Receipt new-upload/)).toBeInTheDocument();
    expect(screen.queryByText(/No browser upload receipts yet/)).not.toBeInTheDocument();
    client.clear();
  });
});
