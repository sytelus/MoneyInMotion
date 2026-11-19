/**
 * Checked card statements: the user looked at a statement that doesn't add up
 * and accepts its difference, with a note. Saved as an ordinary rule on one
 * of the statement's lines (`statementCheck`), so it is backed up, undone, and
 * listed in Rule Studio like any other correction. It holds only while the
 * statement's difference is the one checked.
 *
 * @module
 */

import {
  ScopeType,
  createAuditInfo,
  createScopeFilter,
  createUUID,
  editValue,
  type TransactionEditData,
  type Transactions,
} from '@moneyinmotion/core';
import type { RuleChange } from '../api/client.js';
import type { CardStatement } from './card-statements.js';

/** The saved rule that holds a statement's check, if any. */
export function statementCheckRule(
  transactions: Transactions,
  statement: CardStatement,
): TransactionEditData | null {
  const lineId = statement.check?.lineId;
  if (!lineId) return null;
  // Newest first: the rule that set the check wins.
  return (
    [...transactions.getClonedEdits()]
      .reverse()
      .find(
        (rule) =>
          rule.values?.statementCheck != null &&
          rule.scopeFilters.some(
            (scope) => scope.type === ScopeType.TransactionId && scope.parameters.includes(lineId),
          ),
      ) ?? null
  );
}

/**
 * The rule change that marks a statement as checked with `note` (at its
 * current difference), or that removes its check when `note` is `null`.
 */
export function statementCheckChange(
  transactions: Transactions,
  statement: CardStatement,
  note: string | null,
): RuleChange | null {
  const previous = statementCheckRule(transactions, statement);
  if (note === null) {
    if (!previous) return null;
    const { statementCheck: _removed, ...rest } = previous.values ?? {};
    const others = Object.values(rest).some((value) => value != null);
    return {
      previous,
      next: others ? { ...previous, values: rest, auditInfo: updated(previous) } : null,
    };
  }
  const lineId = statement.itemIds.at(-1);
  if (!lineId && !previous) return null;
  const check = editValue({ difference: statement.unresolved, note: note.trim() });
  const next: TransactionEditData = previous
    ? {
        ...previous,
        values: { ...previous.values, statementCheck: check },
        auditInfo: updated(previous),
      }
    : {
        id: createUUID(),
        auditInfo: createAuditInfo('web-ui'),
        scopeFilters: [createScopeFilter(ScopeType.TransactionId, [lineId!])],
        values: { statementCheck: check },
        sourceId: 'web-ui',
      };
  return { previous, next };
}

function updated(rule: TransactionEditData): TransactionEditData['auditInfo'] {
  return { ...rule.auditInfo, updateDate: new Date().toISOString(), updatedBy: 'web-ui' };
}
