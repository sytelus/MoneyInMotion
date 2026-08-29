/**
 * Hierarchical transaction grouping engine, ported from the legacy JS
 * `TransactionAggregator.js`.
 *
 * A `TransactionAggregator` represents a single node in a tree of grouped
 * transactions. Each node maintains the totals and reason counts rendered by
 * the website, plus an ordered list of child groups and leaf transactions.
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
   * Given the current aggregator and a transaction, return the child
   * sub-aggregator that should receive the transaction --
   * or `undefined` to stop recursion and store the transaction as a leaf
   * row in the current aggregator.
   */
  subAggregateFn?: (
    parent: TransactionAggregator,
    tx: Transaction,
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
  sum: number = 0;

  // -- tree metadata ------------------------------------------------------
  depth: number;
  isOptional: boolean;

  // -- reason summary -----------------------------------------------------
  transactionReasonCounter: KeyCounter<number>;

  // -- internal state -----------------------------------------------------
  private subAggregators: Map<string, TransactionAggregator> = new Map();
  private rows: Transaction[] = [];
  private subAggregateFn?: AggregatorOptions['subAggregateFn'];

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
    this.subAggregateFn = options.subAggregateFn;
    this.isOptional = options.isOptional ?? false;
    this.depth = options.parent ? options.parent.depth + 1 : 0;
    this.groupId =
      options.groupId ?? (options.parent ? options.parent.groupId : '') + '.' + options.name;

    this.transactionReasonCounter = new KeyCounter<number>((key) => key);
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
   * @param tx - The transaction to add.
   */
  add(tx: Transaction): void {
    // Only effective edited values participate in displayed summaries.
    this.sum += tx.correctedAmount;
    this.count++;

    this.transactionReasonCounter.add(tx.correctedTransactionReason);

    // Delegate to a sub-aggregator if the function returns one.
    if (this.subAggregateFn) {
      const child = this.subAggregateFn(this, tx);
      if (child) {
        child.add(tx);
        return;
      }
    }

    // Leaf: store the transaction directly.
    this.rows.push(tx);
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
    return Array.from(this.subAggregators.values()).sort((a, b) => a.sum - b.sum);
  }

  /**
   * Return the sub-aggregators sorted by {@link sortOrder} ascending.
   */
  getSubAggregatorsBySortOrder(): TransactionAggregator[] {
    return Array.from(this.subAggregators.values()).sort((a, b) => a.sortOrder - b.sortOrder);
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
}
