/**
 * Deterministic migration for legacy transaction-ID edit scopes.
 *
 * Legacy transaction IDs included .NET enum names and decimal formatting.
 * Modern parsers preserve the financial values but cannot always reproduce a
 * decimal's original textual scale or provider-specific identity metadata.
 * When a legacy materialized snapshot is available, this utility retargets an
 * otherwise-orphaned exact-ID rule to one uniquely equivalent rebuilt
 * transaction. The migrated edit remains an ordinary persisted edit; no hidden
 * runtime alias table is required on later rebuilds.
 *
 * @module
 */

import { TransactionEdits } from './transaction-edits.js';
import { ScopeType, createScopeFilter, type TransactionEditData } from './transaction-edit.js';
import type { Transaction } from './transaction.js';
import type { Transactions } from './transactions.js';
import { parseDate } from '../utils/date-utils.js';

export interface LegacyEditTargetMigrationResult {
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

function addToIndex(
  index: Map<string, Transaction[]>,
  key: string,
  transaction: Transaction,
): void {
  const values = index.get(key) ?? [];
  values.push(transaction);
  index.set(key, values);
}

/**
 * Retarget missing legacy exact-ID edit scopes when equivalence is unique.
 *
 * Ambiguous or unavailable targets are never broadened or dropped; their old
 * IDs remain in the edit and contribute to `unresolvedTargetCount`.
 */
export function migrateLegacyEditTargets(
  edits: TransactionEdits,
  previous: Transactions,
  rebuilt: Transactions,
): LegacyEditTargetMigrationResult {
  const rebuiltIds = new Set(
    [...rebuilt.allParentChildTransactions].map((transaction) => transaction.id),
  );
  const rebuiltBySemanticIdentity = new Map<string, Transaction[]>();
  const rebuiltByCalendarIdentity = new Map<string, Transaction[]>();
  for (const transaction of rebuilt.allParentChildTransactions) {
    addToIndex(rebuiltBySemanticIdentity, semanticIdentity(transaction), transaction);
    addToIndex(rebuiltByCalendarIdentity, calendarSemanticIdentity(transaction), transaction);
  }

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
        if (rebuiltIds.has(targetId)) {
          return targetId;
        }

        const previousTransaction = previous.getTransaction(targetId);
        let candidates =
          previousTransaction == null
            ? []
            : (rebuiltBySemanticIdentity.get(semanticIdentity(previousTransaction)) ?? []);
        if (candidates.length === 0 && previousTransaction != null) {
          candidates =
            rebuiltByCalendarIdentity.get(calendarSemanticIdentity(previousTransaction)) ?? [];
        }
        if (candidates.length === 1) {
          migratedTargetCount += 1;
          return candidates[0]!.id;
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
