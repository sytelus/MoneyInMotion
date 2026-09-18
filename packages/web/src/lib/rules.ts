import {
  ScopeType,
  transactionReasonTitleLookup,
  createScopeFilter,
  type EditedValues,
  type ScopeFilter,
  type TransactionEditData,
} from '@moneyinmotion/core';
import { formatCurrency, formatDate } from './utils.js';

export const ruleFields: Array<{ key: keyof EditedValues; label: string }> = [
  { key: 'categoryPath', label: 'Category' },
  { key: 'note', label: 'Note' },
  { key: 'isFlagged', label: 'Mark for review' },
  { key: 'entityName', label: 'Merchant / name' },
  { key: 'amount', label: 'Amount' },
  { key: 'transactionDate', label: 'Date' },
  { key: 'transactionReason', label: 'Transaction type' },
];
export const scopeNames: Record<ScopeType, string> = {
  [ScopeType.None]: 'No transactions',
  [ScopeType.All]: 'All transactions',
  [ScopeType.TransactionId]: 'Specific transaction IDs',
  [ScopeType.EntityName]: 'Exact imported name',
  [ScopeType.EntityNameNormalized]: 'Normalized merchant name',
  [ScopeType.EntityNameAnyTokens]: 'Name contains any word',
  [ScopeType.EntityNameAllTokens]: 'Name contains all words',
  [ScopeType.AccountId]: 'Account',
  [ScopeType.TransactionReason]: 'Transaction type',
  [ScopeType.AmountRange]: 'Amount range',
};
export function scopeLabel(scope: ScopeFilter): string {
  if (scope.type === ScopeType.TransactionId)
    return `${scope.parameters.length} specific transaction${scope.parameters.length === 1 ? '' : 's'}`;
  if (scope.type === ScopeType.AmountRange)
    return `${scope.parameters[2] === 'true' ? 'Outgoing' : 'Incoming'} amount ${scope.parameters[0]}–${scope.parameters[1]}`;
  const params = scope.parameters
    .map((p) =>
      scope.type === ScopeType.TransactionReason ? (transactionReasonTitleLookup[p] ?? p) : p,
    )
    .join(', ');
  return `${scopeNames[scope.type]}${params ? ': ' + params : ''}`;
}
export function ruleChangesLabel(values: EditedValues | null): string {
  return (
    ruleFields
      .filter((f) => values?.[f.key] != null)
      .map(({ key, label }) => {
        const field = values![key]!;
        if (field.isVoided) return `${label}: restore imported value`;
        let value = String(field.value);
        if (key === 'categoryPath') value = (field.value as string[]).join(' / ');
        if (key === 'isFlagged') value = field.value ? 'Yes' : 'No';
        if (key === 'amount') value = formatCurrency(field.value as number);
        if (key === 'transactionDate') value = formatDate(field.value as string);
        if (key === 'transactionReason')
          value = transactionReasonTitleLookup[String(field.value)] ?? value;
        return `${label}: ${value}`;
      })
      .join(' · ') || 'No field changes'
  );
}
/** Upgrade legacy hash encodings at the write boundary, not on load. */
export function editableRule(rule: TransactionEditData): TransactionEditData {
  return {
    ...rule,
    scopeFilters: rule.scopeFilters.map((s) =>
      createScopeFilter(
        s.type,
        [...s.parameters],
        s.referenceParameters ? [...s.referenceParameters] : null,
      ),
    ),
    auditInfo: { ...rule.auditInfo, updateDate: new Date().toISOString(), updatedBy: 'rules-ui' },
  };
}
