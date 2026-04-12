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
  const reasonTitle =
    transactionReasonTitleLookup[String(transaction.transactionReason)] ?? 'Unknown';
  const accountDisplay =
    transaction.accountId.length > 12
      ? transaction.accountId.slice(0, 12) + '...'
      : transaction.accountId;

  const hasEditActions = onEditCategory || onEditNote || onEditAttributes;

  return (
    <div
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
      className={cn(
        'grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 px-3 py-2 text-sm border-b border-border cursor-pointer hover:bg-accent/50 transition-colors group',
        isSelected && 'bg-accent',
      )}
      style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
      onClick={() => onClick?.(transaction.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(transaction.id);
        }
      }}
    >
      {/* Entity name + indicators */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate">{transaction.displayEntityNameNormalized}</span>
        {transaction.isUserFlagged && (
          <Flag className="h-3.5 w-3.5 shrink-0 text-destructive" title="Flagged for review" />
        )}
        {transaction.note && (
          <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground" title="Has a note" />
        )}
      </div>

      {/* Amount */}
      <AmountDisplay amount={transaction.amount} />

      {/* Transaction type badge */}
      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground whitespace-nowrap">
        {reasonTitle}
      </span>

      {/* Date */}
      <span className="text-muted-foreground whitespace-nowrap">
        {formatDate(transaction.correctedTransactionDate)}
      </span>

      {/* Account */}
      <span className="text-muted-foreground text-xs truncate max-w-[8rem]" title={transaction.accountId}>
        {accountDisplay}
      </span>

      {/* Context menu button - visible on hover or when row is selected */}
      <div className={cn('opacity-0 group-hover:opacity-100 transition-opacity', isSelected && 'opacity-100')}>
        {hasEditActions ? (
          <TransactionContextMenuButton
            title="Actions (right-click row for menu)"
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
