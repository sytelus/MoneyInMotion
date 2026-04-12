/**
 * Running aggregate totals for a collection of transactions, ported from
 * the C# `TransactionAggregates` class.
 *
 * Tracks positive and negative totals, overall count, and a per-reason
 * breakdown so that display code can render summaries like
 * `"Purchase: $-123.45    Return: $45.00"`.
 *
 * @module
 */

import { getReasonTitle } from './transaction-reason-utils.js';

// ---------------------------------------------------------------------------
// TransactionAggregates
// ---------------------------------------------------------------------------

/**
 * Accumulates running aggregate totals for a set of transactions.
 */
export class TransactionAggregates {
    /** Sum of all positive (credit) amounts. */
    positiveTotal: number = 0;

    /** Sum of all negative (debit) amounts (stored as a negative number). */
    negativeTotal: number = 0;

    /** Number of transactions added. */
    count: number = 0;

    /** Running total per transaction-reason (numeric key). */
    byReason: Map<number, number> = new Map();

    // -----------------------------------------------------------------------
    // Mutation
    // -----------------------------------------------------------------------

    /**
     * Add a single transaction's amount and reason to the aggregates.
     *
     * @param amount - The transaction amount (negative for debits).
     * @param reason - The numeric `TransactionReason` flag value.
     */
    add(amount: number, reason: number): void {
        if (amount >= 0) {
            this.positiveTotal += amount;
        } else {
            this.negativeTotal += amount;
        }

        const current = this.byReason.get(reason) ?? 0;
        this.byReason.set(reason, current + amount);

        this.count++;
    }

    // -----------------------------------------------------------------------
    // Computed
    // -----------------------------------------------------------------------

    /** Net total (positive + negative). */
    get netTotal(): number {
        return this.positiveTotal + this.negativeTotal;
    }

    // -----------------------------------------------------------------------
    // Display
    // -----------------------------------------------------------------------

    /**
     * Format the per-reason breakdown as a human-readable string.
     *
     * Non-zero reason totals are displayed in ascending order of absolute
     * value, separated by four spaces, e.g.:
     *
     * ```
     * Fee: $2.50    Purchase: $123.45
     * ```
     */
    format(): string {
        return Array.from(this.byReason.entries())
            .filter(([, total]) => total !== 0)
            .sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))
            .map(([reason, total]) => {
                const title = getReasonTitle(reason);
                const formatted = `$${Math.abs(total).toFixed(2)}`;
                return `${title}: ${total < 0 ? '-' : ''}${formatted}`;
            })
            .join('    ');
    }
}
