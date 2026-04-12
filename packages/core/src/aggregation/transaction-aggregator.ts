/**
 * Hierarchical transaction grouping engine, ported from the legacy JS
 * `TransactionAggregator.js`.
 *
 * A `TransactionAggregator` represents a single node in a tree of grouped
 * transactions. Each node maintains running sums, key-counters for various
 * properties, and an ordered list of child sub-aggregators and leaf
 * transactions.
 *
 * @module
 */

import type { Transaction } from '../models/transaction.js';
import { KeyCounter } from './key-counter.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Configuration for constructing a {@link TransactionAggregator}.
 */
export interface AggregatorOptions {
    /** Display name for this aggregator node. */
    name: string;

    /** Parent aggregator (if any). */
    parent?: TransactionAggregator;

    /**
     * Given the current aggregator, a transaction, and its parent chain,
     * return the child sub-aggregator that should receive the transaction --
     * or `undefined` to stop recursion and store the transaction as a leaf
     * row in the current aggregator.
     */
    subAggregateFn?: (
        parent: TransactionAggregator,
        tx: Transaction,
        parents: Transaction[],
    ) => TransactionAggregator | undefined;

    /**
     * When `true` this group is considered "optional" -- it is collapsed
     * into its effective parent for display purposes.
     */
    isOptional?: boolean;

    /**
     * Explicit group ID. If omitted one is derived from the parent's
     * groupId and this node's name.
     */
    groupId?: string;
}

// ---------------------------------------------------------------------------
// TransactionAggregator
// ---------------------------------------------------------------------------

/**
 * A single node in the hierarchical transaction grouping tree.
 */
export class TransactionAggregator {
    // -- identity -----------------------------------------------------------
    name: string;
    groupId: string;

    // -- running totals -----------------------------------------------------
    count: number = 0;
    positiveSum: number = 0;
    negativeSum: number = 0;
    sum: number = 0;
    markedSum: number = 0;
    markedTxCount: number = 0;

    // -- tree metadata ------------------------------------------------------
    depth: number;
    isOptional: boolean;
    isChildrenVisible: boolean = false;
    isVisible: boolean = true;

    // -- key counters -------------------------------------------------------
    flagCounter: KeyCounter<string>;
    noteCounter: KeyCounter<string>;
    transactionReasonCounter: KeyCounter<number>;
    accountCounter: KeyCounter<string>;
    categoryCounter: KeyCounter<string>;

    // -- internal state -----------------------------------------------------
    private subAggregators: Map<string, TransactionAggregator> = new Map();
    private rows: Transaction[] = [];
    private subAggregateFn?: AggregatorOptions['subAggregateFn'];
    private parent?: TransactionAggregator;

    /**
     * Arbitrary numeric field used for custom sort ordering of top-level
     * header groups (e.g. Income = 0, Expenses = 1, Transfers = 3).
     */
    sortOrder: number = 0;

    // -----------------------------------------------------------------------
    // Construction
    // -----------------------------------------------------------------------

    constructor(options: AggregatorOptions) {
        this.name = options.name;
        this.parent = options.parent;
        this.subAggregateFn = options.subAggregateFn;
        this.isOptional = options.isOptional ?? false;
        this.depth = options.parent ? options.parent.depth + 1 : 0;
        this.groupId = options.groupId ?? (
            (options.parent ? options.parent.groupId : '') + '.' + options.name
        );

        // Initialise key counters.  The flag counter maps boolean-ish values
        // to string keys so they can be tallied uniformly.
        this.flagCounter = new KeyCounter<string>((key) => {
            if (key === undefined) return undefined;
            return key;
        });
        this.noteCounter = new KeyCounter<string>((key) => key === undefined ? undefined : key);
        this.transactionReasonCounter = new KeyCounter<number>((key) => key);
        this.accountCounter = new KeyCounter<string>((key) => key === undefined ? undefined : key);
        this.categoryCounter = new KeyCounter<string>((key) => key === undefined ? undefined : key);
    }

    // -----------------------------------------------------------------------
    // Mutation
    // -----------------------------------------------------------------------

    /**
     * Add a transaction to this aggregator.
     *
     * If a `subAggregateFn` is configured it is invoked first; if it returns
     * a child aggregator the transaction is delegated there. Otherwise the
     * transaction is stored as a leaf row in this node.
     *
     * @param tx      - The transaction to add.
     * @param parents - The ancestor transaction chain (for parent/child
     *                  hierarchies).
     */
    add(tx: Transaction, parents: Transaction[] = []): void {
        // Update running totals.
        if (tx.amount > 0) {
            this.positiveSum += tx.amount;
        } else {
            this.negativeSum += Math.abs(tx.amount);
        }
        this.sum += tx.amount;
        this.count++;

        // Track marked transactions.
        if (tx.isUserFlagged) {
            this.markedTxCount++;
            this.markedSum += tx.amount;
        }

        // Update key counters.
        this.flagCounter.add(tx.isUserFlagged != null ? String(tx.isUserFlagged) : undefined);
        this.noteCounter.add(tx.note ?? undefined);
        this.transactionReasonCounter.add(tx.transactionReason);
        this.accountCounter.add(tx.accountId);
        this.categoryCounter.add(
            tx.categoryPath.length > 0 ? tx.categoryPath.join('/') : undefined,
        );

        // Delegate to a sub-aggregator if the function returns one.
        if (this.subAggregateFn) {
            const child = this.subAggregateFn(this, tx, parents);
            if (child) {
                child.add(tx, parents);
                return;
            }
        }

        // Leaf: store the transaction directly.
        this.rows.push(tx);
    }

    // -----------------------------------------------------------------------
    // Visibility
    // -----------------------------------------------------------------------

    /** Toggle children visibility and refresh recursively. */
    setChildrenVisible(visible: boolean): void {
        this.isChildrenVisible = visible;
        this.refreshVisibility(true);
    }

    /**
     * Recompute visibility flags for this node (and optionally its
     * descendants).
     */
    refreshVisibility(recursive: boolean = false): void {
        const isTopLevel = this.depth <= 1;

        this.isVisible = isTopLevel || (
            this.parent != null &&
            this.parent.isVisible &&
            this.parent.isChildrenVisible &&
            !this.isOptional
        );

        if (!this.isChildrenVisible && (isTopLevel || this.isOptional || this.subAggregators.size > 0)) {
            this.isChildrenVisible = true;
        }

        if (recursive) {
            for (const child of this.subAggregators.values()) {
                child.refreshVisibility(true);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Finalize
    // -----------------------------------------------------------------------

    /**
     * Mark this aggregator (and all descendants) as finalized.
     *
     * This triggers a visibility refresh so that all nodes have correct
     * display state.
     */
    finalize(): void {
        this.refreshVisibility();

        for (const child of this.subAggregators.values()) {
            child.finalize();
        }
    }

    // -----------------------------------------------------------------------
    // Accessors
    // -----------------------------------------------------------------------

    /**
     * Register or retrieve a named sub-aggregator.
     *
     * Used by external grouping functions (e.g. in `NetAggregator`) to
     * lazily create child nodes.
     */
    getOrCreateSub(
        name: string,
        factory: (parent: TransactionAggregator) => TransactionAggregator,
    ): TransactionAggregator {
        let sub = this.subAggregators.get(name);
        if (!sub) {
            sub = factory(this);
            this.subAggregators.set(name, sub);
        }
        return sub;
    }

    /**
     * Return the sub-aggregators sorted by {@link sum} ascending (most
     * negative first).
     */
    getSubAggregators(): TransactionAggregator[] {
        return Array.from(this.subAggregators.values())
            .sort((a, b) => a.sum - b.sum);
    }

    /**
     * Return the sub-aggregators sorted by {@link sortOrder} ascending.
     */
    getSubAggregatorsBySortOrder(): TransactionAggregator[] {
        return Array.from(this.subAggregators.values())
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }

    /**
     * Return leaf transactions sorted by correctedTransactionDate descending.
     */
    getTransactions(): Transaction[] {
        return [...this.rows].sort((a, b) => {
            if (a.correctedTransactionDate > b.correctedTransactionDate) return -1;
            if (a.correctedTransactionDate < b.correctedTransactionDate) return 1;
            return 0;
        });
    }

    /**
     * Recursively collect all transactions (leaf rows from this node and
     * every descendant).
     */
    getAllTransactions(): Transaction[] {
        let all = [...this.rows];
        for (const sub of this.subAggregators.values()) {
            all = all.concat(sub.getAllTransactions());
        }
        return all;
    }
}
