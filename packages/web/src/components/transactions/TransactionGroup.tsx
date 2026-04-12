/**
 * Group header row in the transaction list, representing a category/entity
 * aggregation level.
 *
 * @module
 */

import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { TransactionAggregator } from '@moneyinmotion/core/src/aggregation/transaction-aggregator.js';
import { transactionReasonPluralTitleLookup } from '@moneyinmotion/core';
import { cn } from '../../lib/utils.js';
import { AmountDisplay } from './AmountDisplay.js';

export interface TransactionGroupProps {
  /** The aggregator node representing this group. */
  aggregator: TransactionAggregator;
  /** Whether this group's children are currently expanded. */
  isExpanded: boolean;
  /** Callback to toggle expand/collapse. */
  onToggle?: (groupId: string) => void;
}

/**
 * Build a summary string describing the transaction reason breakdown
 * for the group (e.g. "5 Purchases, 2 Returns").
 */
function buildReasonSummary(aggregator: TransactionAggregator): string {
  const sorted = aggregator.transactionReasonCounter.getSorted();
  return sorted
    .map((entry) => {
      const title = transactionReasonPluralTitleLookup[String(entry.key)] ?? 'Other';
      return `${entry.count} ${title}`;
    })
    .join(', ');
}

/**
 * Render a group header row with expand/collapse chevron, group name,
 * aggregate sum, transaction count badge, and a reason breakdown summary.
 */
export const TransactionGroup: React.FC<TransactionGroupProps> = ({
  aggregator,
  isExpanded,
  onToggle,
}) => {
  const isTopLevel = aggregator.depth <= 1;
  const reasonSummary = buildReasonSummary(aggregator);

  return (
    <div
      role="row"
      className={cn(
        'flex items-center gap-2 px-3 py-2 cursor-pointer select-none border-b border-border hover:bg-accent/50 transition-colors',
        isTopLevel && 'bg-muted font-semibold',
      )}
      onClick={() => onToggle?.(aggregator.groupId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle?.(aggregator.groupId);
        }
      }}
      tabIndex={0}
    >
      {/* Expand/collapse chevron */}
      <span
        className="shrink-0 text-muted-foreground"
        title={isExpanded ? 'Click to collapse' : 'Click to expand'}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </span>

      {/* Group name */}
      <span className={cn('truncate', isTopLevel ? 'text-base' : 'text-sm')}>
        {aggregator.name.replace(/^(NAM_|CAT_)/, '')}
      </span>

      {/* Transaction count badge */}
      <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {aggregator.count}
      </span>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Reason breakdown (hidden on small screens) */}
      {reasonSummary && (
        <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[16rem]">
          {reasonSummary}
        </span>
      )}

      {/* Sum amount */}
      <AmountDisplay amount={aggregator.sum} className="text-sm" />
    </div>
  );
};

TransactionGroup.displayName = 'TransactionGroup';
