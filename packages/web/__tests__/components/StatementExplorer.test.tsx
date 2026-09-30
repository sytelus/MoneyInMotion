import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatementExplorer } from '../../src/components/importing/StatementExplorer.js';
import type { StatementEntry } from '../../src/api/imports.js';

const inventoryMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/api/imports.js', () => ({ getStatementInventory: inventoryMock }));
const entry = (path: string, overrides: Partial<StatementEntry> = {}): StatementEntry => ({
  path,
  name: path.split('/').at(-1)!,
  kind: 'file',
  status: 'eligible',
  reason: 'Included by account settings.',
  accountId: 'bank',
  sizeBytes: 1200,
  modifiedAt: '2024-02-01T00:00:00.000Z',
  fileCount: 0,
  eligibleCount: 0,
  ...overrides,
});
const entries: StatementEntry[] = [
  entry('Bank', { kind: 'folder', fileCount: 3, eligibleCount: 2 }),
  entry('Bank/2024', { kind: 'folder', fileCount: 1, eligibleCount: 1 }),
  entry('Bank/2024/january.csv'),
  entry('Bank/current.csv'),
  entry('Bank/notes.txt', { status: 'ignored', reason: 'Does not match *.csv.' }),
  entry('Bank/AccountConfig.json', { status: 'configuration' }),
  entry('orphan.csv', { status: 'unconfigured', accountId: null }),
];
const show = (url = '/imports?tab=files') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <StatementExplorer transactions={null} />
    </MemoryRouter>,
  );
describe('Statement explorer', () => {
  it('restores file filters from a bookmarked or back-navigation URL', async () => {
    inventoryMock.mockResolvedValue({ entries, truncated: false, unreadableFolders: 0 });
    show('/imports?tab=files&folder=Bank&fileSearch=notes&fileStatus=ignored&fileSort=size');
    await screen.findByRole('table');
    expect(screen.getByRole('textbox', { name: 'Search stored files' })).toHaveValue('notes');
    expect(screen.getByRole('combobox', { name: 'File status' })).toHaveValue('ignored');
    expect(screen.getByRole('combobox', { name: 'Sort stored files' })).toHaveValue('size');
    expect(screen.getByRole('button', { name: 'Bank/notes.txt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bank/current.csv' })).not.toBeInTheDocument();
  });
  beforeEach(() => {
    inventoryMock.mockReset();
    inventoryMock.mockResolvedValue({ entries, truncated: false, unreadableFolders: 0 });
  });
  it('navigates a real folder hierarchy and shows actual counts, including root files', async () => {
    show();
    const tree = await screen.findByRole('navigation', { name: 'Statement folders' });
    expect(within(tree).getByRole('button', { name: 'Statements · 4 files' })).toBeInTheDocument();
    fireEvent.click(within(tree).getByRole('button', { name: 'Expand Bank' }));
    fireEvent.click(within(tree).getByRole('button', { name: '2024 · 1 files' }));
    fireEvent.click(within(tree).getByRole('button', { name: 'Collapse Bank' }));
    expect(within(tree).queryByRole('button', { name: '2024 · 1 files' })).not.toBeInTheDocument();
    expect(within(tree).getByRole('button', { name: 'Expand Bank' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    const table = screen.getByRole('table', { name: 'Stored statement files' });
    expect(within(table).getByRole('button', { name: 'january.csv' })).toBeInTheDocument();
    expect(within(table).queryByText('current.csv')).not.toBeInTheDocument();
    fireEvent.click(within(table).getByRole('button', { name: 'january.csv' }));
    expect(
      screen.getByText(/Eligibility alone does not mean the file has been imported/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View.*transactions/ })).not.toBeInTheDocument();
    expect(within(table).getByText('Included by account settings.').closest('td')).toHaveAttribute(
      'colspan',
      '2',
    );
  });
  it('searches across descendants in the selected scope and explains excluded files', async () => {
    show('/imports?tab=files&folder=Bank');
    await screen.findByRole('table');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search stored files' }), {
      target: { value: 'january' },
    });
    expect(screen.getByRole('button', { name: 'Bank/2024/january.csv' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search stored files' }), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'File status' }), {
      target: { value: 'ignored' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bank/notes.txt' }));
    expect(screen.getByText('Does not match *.csv.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'current.csv' })).not.toBeInTheDocument();
  });
  it('paginates large folders and can sort the whole result set by file size', async () => {
    inventoryMock.mockResolvedValue({
      entries: Array.from({ length: 121 }, (_, i) =>
        entry(`file-${String(i).padStart(3, '0')}.csv`, { sizeBytes: i }),
      ),
      truncated: false,
      unreadableFolders: 0,
    });
    show();
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(51);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort stored files' }), {
      target: { value: 'size' },
    });
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('file-120.csv');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(within(table).getAllByRole('row')).toHaveLength(51);
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('file-070.csv');
  });
  it('discloses missing folders, unreadable paths and incomplete inventory', async () => {
    inventoryMock.mockResolvedValue({ entries, truncated: true, unreadableFolders: 1 });
    show('/imports?tab=files&folder=renamed');
    expect(await screen.findByText('This inventory is incomplete')).toBeInTheDocument();
    expect(screen.getByText('Some folders cannot be read')).toBeInTheDocument();
    expect(screen.getByText('This folder is no longer available')).toBeInTheDocument();
  });
  it('offers recovery from an inventory failure without pretending the folder is empty', async () => {
    inventoryMock.mockRejectedValueOnce(new Error('Unavailable'));
    show();
    expect(await screen.findByText('Statement files could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('This folder is empty.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh files' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(inventoryMock).toHaveBeenCalledTimes(2);
  });
});
