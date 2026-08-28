/**
 * Main transaction list component.
 *
 * Transactions are grouped by the NetAggregator (Income/Expenses/Transfers)
 * and rendered with expandable group headers.
 *
 * @module
 */

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
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

const columnHeaders = ['Entity name', 'Amount', 'Type', 'Date', 'Account'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The main transaction list. Groups transactions using `NetAggregator` and
 * renders them as an expandable, keyboard-navigable list.
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
  const transactions = useTransactionsStore((s) => s.transactions);
  const selectedYear = useTransactionsStore((s) => s.selectedYear);
  const selectedMonth = useTransactionsStore((s) => s.selectedMonth);
  const selectTransaction = useTransactionsStore((s) => s.selectTransaction);
  const toggleGroupExpand = useTransactionsStore((s) => s.toggleGroupExpand);

  const hasAutoExpanded = useRef(false);

  // A new snapshot or period has different group identities. Allow its
  // top-level groups to receive the same initial expansion as the first view.
  useEffect(() => {
    hasAutoExpanded.current = false;
  }, [transactions, selectedYear, selectedMonth]);

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

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

      e.preventDefault();
      const txRows = flatRows.filter((r): r is TransactionRowData => r.type === 'transaction');
      if (txRows.length === 0) return;

      const currentId = [...selectedIds][0];
      const currentIndex = txRows.findIndex((r) => r.transaction.id === currentId);

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
      className="h-full overflow-y-auto focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="grid"
      aria-label="Transaction list"
    >
      {/* Column headers */}
      <div className="sticky top-0 z-10 bg-background border-b-2 border-border">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]">
          {columnHeaders.map((header, index) => (
            <div
              key={header}
              className={
                index === 2 || index === 4
                  ? 'hidden xl:block'
                  : index === 3
                    ? 'hidden sm:block'
                    : undefined
              }
            >
              {header}
            </div>
          ))}
          <div aria-hidden="true" />
        </div>
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
