/**
 * Keep exact-record rules attached when a rebuild changes transaction IDs.
 *
 * A transaction ID hashes its imported fields, so a parser fix can give the
 * same purchase a new ID. During a rebuild, a rule target that no longer
 * exists is looked up in the previous snapshot: if it is the only previous
 * transaction, and exactly one rebuilt transaction, with its account, reason,
 * amount, date, and name, the rule is retargeted to that rebuilt transaction
 * and saved as an ordinary edit.
 *
 * @module
 */

import { TransactionEdits } from './transaction-edits.js';
import { ScopeType, createScopeFilter, type TransactionEditData } from './transaction-edit.js';
import type { Transaction } from './transaction.js';
import type { Transactions } from './transactions.js';
import { parseDate } from '../utils/date-utils.js';

export interface EditTargetMigrationResult {
  /** Deep-cloned edits with safely migrated exact-ID targets. */
  edits: TransactionEdits;
  /** Number of old target parameters replaced by a unique rebuilt ID. */
  migratedTargetCount: number;
  /** Missing targets that could not be resolved uniquely and were retained. */
  unresolvedTargetCount: number;
}

/**
 * Fields that retain user-visible transaction identity across parser/ID
 * migrations. Amount is normalized to cents because source currencies are
 * cent-based and binary floating point can carry an insignificant remainder.
 * Import ID, line number, and provider reference are deliberately excluded:
 * they are exactly the metadata whose representation changed during hosting.
 */
function semanticIdentity(
  transaction: Transaction,
  transactionDate: string = transaction.transactionDate,
): string {
  return JSON.stringify([
    transaction.accountId,
    transaction.transactionReason,
    Math.round(transaction.amount * 100),
    transactionDate,
    transaction.entityName,
    transaction.entityId ?? null,
    transaction.lineItemType,
    transaction.parentChildMatchFilter ?? null,
  ]);
}

/**
 * Statement date-only values were historically serialized at local midnight,
 * while the hosted parser now uses timezone-independent UTC midnight. Use a
 * calendar-only fallback only when exact timestamp identity finds no match.
 */
function calendarSemanticIdentity(transaction: Transaction): string {
  const date = parseDate(transaction.transactionDate);
  const calendarDate = [
    date.getUTCFullYear().toString().padStart(4, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
  ].join('-');
  return semanticIdentity(transaction, calendarDate);
}

/** Index a graph by both identities. */
function indexByIdentity(transactions: Transactions): {
  exact: Map<string, Transaction[]>;
  calendar: Map<string, Transaction[]>;
} {
  const exact = new Map<string, Transaction[]>();
  const calendar = new Map<string, Transaction[]>();
  const add = (index: Map<string, Transaction[]>, key: string, tx: Transaction) => {
    const values = index.get(key);
    if (values) values.push(tx);
    else index.set(key, [tx]);
  };
  for (const tx of transactions.allParentChildTransactions) {
    add(exact, semanticIdentity(tx), tx);
    add(calendar, calendarSemanticIdentity(tx), tx);
  }
  return { exact, calendar };
}

/**
 * Retarget missing exact-ID edit scopes when equivalence is unique.
 *
 * Ambiguous or unavailable targets are never broadened or dropped; their old
 * IDs remain in the edit and contribute to `unresolvedTargetCount`.
 */
export function migrateEditTargets(
  edits: TransactionEdits,
  previous: Transactions,
  rebuilt: Transactions,
): EditTargetMigrationResult {
  const rebuiltIndex = indexByIdentity(rebuilt);
  let previousIndex: ReturnType<typeof indexByIdentity> | undefined;

  /** The single rebuilt record equivalent to a single previous record, if any. */
  const uniqueEquivalent = (previousTransaction: Transaction): Transaction | undefined => {
    previousIndex ??= indexByIdentity(previous);
    for (const kind of ['exact', 'calendar'] as const) {
      const key =
        kind === 'exact'
          ? semanticIdentity(previousTransaction)
          : calendarSemanticIdentity(previousTransaction);
      const candidates = rebuiltIndex[kind].get(key) ?? [];
      if (candidates.length === 0) continue;
      // Ambiguous on either side: keep the old ID rather than guess.
      const twins = previousIndex[kind].get(key) ?? [];
      return candidates.length === 1 && twins.length === 1 ? candidates[0] : undefined;
    }
    return undefined;
  };

  const migratedEdits = new TransactionEdits(edits.sourceId);
  let migratedTargetCount = 0;
  let unresolvedTargetCount = 0;

  for (const edit of edits) {
    const cloned = JSON.parse(JSON.stringify(edit)) as TransactionEditData;
    const scopeFilters = cloned.scopeFilters.map((scopeFilter) => {
      if (scopeFilter.type !== ScopeType.TransactionId) {
        return scopeFilter;
      }

      const migratedParameters = scopeFilter.parameters.map((targetId) => {
        if (rebuilt.getTransaction(targetId) != null) {
          return targetId;
        }

        const previousTransaction = previous.getTransaction(targetId);
        const equivalent =
          previousTransaction == null ? undefined : uniqueEquivalent(previousTransaction);
        if (equivalent != null) {
          migratedTargetCount += 1;
          return equivalent.id;
        }

        unresolvedTargetCount += 1;
        return targetId;
      });

      return createScopeFilter(
        ScopeType.TransactionId,
        [...new Set(migratedParameters)],
        scopeFilter.referenceParameters == null ? null : [...scopeFilter.referenceParameters],
      );
    });

    migratedEdits.add({
      ...cloned,
      scopeFilters,
    });
  }

  return {
    edits: migratedEdits,
    migratedTargetCount,
    unresolvedTargetCount,
  };
}
