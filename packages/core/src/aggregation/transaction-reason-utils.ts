/**
 * Transaction-reason utility helpers, ported from legacy JS
 * `transactionReasonUtils.js`.
 *
 * Most of the raw lookup data already lives in
 * `../models/transaction-reason.ts`; this module re-exports the tables and
 * adds the convenience functions that the aggregation layer needs.
 *
 * @module
 */

import {
    transactionReasonTitleLookup,
    transactionReasonPluralTitleLookup,
    transactionReasonCategoryLookup,
} from '../models/transaction-reason.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the singular human-readable title for a numeric transaction reason.
 *
 * Falls back to `"Unknown"` when the reason is not found in the lookup table.
 */
export function getReasonTitle(reason: number): string {
    return transactionReasonTitleLookup[String(reason)] ?? 'Unknown';
}

/**
 * Return the plural human-readable title for a numeric transaction reason.
 *
 * Falls back to `"Unknown"` when the reason is not found in the lookup table.
 */
export function getReasonPluralTitle(reason: number): string {
    return transactionReasonPluralTitleLookup[String(reason)] ?? 'Unknown';
}

/**
 * Return the high-level category (`"Expense"`, `"Income"`, or
 * `"InterAccount"`) for a numeric transaction reason.
 *
 * Falls back to `"Expense"` when the reason is not found.
 */
export function getReasonCategory(reason: number): 'Expense' | 'Income' | 'InterAccount' {
    return (transactionReasonCategoryLookup[String(reason)] ?? 'Expense') as 'Expense' | 'Income' | 'InterAccount';
}

/**
 * Format a reason-to-count breakdown map into a human-readable string.
 *
 * Example output: `"2 Purchases, 1 Fee"`.
 *
 * @param breakdown - Map from numeric `TransactionReason` to count.
 * @returns A comma-separated string of `"<count> <pluralTitle>"` entries,
 *          sorted descending by count.
 */
export function formatReasonBreakdown(breakdown: Map<number, number>): string {
    const entries = Array.from(breakdown.entries())
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);

    return entries
        .map(([reason, count]) => {
            const title = count === 1
                ? getReasonTitle(reason)
                : getReasonPluralTitle(reason);
            return `${count} ${title}`;
        })
        .join(', ');
}
