/** Read-only explanations of the saved application chain, not an event journal. */
import {
  ScopeType,
  type EditedValues,
  type Transaction,
  type TransactionEditData,
  type Transactions,
} from '@moneyinmotion/core';
import { ruleFields } from './rules.js';

export interface AppliedRuleEffect {
  id: string;
  rule: TransactionEditData | undefined;
  order: number | undefined;
  effective: Array<keyof EditedValues>;
  overridden: Array<keyof EditedValues>;
}

/** The newest recorded writer wins, including an explicit restore-to-imported marker. */
export function transactionRuleEffects(
  transaction: Transaction,
  rules: readonly TransactionEditData[],
): AppliedRuleEffect[] {
  const byId = new Map(rules.map((rule, index) => [rule.id, { rule, order: index + 1 }]));
  const written = new Set<keyof EditedValues>();
  return [...new Set(transaction.appliedEditIdsDescending ?? [])].map((id) => {
    const entry = byId.get(id);
    const effective: Array<keyof EditedValues> = [];
    const overridden: Array<keyof EditedValues> = [];
    for (const { key } of ruleFields) {
      if (entry?.rule.values?.[key] == null) continue;
      (written.has(key) ? overridden : effective).push(key);
      written.add(key);
    }
    return { id, rule: entry?.rule, order: entry?.order, effective, overridden };
  });
}

export interface RuleEffectSummary {
  matches: Transaction[];
  effectiveRecords: number;
  overriddenRecords: number;
  accountIds: Set<string>;
}

/** One graph pass; inspect all records, since some rules target non-reporting parents. */
export function summarizeRuleEffects(transactions: Transactions): Map<string, RuleEffectSummary> {
  const rules = [...transactions.getClonedEdits()];
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const result = new Map<string, RuleEffectSummary>(
    rules.map((rule) => [
      rule.id,
      {
        matches: [],
        effectiveRecords: 0,
        overriddenRecords: 0,
        accountIds: new Set<string>(),
      },
    ]),
  );
  for (const tx of transactions.allParentChildTransactions) {
    const written = new Set<keyof EditedValues>();
    for (const id of new Set(tx.appliedEditIdsDescending ?? [])) {
      const summary = result.get(id);
      const rule = byId.get(id);
      if (!summary || !rule) continue;
      summary.matches.push(tx);
      summary.accountIds.add(tx.accountId);
      let effective = false;
      let overridden = false;
      for (const { key } of ruleFields) {
        if (rule.values?.[key] == null) continue;
        if (written.has(key)) overridden = true;
        else effective = true;
        written.add(key);
      }
      if (effective) summary.effectiveRecords++;
      if (overridden) summary.overriddenRecords++;
    }
  }
  return result;
}

export function ruleKind(rule: TransactionEditData): 'correction' | 'automation' | 'inactive' {
  if (rule.scopeFilters.some((scope) => scope.type === ScopeType.None)) return 'inactive';
  return rule.scopeFilters.some((scope) => scope.type === ScopeType.TransactionId)
    ? 'correction'
    : 'automation';
}

export function fieldNames(fields: readonly (keyof EditedValues)[]): string {
  return fields
    .map((field) => ruleFields.find(({ key }) => key === field)?.label ?? field)
    .join(', ');
}
