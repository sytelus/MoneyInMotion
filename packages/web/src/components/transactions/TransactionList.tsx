/**
 * Main transaction list component using @tanstack/react-table for column
 * definitions and a virtualized display for performance.
 *
 * Transactions are grouped by the NetAggregator (Income/Expenses/Transfers)
 * and rendered with expandable group headers.
 *
 * @module
 */

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { NetAggregator, TransactionAggregator, type Transaction } from '@moneyinmotion/core';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { TransactionRow } from './TransactionRow.js';
import { TransactionGroup } from './TransactionGroup.js';

// ---------------------------------------------------------------------------
// Types for the flattened row model
// ---------------------------------------------------------------------------

interface GroupRow {
  type: 'group';
  aggregator: TransactionAggregator;
}

interface TransactionRowData {
  type: 'transaction';
  transaction: Transaction;
  depth: number;
}

type FlatRow = GroupRow | TransactionRowData;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TransactionListProps {
  /** Callback to open the category editor for a transaction. */
  onEditCategory?: (transaction: Transaction) => void;
  /** Callback to open the note editor for a transaction. */
  onEditNote?: (transaction: Transaction) => void;
  /** Callback to open the attribute editor for a transaction. */
  onEditAttributes?: (transaction: Transaction) => void;
  /** Callback to toggle the flag on a transaction. */
  onToggleFlag?: (transaction: Transaction) => void;
  /** Callback to remove the flag from a transaction. */
  onRemoveFlag?: (transaction: Transaction) => void;
}

// ---------------------------------------------------------------------------
// Flatten aggregator tree into a display list
// ---------------------------------------------------------------------------

function flattenAggregator(
  agg: TransactionAggregator,
  expandedGroupIds: Set<string>,
  rows: FlatRow[],
): void {
  // Add the group header
  rows.push({ type: 'group', aggregator: agg });

  const isExpanded = expandedGroupIds.has(agg.groupId);
  if (!isExpanded) return;

  // Add sub-aggregators
  const subs = agg.getSubAggregators();
  for (const sub of subs) {
    if (sub.isOptional) {
      // Optional aggregators are transparent -- show their contents directly
      const innerSubs = sub.getSubAggregators();
      for (const innerSub of innerSubs) {
        flattenAggregator(innerSub, expandedGroupIds, rows);
      }
      // Also show direct transactions from optional aggregators
      for (const tx of sub.getTransactions()) {
        rows.push({ type: 'transaction', transaction: tx, depth: agg.depth + 1 });
      }
    } else {
      flattenAggregator(sub, expandedGroupIds, rows);
    }
  }

  // Add leaf transactions
  for (const tx of agg.getTransactions()) {
    rows.push({ type: 'transaction', transaction: tx, depth: agg.depth + 1 });
  }
}

// ---------------------------------------------------------------------------
// Column definitions (for @tanstack/react-table metadata)
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<Transaction>();

const columns: ColumnDef<Transaction, unknown>[] = [
  columnHelper.accessor('displayEntityNameNormalized', {
    header: 'Entity Name',
    cell: (info) => info.getValue(),
  }) as ColumnDef<Transaction, unknown>,
  columnHelper.accessor('amount', {
    header: 'Amount',
    cell: (info) => info.getValue(),
  }) as ColumnDef<Transaction, unknown>,
  columnHelper.accessor('transactionReason', {
    header: 'Type',
    cell: (info) => info.getValue(),
  }) as ColumnDef<Transaction, unknown>,
  columnHelper.accessor('correctedTransactionDate', {
    header: 'Date',
    cell: (info) => info.getValue(),
  }) as ColumnDef<Transaction, unknown>,
  columnHelper.accessor('accountId', {
    header: 'Account',
    cell: (info) => info.getValue(),
  }) as ColumnDef<Transaction, unknown>,
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The main transaction list. Groups transactions using `NetAggregator` and
 * renders them as an expandable, keyboard-navigable list with virtual
 * scrolling behavior.
 */
export const TransactionList: React.FC<TransactionListProps> = ({
  onEditCategory,
  onEditNote,
  onEditAttributes,
  onToggleFlag,
  onRemoveFlag,
}) => {
  const filteredTxns = useTransactionsStore((s) => s.getFilteredTransactions());
  const selectedIds = useTransactionsStore((s) => s.selectedTransactionIds);
  const expandedGroupIds = useTransactionsStore((s) => s.expandedGroupIds);
  const selectTransaction = useTransactionsStore((s) => s.selectTransaction);
  const toggleGroupExpand = useTransactionsStore((s) => s.toggleGroupExpand);

  const containerRef = useRef<HTMLDivElement>(null);
  const hasAutoExpanded = useRef(false);

  // Build the aggregator and flatten into rows
  const flatRows = useMemo(() => {
    if (filteredTxns.length === 0) return [];

    const netAgg = new NetAggregator(filteredTxns);
    const rows: FlatRow[] = [];

    // Get top-level groups (Income, Expenses, Transfers, Unmatched)
    const topSubs = netAgg.aggregator.getSubAggregatorsBySortOrder();
    for (const sub of topSubs) {
      flattenAggregator(sub, expandedGroupIds, rows);
    }

    return rows;
  }, [filteredTxns, expandedGroupIds]);

  // Set up the react-table instance (used mainly for column metadata)
  const txData = useMemo(
    () =>
      flatRows
        .filter((r): r is TransactionRowData => r.type === 'transaction')
        .map((r) => r.transaction),
    [flatRows],
  );

  const table = useReactTable({
    data: txData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

      e.preventDefault();
      const txRows = flatRows.filter(
        (r): r is TransactionRowData => r.type === 'transaction',
      );
      if (txRows.length === 0) return;

      const currentId = [...selectedIds][0];
      const currentIndex = txRows.findIndex(
        (r) => r.transaction.id === currentId,
      );

      let nextIndex: number;
      if (e.key === 'ArrowDown') {
        nextIndex = currentIndex < txRows.length - 1 ? currentIndex + 1 : currentIndex;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      }

      const nextTx = txRows[nextIndex];
      if (nextTx) {
        selectTransaction(nextTx.transaction.id);
      }
    },
    [flatRows, selectedIds, selectTransaction],
  );

  // Auto-expand top-level groups on first load
  useEffect(() => {
    if (filteredTxns.length > 0 && expandedGroupIds.size === 0 && !hasAutoExpanded.current) {
      hasAutoExpanded.current = true;
      const netAgg = new NetAggregator(filteredTxns);
      const topSubs = netAgg.aggregator.getSubAggregatorsBySortOrder();
      for (const sub of topSubs) {
        toggleGroupExpand(sub.groupId);
      }
    }
  }, [filteredTxns, expandedGroupIds.size, toggleGroupExpand]);

  if (filteredTxns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No transactions to display. Select a year and month from the sidebar.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="grid"
      aria-label="Transaction list"
    >
      {/* Column headers */}
      <div className="sticky top-0 z-10 bg-background border-b-2 border-border">
        {table.getHeaderGroups().map((headerGroup) => (
          <div
            key={headerGroup.id}
            className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            {headerGroup.headers.map((header) => (
              <div key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </div>
            ))}
            {/* Extra column for context menu button */}
            <div />
          </div>
        ))}
      </div>

      {/* Rows */}
      <div role="rowgroup">
        {flatRows.map((row) => {
          if (row.type === 'group') {
            return (
              <TransactionGroup
                key={`group-${row.aggregator.groupId}`}
                aggregator={row.aggregator}
                isExpanded={expandedGroupIds.has(row.aggregator.groupId)}
                onToggle={toggleGroupExpand}
              />
            );
          }

          return (
            <TransactionRow
              key={`tx-${row.transaction.id}`}
              transaction={row.transaction}
              isSelected={selectedIds.has(row.transaction.id)}
              depth={row.depth}
              onClick={selectTransaction}
              onEditCategory={onEditCategory}
              onEditNote={onEditNote}
              onEditAttributes={onEditAttributes}
              onToggleFlag={onToggleFlag}
              onRemoveFlag={onRemoveFlag}
            />
          );
        })}
      </div>
    </div>
  );
};

TransactionList.displayName = 'TransactionList';
