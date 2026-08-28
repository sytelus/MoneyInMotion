/**
 * Interface for parent-child transaction matching strategies.
 *
 * Ported from C# `IParentChildMatch`.
 *
 * @module
 */

import type { Transaction } from '../models/transaction.js';
import type { Transactions } from '../models/transactions.js';

/**
 * A strategy for matching child transactions to their parent transactions,
 * and for handling incomplete parents whose children do not fully account
 * for the parent amount.
 */
export interface ParentChildMatch {
    /**
     * Find parent transactions for a set of children.
     *
     * @param children              - The child transactions that need parents.
     * @param availableTransactions - The full transaction collection to search.
     * @returns An array of `{ child, parent }` pairs.
     */
    getParents(
        children: Transaction[],
        availableTransactions: Transactions,
    ): Array<{ child: Transaction; parent: Transaction }>;

    /**
     * Attempt to handle an incomplete parent by creating adjustment children
     * to cover the missing amount.
     *
     * @param parent                - The parent transaction with missing children.
     * @param availableTransactions - The full transaction collection (for adding adjustments).
     * @param missingChildAmount    - The unaccounted-for amount on the parent.
     * @returns `true` if the parent was successfully handled, `false` otherwise.
     */
    handleIncompleteParent(
        parent: Transaction,
        availableTransactions: Transactions,
        missingChildAmount: number,
    ): boolean;
}
