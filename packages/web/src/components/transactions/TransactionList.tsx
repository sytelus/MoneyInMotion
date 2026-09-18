import React, { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  LayoutList,
  Layers,
  X,
} from 'lucide-react';
import type { Transaction } from '@moneyinmotion/core';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { explorerGroups, flattenExplorer } from '../../lib/transaction-explorer.js';
import { formatCurrency, formatDate, getMonthName } from '../../lib/utils.js';
import { TransactionRow } from './TransactionRow.js';
import { TransactionFilters } from './TransactionFilters.js';
import { Button } from '../ui/button.js';
import { Select } from '../ui/select.js';
import { HelpHint } from '../ui/help-hint.js';
import { Pagination } from '../ui/pagination.js';
import { TransactionEditWorkflow } from '../editing/TransactionEditWorkflow.js';
import { TransactionExport } from './TransactionExport.js';

export interface TransactionListProps {
  onEditCategory?: (transaction: Transaction) => void;
  onEditNote?: (transaction: Transaction) => void;
  onEditAttributes?: (transaction: Transaction) => void;
  onToggleFlag?: (transaction: Transaction) => void;
  onRemoveFlag?: (transaction: Transaction) => void;
}
const PAGE_SIZE = 100;
const visuals = {
  Income: {
    Icon: ArrowDownLeft,
    color: 'text-emerald-700',
    background: 'bg-emerald-50 border-emerald-200',
  },
  Expenses: {
    Icon: ArrowUpRight,
    color: 'text-rose-700',
    background: 'bg-rose-50 border-rose-200',
  },
  Transfers: {
    Icon: ArrowLeftRight,
    color: 'text-sky-700',
    background: 'bg-sky-50 border-sky-200',
  },
  Unmatched: {
    Icon: AlertTriangle,
    color: 'text-amber-800',
    background: 'bg-amber-50 border-amber-200',
  },
};

export const TransactionList: React.FC<TransactionListProps> = (props) => {
  const filtered = useTransactionsStore(useShallow((s) => s.getFilteredTransactions()));
  const {
    transactions,
    reporting,
    records,
    dateIndex,
    basis,
    view,
    scopedIds,
    selectedYear,
    selectedMonth,
    filters,
    expandedGroupIds,
    toggleGroupExpand,
    selectedTransactionIds,
    selectTransaction,
    selectTransactions,
    clearSelection,
  } = useTransactionsStore();
  const mode = basis === 'records' ? 'list' : view;
  const setMode = (view: 'summary' | 'list') => useTransactionsStore.setState({ view });
  const [sort, setSort] = useState('newest');
  const [paging, setPaging] = useState({ key: '', page: 0 });
  const resultsRef = useRef<HTMLDivElement>(null);
  const [bulk, setBulk] = useState(false);
  const [success, setSuccess] = useState('');
  const groups = useMemo(
    () => (basis === 'reporting' ? explorerGroups(filtered) : []),
    [filtered, basis],
  );
  const ordered = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const compared =
          sort === 'oldest'
            ? dateIndex.get(a.id)!.localeCompare(dateIndex.get(b.id)!)
            : sort === 'amountAsc'
              ? a.correctedAmount - b.correctedAmount
              : sort === 'amountDesc'
                ? b.correctedAmount - a.correctedAmount
                : sort === 'name'
                  ? a.displayEntityNameNormalized.localeCompare(b.displayEntityNameNormalized)
                  : dateIndex.get(b.id)!.localeCompare(dateIndex.get(a.id)!);
        return compared || a.id.localeCompare(b.id);
      }),
    [filtered, sort, dateIndex],
  );
  const rows = useMemo(
    () =>
      mode === 'summary'
        ? flattenExplorer(groups, expandedGroupIds)
        : ordered.map((transaction) => ({ transaction, depth: 0 })),
    [mode, groups, expandedGroupIds, ordered],
  );
  const pageKey = JSON.stringify([
    selectedYear,
    selectedMonth,
    filters,
    mode,
    sort,
    basis,
    scopedIds ? [...scopedIds] : null,
  ]);
  const page = Math.min(
    paging.key === pageKey ? paging.page : 0,
    Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1),
  );
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const bounds = useMemo(
    () =>
      (basis === 'records' ? records : reporting).reduce(
        (result, tx) =>
          [
            !result[0] || dateIndex.get(tx.id)! < result[0] ? dateIndex.get(tx.id)! : result[0],
            dateIndex.get(tx.id)! > result[1]! ? dateIndex.get(tx.id)! : result[1]!,
          ] as [string, string],
        ['', ''] as [string, string],
      ),
    [reporting, records, basis, dateIndex],
  );
  const period = selectedYear
    ? selectedMonth
      ? `${getMonthName(Number(selectedMonth))} ${selectedYear}`
      : `Year ${selectedYear}`
    : filters.from || filters.to
      ? `${filters.from || bounds[0]?.slice(0, 10) || 'Start'} – ${filters.to || bounds[1]?.slice(0, 10) || 'End'}`
      : `All dates · ${bounds[0] ? formatDate(bounds[0]) : 'No data'} – ${bounds[1] ? formatDate(bounds[1]) : 'No data'}`;
  const net = groups
    .filter((g) => g.label === 'Income' || g.label === 'Expenses')
    .reduce((sum, group) => sum + group.sum, 0);
  const navigateRows = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (!(event.target instanceof HTMLElement) || event.target.matches('input,select,textarea'))
      return;
    const targets = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-explorer-focus]')];
    const current = targets.findIndex((target) => target === event.target);
    if (current < 0) return;
    const next =
      targets[
        Math.min(targets.length - 1, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)))
      ];
    event.preventDefault();
    next?.focus();
    if (next?.dataset['transactionId']) selectTransaction(next.dataset['transactionId']);
  };
  return (
    <div className="transaction-explorer h-full overflow-y-auto p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm font-semibold text-sky-800" data-testid="reporting-period">
            {period} <span className="font-normal text-muted-foreground">· UTC</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtered.length.toLocaleString()}{' '}
            {basis === 'records'
              ? 'source records · Inspection view (not additive)'
              : `reporting items · Net recorded activity ${formatCurrency(net)}`}
            {Object.values(filters).some(Boolean) ? ' · Filtered results' : ''}
          </p>
        </div>
        <HelpHint title="Reporting totals">
          <p>
            Income includes discounts, refunds, and other incoming amounts—not just salary. Expand a
            group to see transaction types, categories, and merchants.
          </p>
          <p>
            Completed order details replace their parent payment in totals to avoid double counting.
            Incomplete orders use the parent amount instead. Unmatched records and account transfers
            are separate from net recorded activity. Every figure follows the displayed date range
            and filters.
          </p>
        </HelpHint>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-medium">
          View basis
          <Select
            className="w-auto max-w-full"
            value={basis}
            options={[
              { value: 'reporting', label: 'Reporting items · non-duplicated totals' },
              { value: 'records', label: 'Source records · investigate & correct' },
            ]}
            onChange={(e) =>
              useTransactionsStore.setState({
                basis: e.target.value as 'reporting' | 'records',
                view: e.target.value === 'records' ? 'list' : view,
                selectedTransactionIds: new Set(),
              })
            }
          />
        </label>
        <span className="text-xs text-muted-foreground">
          Select a row for source details and applied rules
        </span>
      </div>
      {basis === 'records' && (
        <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          Source records include payments and their order details. Amounts are shown for inspection,
          not added together. Switch to Reporting items for non-duplicated totals.
        </p>
      )}
      {scopedIds && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <span>
            Showing {scopedIds.size.toLocaleString()} linked record{scopedIds.size === 1 ? '' : 's'}
            {filtered.length < scopedIds.size
              ? ' · Some records are unavailable or excluded by filters.'
              : ''}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              useTransactionsStore.setState({ scopedIds: null, selectedTransactionIds: new Set() })
            }
          >
            Show other records
          </Button>
        </div>
      )}
      <TransactionFilters />
      {success && (
        <p role="status" className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {success}
        </p>
      )}
      {basis === 'reporting' && (
        <section aria-label="Period summary" className="my-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
          {Object.entries(visuals).map(([label, { Icon, color, background }]) => {
            const group = groups.find((g) => g.label === label);
            return (
              <button
                key={label}
                type="button"
                aria-label={`Explore ${label}`}
                disabled={!group}
                className={`rounded-lg border p-3 text-left transition-shadow hover:shadow-sm disabled:opacity-60 ${background}`}
                onClick={() => {
                  setMode('summary');
                  if (group && !expandedGroupIds.has(group.id)) toggleGroupExpand(group.id);
                }}
              >
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${color}`}>
                  <Icon className="h-4 w-4" />
                  {label === 'Income'
                    ? 'Incoming amounts'
                    : label === 'Expenses'
                      ? 'Outgoing amounts'
                      : label}
                </span>
                <span className="mt-2 block text-lg font-semibold tabular-nums">
                  {formatCurrency(group?.sum ?? 0)}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {group?.count.toLocaleString() ?? 0} items
                </span>
              </button>
            );
          })}
        </section>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-md border border-border p-1">
          <Button
            size="sm"
            variant={mode === 'summary' ? 'secondary' : 'ghost'}
            aria-pressed={mode === 'summary'}
            disabled={basis === 'records'}
            onClick={() => setMode('summary')}
          >
            <Layers className="mr-1 h-4 w-4" />
            Summary
          </Button>
          <Button
            size="sm"
            variant={mode === 'list' ? 'secondary' : 'ghost'}
            aria-pressed={mode === 'list'}
            onClick={() => setMode('list')}
          >
            <LayoutList className="mr-1 h-4 w-4" />
            All matching items
          </Button>
        </div>
        {transactions && (
          <TransactionExport
            results={ordered}
            selected={selectedTransactionIds}
            collection={transactions}
            basis={basis}
            period={period}
          />
        )}
      </div>
      {mode === 'list' ? (
        <label className="mb-3 flex items-center gap-2 text-sm">
          Sort transactions
          <Select
            className="max-w-52"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={[
              { value: 'newest', label: 'Date: newest first' },
              { value: 'oldest', label: 'Date: oldest first' },
              { value: 'amountAsc', label: 'Amount: low to high' },
              { value: 'amountDesc', label: 'Amount: high to low' },
              { value: 'name', label: 'Merchant: A–Z' },
            ]}
          />
        </label>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>Expand type → category → merchant. Groups are ordered by absolute amount.</p>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => useTransactionsStore.setState({ expandedGroupIds: new Set() })}
          >
            Collapse all
          </Button>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Button
          variant="outline"
          size="sm"
          disabled={!visible.some((r) => 'transaction' in r)}
          onClick={() =>
            selectTransactions(
              visible.flatMap((r) => ('transaction' in r ? [r.transaction.id] : [])),
            )
          }
        >
          Select visible items
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!filtered.length || filtered.length > 1000}
          aria-describedby={filtered.length > 1000 ? 'bulk-selection-limit' : undefined}
          title="Bulk edits support up to 1,000 items. Narrow filters for larger results."
          onClick={() => selectTransactions(filtered.map((t) => t.id))}
        >
          Select all {filtered.length.toLocaleString()} matches
        </Button>
        {filtered.length > 1000 && (
          <p id="bulk-selection-limit" className="basis-full text-xs text-muted-foreground">
            {mode === 'summary'
              ? 'Use All matching items to select a page'
              : 'Select visible items'}
            , or narrow results to 1,000 items or fewer for bulk editing.
          </p>
        )}
        {selectedTransactionIds.size > 0 && (
          <>
            <span>{selectedTransactionIds.size} selected</span>
            <Button
              size="sm"
              disabled={selectedTransactionIds.size > 1000}
              onClick={() => setBulk(true)}
            >
              Edit selected items
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear selection"
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No transactions to display for this period and filters.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose All dates or clear filters to broaden the results.
          </p>
        </div>
      ) : (
        <div
          role="grid"
          ref={resultsRef}
          tabIndex={-1}
          aria-label="Transaction list"
          onKeyDown={navigateRows}
          className="overflow-hidden rounded-lg border border-border"
        >
          <div role="rowgroup">
            <div
              role="row"
              className="transaction-grid-row border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground"
            >
              <span role="columnheader">
                {mode === 'summary' ? 'Group / transaction' : 'Transaction'}
              </span>
              <span role="columnheader" className="text-right">
                Amount
              </span>
              <span role="columnheader" className="transaction-wide-cell">
                Type
              </span>
              <span role="columnheader" className="transaction-date-cell">
                Date
              </span>
              <span role="columnheader" className="transaction-wide-cell">
                Account
              </span>
              <span role="columnheader"><span className="sr-only">Actions</span></span>
            </div>
          </div>
          <div role="rowgroup">
            {visible.map((row) =>
              'group' in row ? (
                <div key={row.group.id} role="row" className="border-b border-border last:border-0">
                  <div role="gridcell" aria-colspan={6}>
                    <button
                      type="button"
                      data-explorer-focus="true"
                      aria-expanded={expandedGroupIds.has(row.group.id)}
                      className={`transaction-grid-row w-full items-center py-3 pr-3 text-left hover:bg-accent/60 ${row.group.depth === 0 ? 'bg-muted/40 font-semibold' : ''}`}
                      style={{ paddingLeft: `${Math.min(row.group.depth, 3) * 0.7 + 0.75}rem` }}
                      onClick={() => toggleGroupExpand(row.group.id)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {expandedGroupIds.has(row.group.id) ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 break-words text-sm">
                          {row.group.label}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                          {row.group.count.toLocaleString()}
                        </span>
                      </span>
                      <span className="text-right text-sm font-medium tabular-nums">
                        {formatCurrency(row.group.sum)}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <TransactionRow
                  key={row.transaction.id}
                  transaction={row.transaction}
                  depth={row.depth}
                  isSelected={selectedTransactionIds.has(row.transaction.id)}
                  onClick={selectTransaction}
                  {...props}
                />
              ),
            )}
          </div>
        </div>
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={rows.length}
        onChange={(page) => {
          setPaging({ key: pageKey, page });
          requestAnimationFrame(() => {
            resultsRef.current?.scrollIntoView?.({ block: 'start' });
            resultsRef.current?.focus({ preventScroll: true });
          });
        }}
        noun={mode === 'summary' ? 'visible rows' : 'transactions'}
      />
      {bulk && transactions && (
        <TransactionEditWorkflow
          open
          transactions={[...selectedTransactionIds].flatMap(
            (id) => transactions.getTransaction(id) ?? [],
          )}
          onOpenChange={setBulk}
          onSaved={(result) => {
            setBulk(false);
            clearSelection();
            setSuccess(
              `Saved changes to ${result.affectedTransactionsCount.toLocaleString()} transactions.`,
            );
          }}
        />
      )}
    </div>
  );
};
