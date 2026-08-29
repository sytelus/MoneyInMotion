/**
 * Top-level net aggregator, ported from the legacy JS `NetAggregator.js`.
 *
 * Creates a root {@link TransactionAggregator} with four header groups:
 *   - **Income** -- transactions where `isIncoming(reason)`
 *   - **Expenses** -- transactions where `isOutgoing(reason)`
 *   - **Transfers** -- transactions where `isInterAccount(reason)`
 *   - **Unmatched** -- transactions that require a parent but have none
 *
 * Within each header group, categorized transactions are sub-grouped by
 * their first category segment and then normalized entity name. Transactions
 * without a category are grouped directly by normalized entity name.
 *
 * @module
 */

import { Transaction } from '../models/transaction.js';
import { isIncoming, isInterAccount } from '../models/transaction-reason.js';
import { TransactionAggregator } from './transaction-aggregator.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface NetAggregatorOptions {
  /** When `true` (default) create the Income / Expenses / Transfers /
   *  Unmatched header hierarchy; when `false` put everything into a flat
   *  aggregator. */
  enableGrouping?: boolean;
}

// ---------------------------------------------------------------------------
// Internal sub-aggregator helpers
// ---------------------------------------------------------------------------

/**
 * Given a parent aggregator and a transaction, create (or retrieve) a
 * sub-aggregator keyed by the transaction's normalised entity name.
 *
 * If the transaction has a non-empty `categoryPath`, a further nested
 * sub-aggregator is created for the first path segment.
 */
function categoryOrNameSubAggregator(
  parentAggregator: TransactionAggregator,
  tx: Transaction,
): TransactionAggregator | undefined {
  // --- Category grouping (if a category path exists) ---------------------
  const categoryPath = tx.categoryPath;
  if (categoryPath && categoryPath.length > 0) {
    const catName = 'CAT_' + categoryPath[0];
    const catAgg = parentAggregator.getOrCreateSub(
      catName,
      (p) =>
        new TransactionAggregator({
          name: catName,
          parent: p,
          subAggregateFn: nameSubAggregator,
        }),
    );
    return catAgg;
  }

  // --- Name grouping -----------------------------------------------------
  return nameSubAggregator(parentAggregator, tx);
}

/**
 * Create (or retrieve) a sub-aggregator keyed by the transaction's
 * normalised entity name.  This is the leaf grouping level.
 */
function nameSubAggregator(
  parentAggregator: TransactionAggregator,
  tx: Transaction,
): TransactionAggregator | undefined {
  const entityName = tx.displayEntityNameNormalized ?? tx.entityName;
  const aggName = 'NAM_' + entityName;

  return parentAggregator.getOrCreateSub(
    aggName,
    (p) =>
      new TransactionAggregator({
        name: aggName,
        parent: p,
      }),
  );
}

// ---------------------------------------------------------------------------
// Header group factories
// ---------------------------------------------------------------------------

function makeIncomeAgg(parent: TransactionAggregator): TransactionAggregator {
  const agg = new TransactionAggregator({
    name: 'Income',
    parent,
    subAggregateFn: categoryOrNameSubAggregator,
  });
  agg.sortOrder = 0;
  return agg;
}

function makeExpenseAgg(parent: TransactionAggregator): TransactionAggregator {
  const agg = new TransactionAggregator({
    name: 'Expenses',
    parent,
    subAggregateFn: categoryOrNameSubAggregator,
  });
  agg.sortOrder = 1;
  return agg;
}

function makeTransfersAgg(parent: TransactionAggregator): TransactionAggregator {
  const agg = new TransactionAggregator({
    name: 'Transfers',
    parent,
    subAggregateFn: categoryOrNameSubAggregator,
  });
  agg.sortOrder = 3;
  return agg;
}

function makeUnmatchedAgg(parent: TransactionAggregator): TransactionAggregator {
  const agg = new TransactionAggregator({
    name: 'Unmatched',
    parent,
    subAggregateFn: categoryOrNameSubAggregator,
  });
  agg.sortOrder = 4;
  return agg;
}

// ---------------------------------------------------------------------------
// Header routing
// ---------------------------------------------------------------------------

/**
 * Determine which header group (Income / Expenses / Transfers / Unmatched)
 * a transaction belongs to, creating the group on demand.
 */
function headerSubAggregator(
  parentAggregator: TransactionAggregator,
  tx: Transaction,
): TransactionAggregator | undefined {
  // Unmatched: requires a parent but doesn't have one.
  if (tx.requiresParent && !tx.parentId) {
    return parentAggregator.getOrCreateSub('Unmatched', makeUnmatchedAgg);
  }

  const reason = tx.correctedTransactionReason;

  if (isIncoming(reason)) {
    return parentAggregator.getOrCreateSub('Income', makeIncomeAgg);
  }

  if (isInterAccount(reason)) {
    return parentAggregator.getOrCreateSub('Transfers', makeTransfersAgg);
  }

  // Default: outgoing / expense.
  return parentAggregator.getOrCreateSub('Expenses', makeExpenseAgg);
}

/**
 * Flat mode: everything goes through a single optional sub-aggregator.
 */
function flatSubAggregator(
  parentAggregator: TransactionAggregator,
  _tx: Transaction,
): TransactionAggregator | undefined {
  return parentAggregator.getOrCreateSub(
    'flatAggregator',
    (p) =>
      new TransactionAggregator({
        name: 'flatAggregator',
        parent: p,
        isOptional: true,
      }),
  );
}

// ---------------------------------------------------------------------------
// Traverse children
// ---------------------------------------------------------------------------

/**
 * Walk down a transaction's child hierarchy. When a leaf (no children or
 * has a missing child) is reached, invoke the callback.
 */
function traverseChildren(tx: Transaction, onLeaf: (tx: Transaction) => void): void {
  const children = tx.children;
  if (children == null || Object.keys(children).length === 0 || tx.hasMissingChild) {
    onLeaf(tx);
  } else {
    for (const childData of Object.values(children)) {
      const childTx = Transaction.fromData(childData);
      traverseChildren(childTx, onLeaf);
    }
  }
}

// ---------------------------------------------------------------------------
// NetAggregator
// ---------------------------------------------------------------------------

/**
 * Top-level aggregator that groups a list of transactions into Income,
 * Expenses, Transfers, and Unmatched buckets.
 */
export class NetAggregator {
  /** The root aggregator node. */
  readonly aggregator: TransactionAggregator;

  /**
   * Net income amount.
   *
   * When grouping is enabled this is `Income.sum + Expenses.sum`.
   * When grouping is disabled this is `flatAggregator.sum`.
   */
  readonly netIncomeAmount: number;

  constructor(transactions: Transaction[], options?: NetAggregatorOptions) {
    const enableGrouping = options?.enableGrouping ?? true;

    this.aggregator = new TransactionAggregator({
      name: 'Root',
      subAggregateFn: enableGrouping ? headerSubAggregator : flatSubAggregator,
    });

    for (const tx of transactions) {
      traverseChildren(tx, (leafTx) => {
        this.aggregator.add(leafTx);
      });
    }

    // Compute net income.
    if (enableGrouping) {
      const subs = this.aggregator.getSubAggregatorsBySortOrder();
      const incomeSub = subs.find((s) => s.name === 'Income');
      const expenseSub = subs.find((s) => s.name === 'Expenses');
      this.netIncomeAmount = (incomeSub?.sum ?? 0) + (expenseSub?.sum ?? 0);
    } else {
      const subs = this.aggregator.getSubAggregatorsBySortOrder();
      const flat = subs.find((s) => s.name === 'flatAggregator');
      this.netIncomeAmount = flat?.sum ?? 0;
    }
  }
}
