import {
  ScopeType,
  TransactionEdits,
  type TransactionEditData,
  type Transactions,
  type Transaction,
} from '@moneyinmotion/core';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';

export interface RuleChange {
  previous: TransactionEditData | null;
  next: TransactionEditData | null;
}

export class RuleConflictError extends Error {}

export function snapshotRevision(current: Transactions): string {
  return createHash('sha256').update(JSON.stringify(current.serialize())).digest('hex');
}

function effectiveValues(tx: Transaction) {
  return {
    name: tx.displayEntityNameNormalized,
    amount: tx.correctedAmount,
    date: tx.correctedTransactionDate,
    reason: tx.correctedTransactionReason,
    category: tx.categoryPath,
    note: tx.note,
    flagged: tx.isUserFlagged,
  };
}

/** Validate the whole batch, then replay off to the side (also used for previews). */
export function prepareRuleChanges(current: Transactions, changes: RuleChange[]) {
  const old = current.getClonedEdits();
  for (const tx of current.allParentChildTransactions) {
    if (
      Object.values(tx.mergedEdit ?? {}).some((value) => value != null) &&
      (!tx.appliedEditIdsDescending?.length ||
        tx.appliedEditIdsDescending.some((id) => !old.get(id)))
    ) {
      throw new RuleConflictError(
        'This snapshot contains corrections without their full rule history. Restore the complete snapshot and rules before modifying rules; no values have been changed.',
      );
    }
  }
  const replacements = new Map<string, TransactionEditData | null>();
  for (const { previous, next } of changes) {
    const id = previous?.id ?? next?.id;
    if (!id || (previous && next && previous.id !== next.id) || replacements.has(id)) {
      throw new RuleConflictError('Each rule must appear once, with an unchanged rule ID.');
    }
    if (!isDeepStrictEqual(old.get(id) ?? null, previous)) {
      throw new RuleConflictError(
        'A rule changed since you opened it. Refresh Rules and try again.',
      );
    }
    if (next) {
      for (const scope of next.scopeFilters) {
        if (scope.type !== ScopeType.TransactionId) continue;
        const priorIds = new Set(
          previous?.scopeFilters
            .filter((s) => s.type === ScopeType.TransactionId)
            .flatMap((s) => [...s.parameters]),
        );
        if (scope.parameters.some((id) => !current.getTransaction(id) && !priorIds.has(id))) {
          throw new RuleConflictError(
            'A selected transaction no longer exists. Refresh and select it again.',
          );
        }
      }
    }
    replacements.set(id, next);
  }
  const edits = new TransactionEdits('rules-ui');
  for (const edit of old) {
    const replacement = replacements.has(edit.id) ? replacements.get(edit.id) : edit;
    if (replacement) edits.add(replacement);
  }
  for (const { previous, next } of changes) if (!previous && next) edits.add(next);
  const candidate = current.withReplayedEdits(edits);
  let affectedTransactionsCount = 0;
  const samples: Array<{
    id: string;
    before: ReturnType<typeof effectiveValues>;
    after: ReturnType<typeof effectiveValues>;
  }> = [];
  for (const tx of current.allParentChildTransactions) {
    const before = effectiveValues(tx);
    const after = effectiveValues(candidate.getTransaction(tx.id)!);
    if (!isDeepStrictEqual(before, after)) {
      affectedTransactionsCount++;
      if (samples.length < 10) samples.push({ id: tx.id, before, after });
    }
  }
  return {
    candidate,
    result: {
      revision: snapshotRevision(current),
      affectedTransactionsCount,
      totalRules: edits.count,
      samples,
      missingTargets: [...edits].reduce(
        (count, edit) =>
          count +
          edit.scopeFilters
            .filter((s) => s.type === ScopeType.TransactionId)
            .flatMap((s) => [...s.parameters])
            .filter((id) => !candidate.getTransaction(id)).length,
        0,
      ),
    },
  };
}
