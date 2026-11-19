/**
 * Rule health for Rule Studio, derived from each record's saved application
 * chain (`appliedEditIdsDescending`). Read-only: nothing here changes a rule
 * or a value, and nothing is stored. Fixes are built as ordinary rule changes
 * that go through the normal preview-and-save flow.
 */
import {
  ScopeType,
  createScopeFilter,
  createAuditInfo,
  createUUID,
  editValue,
  type EditedValues,
  type TransactionEditData,
  type Transactions,
} from '@moneyinmotion/core';
import type { RuleChange } from '../api/client.js';
import { editableRule, ruleFields } from './rules.js';

export type RuleIssue = 'missing' | 'unmatched' | 'overridden' | 'duplicate' | 'conflict';

export interface RuleDiagnosis {
  id: string;
  /** 1-based run order: a later rule wins per field. */
  order: number;
  /** Records the rule matched (order parents and details both count). */
  matches: number;
  /** Records where it writes the winning value of at least one field. */
  controls: number;
  /** Later rule ID → records where that rule replaces a value this rule sets. */
  overriddenBy: Map<string, number>;
  /** Earlier rule ID → records where this rule replaces a value that rule sets. */
  overrides: Map<string, number>;
  /** Exact transaction IDs in the rule that aren't in the loaded history. */
  missingIds: string[];
  /** The earlier rule with the same conditions and changes, if any. */
  duplicateOf: string | null;
  /** Merchant keys whose records this rule gives a category another rule disagrees with. */
  conflicts: string[];
  issues: RuleIssue[];
}

export interface CategoryChoice {
  path: string[];
  label: string;
  records: number;
  /** Rules that set this category as the winning value, in run order. */
  ruleIds: string[];
}

/** One merchant whose records get different categories from different rules. */
export interface CategoryConflict {
  /** Imported normalized name, lower case: what a merchant rule matches. */
  key: string;
  /** Imported normalized name as recorded, used to build a merchant rule. */
  merchant: string;
  /** Name shown on the records (after any rename). */
  label: string;
  records: number;
  /** Most records first. */
  choices: CategoryChoice[];
}

export interface RuleHealth {
  rules: Map<string, RuleDiagnosis>;
  conflicts: CategoryConflict[];
  counts: Record<RuleIssue | 'healthy', number>;
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Conditions and changes, independent of rule identity and parameter order. */
function ruleSignature(rule: TransactionEditData): string {
  const scopes = rule.scopeFilters
    .map((scope) => `${scope.type}:${[...scope.parameters].sort().join('\u0001')}`)
    .sort();
  const values = ruleFields.map(({ key }) => rule.values?.[key] ?? null);
  return JSON.stringify([scopes, values]);
}

export function diagnoseRules(transactions: Transactions): RuleHealth {
  const rules = [...transactions.getClonedEdits()];
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const diagnoses = new Map<string, RuleDiagnosis>();
  const signatures = new Map<string, string>();
  rules.forEach((rule, index) => {
    const signature = ruleSignature(rule);
    const duplicateOf = signatures.get(signature) ?? null;
    if (!duplicateOf) signatures.set(signature, rule.id);
    diagnoses.set(rule.id, {
      id: rule.id,
      order: index + 1,
      matches: 0,
      controls: 0,
      overriddenBy: new Map(),
      overrides: new Map(),
      missingIds: rule.scopeFilters
        .filter((scope) => scope.type === ScopeType.TransactionId)
        .flatMap((scope) => [...scope.parameters])
        .filter((id) => !transactions.getTransaction(id)),
      duplicateOf,
      conflicts: [],
      issues: [],
    });
  });

  const merchants = new Map<
    string,
    {
      merchant: string;
      label: string;
      records: number;
      choices: Map<string, CategoryChoice & { rules: Set<string> }>;
    }
  >();
  for (const tx of transactions.allParentChildTransactions) {
    // Newest first, so the first rule seen for a field holds its winning value.
    const winner = new Map<keyof EditedValues, string>();
    for (const id of new Set(tx.appliedEditIdsDescending ?? [])) {
      const rule = byId.get(id);
      const diagnosis = diagnoses.get(id);
      if (!rule || !diagnosis) continue;
      diagnosis.matches++;
      let controls = false;
      const replacedBy = new Set<string>();
      for (const { key } of ruleFields) {
        if (rule.values?.[key] == null) continue;
        const later = winner.get(key);
        if (later) replacedBy.add(later);
        else {
          winner.set(key, id);
          controls = true;
        }
      }
      if (controls) diagnosis.controls++;
      for (const later of replacedBy) {
        increment(diagnosis.overriddenBy, later);
        increment(diagnoses.get(later)!.overrides, id);
      }
    }
    const categoryRule = winner.get('categoryPath');
    const category = categoryRule ? byId.get(categoryRule)?.values?.categoryPath : null;
    if (!categoryRule || !category || category.isVoided || !category.value.length) continue;
    const merchant = tx.entityNameNormalized || tx.entityName;
    const key = merchant.toLowerCase();
    const group = merchants.get(key) ?? {
      merchant,
      label: tx.displayEntityNameNormalized,
      records: 0,
      choices: new Map(),
    };
    merchants.set(key, group);
    group.records++;
    const label = category.value.join(' / ');
    const choice = group.choices.get(label.toLowerCase()) ?? {
      path: [...category.value],
      label,
      records: 0,
      ruleIds: [],
      rules: new Set<string>(),
    };
    group.choices.set(label.toLowerCase(), choice);
    choice.records++;
    choice.rules.add(categoryRule);
  }

  const order = (id: string) => diagnoses.get(id)!.order;
  const conflicts: CategoryConflict[] = [];
  for (const [key, group] of merchants) {
    if (group.choices.size < 2) continue;
    const choices = [...group.choices.values()]
      .map(({ rules: ids, ...choice }) => ({
        ...choice,
        ruleIds: [...ids].sort((a, b) => order(a) - order(b)),
      }))
      .sort((a, b) => b.records - a.records || a.label.localeCompare(b.label));
    conflicts.push({
      key,
      merchant: group.merchant,
      label: group.label,
      records: group.records,
      choices,
    });
    for (const id of new Set(choices.flatMap((choice) => choice.ruleIds))) {
      diagnoses.get(id)!.conflicts.push(key);
    }
  }
  conflicts.sort((a, b) => b.records - a.records || a.label.localeCompare(b.label));

  const counts: RuleHealth['counts'] = {
    missing: 0,
    unmatched: 0,
    overridden: 0,
    duplicate: 0,
    conflict: conflicts.length,
    healthy: 0,
  };
  for (const diagnosis of diagnoses.values()) {
    if (diagnosis.missingIds.length) diagnosis.issues.push('missing');
    if (!diagnosis.matches) diagnosis.issues.push('unmatched');
    else if (!diagnosis.controls) diagnosis.issues.push('overridden');
    if (diagnosis.duplicateOf) diagnosis.issues.push('duplicate');
    if (diagnosis.conflicts.length) diagnosis.issues.push('conflict');
    for (const issue of diagnosis.issues) if (issue !== 'conflict') counts[issue]++;
    if (!diagnosis.issues.length) counts.healthy++;
  }
  return { rules: diagnoses, conflicts, counts };
}

export const issueText: Record<RuleIssue, { label: string; help: string }> = {
  missing: {
    label: 'Unavailable references',
    help: 'Refers to exact transactions that are not in the loaded history. That part of the rule does nothing. No money is missing.',
  },
  unmatched: {
    label: 'No matches',
    help: 'Matches no imported record. An automation may still match future imports.',
  },
  overridden: {
    label: 'Overridden',
    help: 'Matches records, but later rules replace every value it sets on all of them, so it currently changes nothing.',
  },
  duplicate: {
    label: 'Duplicate',
    help: 'Has the same conditions and changes as an earlier rule.',
  },
  conflict: {
    label: 'Category conflict',
    help: 'Gives a merchant’s records a category that other rules disagree with. It may be intended, such as groceries and gas from one store.',
  },
};

// ---------------------------------------------------------------------------
// Fixes: ordinary rule changes, saved only after a preview

/** Drop exact IDs that no longer exist; delete the rule if nothing is left to target. */
export function removeMissingReferences(
  rule: TransactionEditData,
  missingIds: readonly string[],
): RuleChange {
  const missing = new Set(missingIds);
  const scopeFilters = rule.scopeFilters.map((scope) => {
    if (scope.type !== ScopeType.TransactionId) return scope;
    const keep = scope.parameters.map((id) => !missing.has(id));
    const references =
      scope.referenceParameters?.length === scope.parameters.length
        ? scope.referenceParameters.filter((_, index) => keep[index])
        : scope.referenceParameters;
    return {
      ...scope,
      parameters: scope.parameters.filter((_, index) => keep[index]),
      referenceParameters: references ? [...references] : null,
    };
  });
  if (
    scopeFilters.some((scope) => scope.type === ScopeType.TransactionId && !scope.parameters.length)
  ) {
    return { previous: rule, next: null };
  }
  return { previous: rule, next: editableRule({ ...rule, scopeFilters }) };
}

/** Run a rule last so its values win: the same rule under a new ID at the end. */
export function moveToEnd(rule: TransactionEditData): RuleChange[] {
  const copy = editableRule(rule);
  return [
    { previous: rule, next: null },
    { previous: null, next: { ...copy, id: createUUID() } },
  ];
}

/** One category for every record from a merchant, now and in future imports. */
export function merchantCategoryRule(conflict: CategoryConflict, path: string[]): RuleChange {
  return {
    previous: null,
    next: {
      id: createUUID(),
      auditInfo: createAuditInfo('rules-ui'),
      scopeFilters: [createScopeFilter(ScopeType.EntityNameNormalized, [conflict.merchant])],
      values: { categoryPath: editValue([...path]) },
      sourceId: 'rules-ui',
    },
  };
}
