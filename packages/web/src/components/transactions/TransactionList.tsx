import React, { useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Download,
  LayoutList,
  Layers,
  X,
} from 'lucide-react';
import { createScopeFilter, ScopeType, type Transaction } from '@moneyinmotion/core';
import { useTransactionsStore } from '../../store/transactions-store.js';
import {
  explorerGroups,
  flattenExplorer,
  transactionsCsv,
} from '../../lib/transaction-explorer.js';
import { formatCurrency, formatDate, getMonthName } from '../../lib/utils.js';
import { TransactionRow } from './TransactionRow.js';
import { TransactionFilters } from './TransactionFilters.js';
import { Button } from '../ui/button.js';
import { Select } from '../ui/select.js';
import { HelpHint } from '../ui/help-hint.js';
import { Pagination } from '../ui/pagination.js';
import { RuleEditor } from '../editing/RuleEditor.js';
import { RuleChangePreview } from '../editing/RuleChangePreview.js';
import type { RuleChange } from '../../api/client.js';

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
  const [view, setView] = useState<{ mode: 'summary' | 'list'; search: string }>({
    mode: 'summary',
    search: '',
  });
  const mode =
    view.search === filters.search ? view.mode : filters.search.trim() ? 'list' : 'summary';
  const setMode = (mode: 'summary' | 'list') => setView({ mode, search: filters.search });
  const [sort, setSort] = useState('newest');
  const [paging, setPaging] = useState({ key: '', page: 0 });
  const resultsRef = useRef<HTMLDivElement>(null);
  const [bulk, setBulk] = useState(false);
  const [changes, setChanges] = useState<RuleChange[] | null>(null);
  const [success, setSuccess] = useState('');
  const groups = useMemo(() => explorerGroups(filtered), [filtered]);
  const ordered = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const compared =
          sort === 'oldest'
            ? a.correctedTransactionDate.localeCompare(b.correctedTransactionDate)
            : sort === 'amountAsc'
              ? a.correctedAmount - b.correctedAmount
              : sort === 'amountDesc'
                ? b.correctedAmount - a.correctedAmount
                : sort === 'name'
                  ? a.displayEntityNameNormalized.localeCompare(b.displayEntityNameNormalized)
                  : b.correctedTransactionDate.localeCompare(a.correctedTransactionDate);
        return compared || a.id.localeCompare(b.id);
      }),
    [filtered, sort],
  );
  const rows = useMemo(
    () =>
      mode === 'summary'
        ? flattenExplorer(groups, expandedGroupIds)
        : ordered.map((transaction) => ({ transaction, depth: 0 })),
    [mode, groups, expandedGroupIds, ordered],
  );
  const pageKey = JSON.stringify([selectedYear, selectedMonth, filters, mode, sort]);
  const page = Math.min(
    paging.key === pageKey ? paging.page : 0,
    Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1),
  );
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const bounds = useMemo(
    () =>
      reporting.reduce(
        (result, tx) =>
          [
            !result[0] || tx.correctedTransactionDate < result[0]
              ? tx.correctedTransactionDate
              : result[0],
            tx.correctedTransactionDate > result[1]! ? tx.correctedTransactionDate : result[1]!,
          ] as [string, string],
        ['', ''] as [string, string],
      ),
    [reporting],
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
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([transactionsCsv(ordered)], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'moneyinmotion-filtered-transactions.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
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
          <h1 className="text-xl font-bold">Transaction overview</h1>
          <p className="mt-1 text-sm font-semibold text-sky-800" data-testid="reporting-period">
            {period} <span className="font-normal text-muted-foreground">· UTC</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtered.length.toLocaleString()} reporting items · Net income {formatCurrency(net)}
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
            are separate from net income. Every figure follows the displayed date range and filters.
          </p>
        </HelpHint>
      </div>
      <TransactionFilters />
      {success && (
        <p role="status" className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          {success}
        </p>
      )}
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
                {label}
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-md border border-border p-1">
          <Button
            size="sm"
            variant={mode === 'summary' ? 'secondary' : 'ghost'}
            aria-pressed={mode === 'summary'}
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
        <Button variant="outline" size="sm" disabled={!filtered.length} onClick={download}>
          <Download className="mr-1 h-4 w-4" />
          Export results
        </Button>
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
              <span role="columnheader" aria-label="Actions" />
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
        <RuleEditor
          rules={[]}
          initialScopes={[createScopeFilter(ScopeType.TransactionId, [...selectedTransactionIds])]}
          transactions={transactions}
          onClose={() => setBulk(false)}
          onReview={(next) => {
            setBulk(false);
            setChanges(next);
          }}
        />
      )}
      {changes && (
        <RuleChangePreview
          changes={changes}
          onClose={() => setChanges(null)}
          onSaved={(result) => {
            setChanges(null);
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
