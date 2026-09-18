/**
 * A single row in the transaction list, displaying one transaction's details.
 *
 * Includes a context menu button ("...") for quick access to editing actions.
 *
 * @module
 */

import React from 'react';
import { Flag, StickyNote } from 'lucide-react';
import type { Transaction } from '@moneyinmotion/core';
import { transactionReasonTitleLookup } from '@moneyinmotion/core';
import { cn, formatDate } from '../../lib/utils.js';
import { AmountDisplay } from './AmountDisplay.js';
import { TransactionContextMenuButton } from '../editing/TransactionContextMenu.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { transactionCategory } from '../../lib/transaction-explorer.js';

export interface TransactionRowProps {
  /** The transaction to render. */
  transaction: Transaction;
  /** Whether this row is currently selected. */
  isSelected: boolean;
  /** Indentation depth (for child transactions). */
  depth?: number;
  /** Callback when the row is clicked. */
  onClick?: (id: string) => void;
  /** Callback to open the category editor for this transaction. */
  onEditCategory?: (transaction: Transaction) => void;
  /** Callback to open the note editor for this transaction. */
  onEditNote?: (transaction: Transaction) => void;
  /** Callback to open the attribute editor for this transaction. */
  onEditAttributes?: (transaction: Transaction) => void;
  /** Callback to toggle the flag on this transaction. */
  onToggleFlag?: (transaction: Transaction) => void;
  /** Callback to remove the flag from this transaction. */
  onRemoveFlag?: (transaction: Transaction) => void;
}

/**
 * Render a single transaction as a table-style row with entity name, amount,
 * type badge, date, account ID, optional flag/note indicators, and a context
 * menu button for editing actions.
 */
export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  isSelected,
  depth = 0,
  onClick,
  onEditCategory,
  onEditNote,
  onEditAttributes,
  onToggleFlag,
  onRemoveFlag,
}) => {
  const toggleSelection = useTransactionsStore((s) => s.toggleTransactionSelection);
  const accountTitle = useTransactionsStore(
    (s) => s.transactions?.getAccountInfo(transaction.accountId).title || transaction.accountId,
  );
  const reasonTitle =
    transactionReasonTitleLookup[String(transaction.correctedTransactionReason)] ?? 'Unknown';
  const accountDisplay =
    transaction.accountId.length > 12
      ? transaction.accountId.slice(0, 12) + '...'
      : transaction.accountId;

  const hasEditActions = onEditCategory || onEditNote || onEditAttributes;

  return (
    <div
      role="row"
      data-explorer-focus="true"
      data-transaction-id={transaction.id}
      aria-selected={isSelected}
      tabIndex={0}
      className={cn(
        'transaction-grid-row items-center px-3 py-2 text-sm border-b border-border cursor-pointer hover:bg-accent/50 transition-colors group',
        isSelected && 'bg-accent',
      )}
      style={{ paddingLeft: `${Math.min(depth, 3) * 0.5 + 0.75}rem` }}
      onClick={() => onClick?.(transaction.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(transaction.id);
        }
      }}
    >
      {/* Entity name + indicators */}
      <div role="gridcell" className="flex items-center gap-2 min-w-0">
        <input
          type="checkbox"
          aria-label={`Select ${transaction.displayEntityNameNormalized}`}
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleSelection(transaction.id)}
          className="h-4 w-4 shrink-0 accent-primary"
        />
        <span className="min-w-0">
          <span className="transaction-name" title={transaction.displayEntityNameNormalized}>
            {transaction.displayEntityNameNormalized}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {transactionCategory(transaction)} · {reasonTitle}
          </span>
          <span className="transaction-inline-details block truncate text-xs text-muted-foreground">
            <span className="transaction-inline-date">
              {formatDate(transaction.correctedTransactionDate)} ·{' '}
            </span>
            {accountTitle}
          </span>
        </span>
        {transaction.isUserFlagged && (
          <span title="Flagged for review" className="shrink-0 inline-flex">
            <Flag className="h-3.5 w-3.5 text-destructive" />
          </span>
        )}
        {transaction.note && (
          <span title="Has a note" className="shrink-0 inline-flex">
            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
      </div>

      {/* Amount */}
      <div role="gridcell" className="text-right whitespace-nowrap">
        <AmountDisplay amount={transaction.correctedAmount} />
      </div>

      {/* Transaction type badge */}
      <span
        role="gridcell"
        className="transaction-wide-cell truncate rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
        title={reasonTitle}
      >
        {reasonTitle}
      </span>

      {/* Date */}
      <span
        role="gridcell"
        className="transaction-date-cell text-muted-foreground whitespace-nowrap"
      >
        {formatDate(transaction.correctedTransactionDate)}
      </span>

      {/* Account */}
      <span
        role="gridcell"
        className="transaction-wide-cell text-muted-foreground text-xs truncate"
        title={accountTitle}
      >
        {accountTitle || accountDisplay}
      </span>

      {/* Context menu button - visible on hover or when row is selected */}
      <div
        role="gridcell"
        className={cn('opacity-100 transition-opacity', isSelected && 'opacity-100')}
      >
        {hasEditActions ? (
          <TransactionContextMenuButton
            title="Transaction actions"
            onEditCategory={() => onEditCategory?.(transaction)}
            onEditNote={() => onEditNote?.(transaction)}
            onEditAttributes={() => onEditAttributes?.(transaction)}
            onToggleFlag={() => onToggleFlag?.(transaction)}
            onRemoveFlag={() => onRemoveFlag?.(transaction)}
          />
        ) : (
          <div className="w-7" />
        )}
      </div>
    </div>
  );
};

TransactionRow.displayName = 'TransactionRow';
