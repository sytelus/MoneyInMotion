import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { Transactions } from '@moneyinmotion/core';
import {
  getStatementInventory,
  type StatementEntry,
  type StatementInventory,
} from '../../api/imports.js';
import { sourceInventory } from '../../lib/import-evidence.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { Button, buttonClassName } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { HelpHint } from '../ui/help-hint.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { Pagination } from '../ui/pagination.js';
import { Notice } from '../ui/notice.js';

const PAGE_SIZE = 50;
const parentPath = (value: string) =>
  value.includes('/') ? value.slice(0, value.lastIndexOf('/')) : '';
const labels: Record<StatementEntry['status'], string> = {
  eligible: 'Eligible',
  ignored: 'Ignored',
  unsupported: 'Unsupported format',
  unconfigured: 'Needs account settings',
  configuration: 'Account settings',
  symlink: 'Not followed',
  unreadable: 'Cannot read',
};
const fileSize = (bytes: number | null) =>
  bytes == null
    ? '—'
    : bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Real files on disk, kept separate from source references retained in the current snapshot. */
export function StatementExplorer({ transactions }: { transactions: Transactions | null }) {
  const showSize = useMediaQuery('(min-width: 640px)');
  const showModified = useMediaQuery('(min-width: 1024px)');
  const columnCount = 2 + Number(showSize) + Number(showModified);
  const [params, setParams] = useSearchParams();
  const selectedFolder = params.get('folder') ?? '';
  const [inventory, setInventory] = useState<StatementInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // URL state survives source drill-downs and browser Back without storing config.
  const updateFilter = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key !== 'filePage') next.delete('filePage');
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const query = params.get('fileSearch') ?? '';
  const search = useDeferredValue(query.trim().toLowerCase());
  const rawStatus = params.get('fileStatus') ?? 'all';
  const status = Object.hasOwn(labels, rawStatus) ? rawStatus : 'all';
  const rawSort = params.get('fileSort') ?? 'name';
  const sort = ['name', 'modified', 'size'].includes(rawSort) ? rawSort : 'name';
  const requestedPage = Number(params.get('filePage') ?? 0);
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
  const setPage = (value: number) => updateFilter('filePage', value ? String(value) : '');
  // Explicit choices override automatic expansion of the selected folder's ancestors.
  const [expanded, setExpanded] = useState<Map<string, boolean>>(new Map());
  const [showFolderTree, setShowFolderTree] = useState(false);
  const [details, setDetails] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getStatementInventory()
      .then((value) => {
        if (!cancelled) setInventory(value);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  const entries = useMemo(() => inventory?.entries ?? [], [inventory]);
  const totalFiles = entries.filter(
    (entry) =>
      entry.kind === 'file' && entry.status !== 'configuration' && entry.status !== 'symlink',
  ).length;
  const children = useMemo(() => {
    const map = new Map<string, StatementEntry[]>();
    for (const entry of entries)
      if (entry.kind === 'folder') {
        const key = parentPath(entry.path);
        const list = map.get(key) ?? [];
        list.push(entry);
        map.set(key, list);
      }
    return map;
  }, [entries]);
  const sources = useMemo(() => {
    const map = new Map<string, ReturnType<typeof sourceInventory>>();
    if (transactions)
      for (const source of sourceInventory(transactions)) {
        const key = source.source.portableAddress
          .replaceAll('\\', '/')
          .replace(/^\.\//, '')
          .replace(/^Statements\//i, '');
        const list = map.get(key) ?? [];
        list.push(source);
        map.set(key, list);
      }
    return map;
  }, [transactions]);
  const selectFolder = (folder: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('tab', 'files');
      next.delete('filePage');
      if (folder) next.set('folder', folder);
      else next.delete('folder');
      return next;
    });
    setDetails(null);
  };
  const filtered = useMemo(
    () =>
      entries
        .filter((entry) => {
          const inScope =
            search || status !== 'all'
              ? !selectedFolder || entry.path.startsWith(`${selectedFolder}/`)
              : parentPath(entry.path) === selectedFolder;
          return (
            inScope &&
            (!search || entry.path.toLowerCase().includes(search)) &&
            (status === 'all' || entry.status === status)
          );
        })
        .sort(
          (a, b) =>
            Number(b.kind === 'folder') - Number(a.kind === 'folder') ||
            (sort === 'size'
              ? (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0)
              : sort === 'modified'
                ? (b.modifiedAt ?? '').localeCompare(a.modifiedAt ?? '')
                : a.path.localeCompare(b.path)),
        ),
    [entries, selectedFolder, search, status, sort],
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const folderExists =
    !selectedFolder ||
    entries.some((entry) => entry.path === selectedFolder && entry.kind === 'folder');
  const renderFolders = (parent: string, depth = 0): React.ReactNode =>
    (children.get(parent) ?? []).map((folder) => {
      const hasChildren = !!children.get(folder.path)?.length;
      const isOpen = expanded.get(folder.path) ?? selectedFolder.startsWith(`${folder.path}/`);
      return (
        <li key={folder.path}>
          <div
            className={`flex items-center gap-1 rounded-md ${folder.path === selectedFolder ? 'bg-indigo-100 text-indigo-950' : 'text-slate-700'}`}
            style={{ paddingLeft: Math.min(depth, 5) * 12 }}
          >
            {hasChildren ? (
              <button
                className="grid h-8 w-7 shrink-0 place-items-center"
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${folder.path}`}
                aria-expanded={isOpen}
                onClick={() =>
                  setExpanded((current) => {
                    return new Map(current).set(folder.path, !isOpen);
                  })
                }
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-7 shrink-0" />
            )}
            <button
              aria-current={selectedFolder === folder.path ? 'location' : undefined}
              aria-label={`${folder.name} · ${folder.fileCount} files`}
              className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-xs hover:text-primary"
              title={`${folder.path} · ${folder.fileCount} files`}
              onClick={() => selectFolder(folder.path)}
            >
              <Folder className="h-4 w-4 shrink-0 text-amber-700" />
              <span className="truncate">{folder.name}</span>
              <span className="ml-auto pr-2 tabular-nums">{folder.fileCount}</span>
            </button>
          </div>
          {hasChildren && isOpen && <ul>{renderFolders(folder.path, depth + 1)}</ul>}
        </li>
      );
    });
  return (
    <section className="space-y-4" aria-label="Statement explorer">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Statement explorer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse stored files and see which statements your account settings include.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError(false);
            setRefresh((value) => value + 1);
          }}
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh files
        </Button>
      </div>
      {error && (
        <Notice tone="error" title="Statement files could not be loaded">
          Check that the server can read the Statements folder, then refresh. If you just updated
          the app, restart the server first.
        </Notice>
      )}
      {inventory?.truncated && (
        <Notice tone="warning" title="This inventory is incomplete">
          The folder contains more entries or nesting than this view can list. Counts cover only the
          listed files.
        </Notice>
      )}
      {!!inventory?.unreadableFolders && (
        <Notice tone="warning" title="Some folders cannot be read">
          {inventory?.unreadableFolders} folders could not be read. File counts are incomplete;
          check their permissions on the server.
        </Notice>
      )}
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Reading statement folders…
        </p>
      )}
      {inventory && !error && (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav
            aria-label="Statement folders"
            className="rounded-xl border border-border bg-background p-3"
          >
            <button
              aria-label={`Statements · ${totalFiles} files`}
              className="mb-2 flex w-full items-center gap-2 rounded-md bg-primary px-3 py-2 text-left text-sm font-semibold text-primary-foreground"
              onClick={() => selectFolder('')}
            >
              <FolderOpen className="h-4 w-4" />
              Statements<span className="ml-auto tabular-nums">{totalFiles}</span>
            </button>
            <Button
              className="w-full justify-between lg:hidden"
              variant="ghost"
              size="sm"
              aria-controls="statement-folder-tree"
              aria-expanded={showFolderTree}
              onClick={() => setShowFolderTree((value) => !value)}
            >
              {showFolderTree ? 'Hide folders' : 'Show folders'}
              <ChevronDown className={`h-4 w-4 ${showFolderTree ? 'rotate-180' : ''}`} />
            </Button>
            <ul
              id="statement-folder-tree"
              className={`max-h-56 overflow-y-auto lg:max-h-[65vh] ${showFolderTree ? '' : 'hidden lg:block'}`}
            >
              {renderFolders('')}
            </ul>
            <p className="mt-3 hidden text-xs leading-5 text-muted-foreground lg:block">
              Counts include statement files in subfolders; settings files and links are excluded.
            </p>
          </nav>
          <div className="min-w-0 space-y-3">
            <nav
              aria-label="Current statement folder"
              className="flex flex-wrap items-center gap-1 text-sm"
            >
              <button
                className="font-medium text-primary underline"
                onClick={() => selectFolder('')}
              >
                Statements
              </button>
              {selectedFolder
                .split('/')
                .filter(Boolean)
                .map((part, index, parts) => (
                  <React.Fragment key={index}>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <button
                      className="max-w-full break-all text-primary underline"
                      onClick={() => selectFolder(parts.slice(0, index + 1).join('/'))}
                    >
                      {part}
                    </button>
                  </React.Fragment>
                ))}
            </nav>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px_170px]">
              <label className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <span className="sr-only">Search stored files</span>
                <Input
                  className="pl-9"
                  value={query}
                  placeholder="Search this folder and subfolders…"
                  onChange={(event) => {
                    updateFilter('fileSearch', event.target.value);
                  }}
                />
              </label>
              <Select
                aria-label="File status"
                value={status}
                onChange={(event) => {
                  updateFilter('fileStatus', event.target.value);
                }}
                options={[
                  { value: 'all', label: 'All file statuses' },
                  ...Object.entries(labels).map(([value, label]) => ({ value, label })),
                ]}
              />
              <Select
                aria-label="Sort stored files"
                value={sort}
                onChange={(event) => {
                  updateFilter('fileSort', event.target.value);
                }}
                options={[
                  { value: 'name', label: 'Name A–Z' },
                  { value: 'modified', label: 'Recently modified' },
                  { value: 'size', label: 'Largest files' },
                ]}
              />
            </div>
            {!folderExists && (
              <Notice tone="warning" title="This folder is no longer available">
                It may have been renamed or removed. Choose another folder from Statements.
              </Notice>
            )}
            <div className="overflow-x-auto rounded-xl border border-border bg-background">
              <table className="data-table table-fixed" aria-label="Stored statement files">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="w-32 sm:w-40">Status / files</th>
                    <th className="hidden w-24 text-right sm:table-cell">Size</th>
                    <th className="hidden w-32 lg:table-cell">Modified</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                    .map((entry) => {
                      const represented = sources.get(entry.path) ?? [];
                      const isFolder = entry.kind === 'folder';
                      return (
                        <React.Fragment key={entry.path}>
                          <tr className="data-row">
                            <td>
                              <button
                                className="flex w-full items-start gap-2 text-left font-medium text-primary"
                                aria-expanded={isFolder ? undefined : details === entry.path}
                                onClick={() =>
                                  isFolder
                                    ? selectFolder(entry.path)
                                    : setDetails(details === entry.path ? null : entry.path)
                                }
                              >
                                {isFolder ? (
                                  <Folder className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                                ) : (
                                  <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                                )}
                                <span className="break-all">
                                  {search || status !== 'all' ? entry.path : entry.name}
                                </span>
                              </button>
                              {represented.length > 0 && (
                                <p className="mt-1 pl-6 text-xs text-muted-foreground">
                                  {represented.reduce((count, item) => count + item.recordCount, 0)}{' '}
                                  transaction records
                                </p>
                              )}
                            </td>
                            <td>
                              <Badge
                                variant={
                                  entry.status === 'eligible'
                                    ? 'success'
                                    : ['unconfigured', 'unsupported', 'unreadable'].includes(
                                          entry.status,
                                        )
                                      ? 'warning'
                                      : 'secondary'
                                }
                              >
                                {isFolder && entry.status === 'eligible'
                                  ? `${entry.fileCount} files`
                                  : labels[entry.status]}
                              </Badge>
                              {isFolder && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {entry.eligibleCount} eligible
                                </p>
                              )}
                            </td>
                            <td className="hidden text-right tabular-nums sm:table-cell">
                              {fileSize(entry.sizeBytes)}
                            </td>
                            <td className="hidden text-xs text-muted-foreground lg:table-cell">
                              {entry.modifiedAt?.slice(0, 10) ?? '—'}
                            </td>
                          </tr>
                          {details === entry.path && (
                            <tr>
                              <td colSpan={columnCount} className="!bg-info !p-4">
                                <p className="text-sm text-info-foreground">{entry.reason}</p>
                                <p className="mt-2 break-all text-xs text-muted-foreground">
                                  {entry.path} · {fileSize(entry.sizeBytes)}
                                  {entry.modifiedAt
                                    ? ` · Modified ${entry.modifiedAt} (filesystem date)`
                                    : ''}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {represented.map((item) => (
                                    <Link
                                      key={item.source.id}
                                      className={buttonClassName({
                                        variant: 'outline',
                                        size: 'sm',
                                      })}
                                      to={transactionsHref({
                                        source: item.source.id,
                                        basis: 'records',
                                        view: 'list',
                                      })}
                                    >
                                      View {item.recordCount} transactions
                                    </Link>
                                  ))}
                                  {represented.length === 0 && entry.status !== 'configuration' && (
                                    <p className="text-xs text-muted-foreground">
                                      {transactions
                                        ? 'No transactions in the current history reference this path. Eligibility alone does not mean the file has been imported.'
                                        : 'Transaction history is not available to check this file’s source references. Eligibility alone does not mean the file has been imported.'}
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={columnCount} className="!p-8 text-center text-muted-foreground">
                        {search || status !== 'all'
                          ? 'No files match these filters.'
                          : 'This folder is empty.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              noun="files and folders"
              onChange={setPage}
            />
            <p className="flex items-center text-xs text-muted-foreground">
              Eligible means included by account settings; rebuild checks file contents.
              <HelpHint title="File status and transaction evidence">
                <p>
                  This explorer reads the current Statements directory. Modified dates are
                  filesystem dates, not import dates. Files can be eligible but not yet parsed,
                  empty or deduplicated. Transaction links use only source paths retained in the
                  current history.
                </p>
              </HelpHint>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
