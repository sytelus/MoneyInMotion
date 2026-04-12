/**
 * Rules and edit-history management page.
 *
 * Lists persisted transaction edits, shows the scope and current matches for
 * each rule, and lets the user append a non-destructive "voiding" edit that
 * reverts affected fields back to their imported values.
 *
 * @module
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  History,
  Undo2,
} from 'lucide-react';
import {
  ScopeType,
  Transactions,
  createAuditInfo,
  transactionReasonTitleLookup,
  type EditedValues,
  type ScopeFilter,
  type Transaction,
  type TransactionEditData,
  voidedEditValue,
} from '@moneyinmotion/core';
import { useApplyEdits, useTransactions } from '../api/hooks.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Dialog, DialogContent, DialogFooter } from '../components/ui/dialog.js';
import {
  formatCategoryPath,
  formatCurrency,
  formatDate,
  generateEditId,
} from '../lib/utils.js';

interface FieldSummary {
  label: string;
  value: string;
  isVoided: boolean;
}

interface RuleHistoryItem {
  edit: TransactionEditData;
  affectedTransactions: Transaction[];
  fieldSummaries: FieldSummary[];
  scopeSummary: string;
  revertValues: EditedValues | null;
}

function formatDateTimeUtc(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function formatScopeFilter(scopeFilter: ScopeFilter): string {
  switch (scopeFilter.type) {
    case ScopeType.All:
      return 'All transactions';
    case ScopeType.None:
      return 'No transactions';
    case ScopeType.TransactionId:
      return `Transaction ID: ${scopeFilter.parameters.join(', ')}`;
    case ScopeType.EntityName:
      return `Entity name: ${scopeFilter.parameters.join(', ')}`;
    case ScopeType.EntityNameNormalized:
      return `Normalized entity: ${scopeFilter.parameters.join(', ')}`;
    case ScopeType.EntityNameAnyTokens:
      return `Any token: ${scopeFilter.parameters.join(', ')}`;
    case ScopeType.EntityNameAllTokens:
      return `All tokens: ${scopeFilter.parameters.join(', ')}`;
    case ScopeType.AccountId:
      return `Account: ${scopeFilter.parameters.join(', ')}`;
    case ScopeType.TransactionReason:
      return `Reason: ${scopeFilter.parameters
        .map((value) => transactionReasonTitleLookup[value] ?? value)
        .join(', ')}`;
    case ScopeType.AmountRange: {
      const [minRaw, maxRaw, negativeRaw] = scopeFilter.parameters;
      const min = Number.parseFloat(minRaw ?? '');
      const max = Number.parseFloat(maxRaw ?? '');
      if (Number.isNaN(min) || Number.isNaN(max)) {
        return `Amount range: ${scopeFilter.parameters.join(', ')}`;
      }

      if (negativeRaw?.toLowerCase() === 'true') {
        return `Negative amount between ${formatCurrency(-min)} and ${formatCurrency(-max)}`;
      }

      return `Amount between ${formatCurrency(min)} and ${formatCurrency(max)}`;
    }
    default:
      return `ScopeType ${String(scopeFilter.type)}`;
  }
}

function summarizeScope(scopeFilters: readonly ScopeFilter[]): string {
  if (scopeFilters.length === 0) {
    return 'No scope filters';
  }

  return scopeFilters.map(formatScopeFilter).join(' AND ');
}

function summarizeFields(values: EditedValues | null): FieldSummary[] {
  if (!values) {
    return [];
  }

  const fields: FieldSummary[] = [];

  if (values.categoryPath != null) {
    fields.push({
      label: 'Category',
      value: values.categoryPath.isVoided
        ? 'Revert to imported value'
        : formatCategoryPath(values.categoryPath.value),
      isVoided: values.categoryPath.isVoided,
    });
  }

  if (values.note != null) {
    fields.push({
      label: 'Note',
      value: values.note.isVoided ? 'Revert to imported value' : values.note.value,
      isVoided: values.note.isVoided,
    });
  }

  if (values.isFlagged != null) {
    fields.push({
      label: 'Flag',
      value: values.isFlagged.isVoided
        ? 'Revert to imported value'
        : values.isFlagged.value
          ? 'Flagged'
          : 'Not flagged',
      isVoided: values.isFlagged.isVoided,
    });
  }

  if (values.entityName != null) {
    fields.push({
      label: 'Entity Name',
      value: values.entityName.isVoided ? 'Revert to imported value' : values.entityName.value,
      isVoided: values.entityName.isVoided,
    });
  }

  if (values.transactionReason != null) {
    fields.push({
      label: 'Transaction Reason',
      value: values.transactionReason.isVoided
        ? 'Revert to imported value'
        : (transactionReasonTitleLookup[String(values.transactionReason.value)]
          ?? String(values.transactionReason.value)),
      isVoided: values.transactionReason.isVoided,
    });
  }

  if (values.amount != null) {
    fields.push({
      label: 'Amount',
      value: values.amount.isVoided
        ? 'Revert to imported value'
        : formatCurrency(values.amount.value),
      isVoided: values.amount.isVoided,
    });
  }

  if (values.transactionDate != null) {
    fields.push({
      label: 'Transaction Date',
      value: values.transactionDate.isVoided
        ? 'Revert to imported value'
        : formatDate(values.transactionDate.value),
      isVoided: values.transactionDate.isVoided,
    });
  }

  return fields;
}

function buildRevertValues(values: EditedValues | null): EditedValues | null {
  if (!values) {
    return null;
  }

  const revertValues: EditedValues = {};

  if (values.transactionReason != null && !values.transactionReason.isVoided) {
    revertValues.transactionReason = voidedEditValue<number>();
  }
  if (values.transactionDate != null && !values.transactionDate.isVoided) {
    revertValues.transactionDate = voidedEditValue<string>();
  }
  if (values.amount != null && !values.amount.isVoided) {
    revertValues.amount = voidedEditValue<number>();
  }
  if (values.entityName != null && !values.entityName.isVoided) {
    revertValues.entityName = voidedEditValue<string>();
  }
  if (values.isFlagged != null && !values.isFlagged.isVoided) {
    revertValues.isFlagged = voidedEditValue<boolean>();
  }
  if (values.note != null && !values.note.isVoided) {
    revertValues.note = voidedEditValue<string>();
  }
  if (values.categoryPath != null && !values.categoryPath.isVoided) {
    revertValues.categoryPath = voidedEditValue<string[]>();
  }

  return Object.keys(revertValues).length > 0 ? revertValues : null;
}

function cloneScopeFilters(scopeFilters: readonly ScopeFilter[]): ScopeFilter[] {
  return scopeFilters.map((scopeFilter) => ({
    ...scopeFilter,
    parameters: [...scopeFilter.parameters],
    referenceParameters: scopeFilter.referenceParameters != null
      ? [...scopeFilter.referenceParameters]
      : scopeFilter.referenceParameters ?? null,
  }));
}

function buildSampleLabel(transaction: Transaction): string {
  return `${transaction.displayEntityNameNormalized} (${formatCurrency(transaction.amount)} on ${formatDate(transaction.correctedTransactionDate)})`;
}

/**
 * Rule history page used to inspect edit rules and append revert edits.
 */
export const RulesPage: React.FC = () => {
  const { data, isLoading, error } = useTransactions();
  const applyEdits = useApplyEdits();
  const [selectedRule, setSelectedRule] = useState<RuleHistoryItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const rules = useMemo<RuleHistoryItem[]>(() => {
    if (!data) {
      return [];
    }

    const transactions = Transactions.fromData(data);

    return [...transactions.getClonedEdits()]
      .map((edit) => ({
        edit,
        affectedTransactions: transactions.filterTransactions(edit),
        fieldSummaries: summarizeFields(edit.values),
        scopeSummary: summarizeScope(edit.scopeFilters),
        revertValues: buildRevertValues(edit.values),
      }))
      .sort((left, right) => {
        const leftTime = Date.parse(left.edit.auditInfo.createDate);
        const rightTime = Date.parse(right.edit.auditInfo.createDate);
        return rightTime - leftTime;
      });
  }, [data]);

  const revertableRules = rules.filter((rule) => rule.revertValues != null);

  const handleConfirmRevert = () => {
    if (!selectedRule?.revertValues) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    const revertEdit: TransactionEditData = {
      id: generateEditId(),
      auditInfo: createAuditInfo('rules-ui'),
      scopeFilters: cloneScopeFilters(selectedRule.edit.scopeFilters),
      values: selectedRule.revertValues,
      sourceId: 'rules-ui',
    };

    applyEdits.mutate([revertEdit], {
      onSuccess: (result) => {
        setSelectedRule(null);
        setActionSuccess(
          `Reverted rule for ${result.affectedTransactionsCount} transaction${result.affectedTransactionsCount === 1 ? '' : 's'}.`,
        );
      },
      onError: (mutationError) => {
        setActionError(
          mutationError instanceof Error
            ? mutationError.message
            : 'Failed to revert the selected rule.',
        );
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-4 h-14 px-4 border-b border-border">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="font-bold text-lg">Rules &amp; History</h1>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <h2 className="text-base font-semibold">Scoped Edits</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Every category change, note, flag, or attribute fix is stored as a
            separate edit rule. Reverting from this page appends a new voiding
            edit and leaves the original history intact.
          </p>
        </section>

        {actionError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {actionError}
          </div>
        )}

        {actionSuccess && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
            {actionSuccess}
          </div>
        )}

        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading rule history...</div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load rules: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {!isLoading && !error && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Persisted edits</p>
                <p className="mt-1 text-2xl font-semibold">{rules.length}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Revertable rules</p>
                <p className="mt-1 text-2xl font-semibold">{revertableRules.length}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Current matches</p>
                <p className="mt-1 text-2xl font-semibold">
                  {rules.reduce((total, rule) => total + rule.affectedTransactions.length, 0)}
                </p>
              </div>
            </section>

            {rules.length === 0 ? (
              <section className="rounded-lg border border-dashed border-border p-8 text-center space-y-3">
                <p className="text-base font-medium">No edit history yet</p>
                <p className="text-sm text-muted-foreground">
                  Apply a category, note, flag, or attribute change from the
                  transaction screen and it will appear here.
                </p>
                <div>
                  <Link to="/">
                    <Button variant="outline">Back to Transactions</Button>
                  </Link>
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                {rules.map((rule) => {
                  const currentMatchCount = rule.affectedTransactions.length;
                  const sampleTransactions = rule.affectedTransactions.slice(0, 5);
                  const canRevert = rule.revertValues != null && currentMatchCount > 0;

                  return (
                    <article
                      key={rule.edit.id}
                      className="rounded-lg border border-border p-5 space-y-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{rule.fieldSummaries.length || 0} fields</Badge>
                            <Badge
                              variant={currentMatchCount > 0 ? 'info' : 'warning'}
                            >
                              {currentMatchCount} current match{currentMatchCount === 1 ? '' : 'es'}
                            </Badge>
                            <Badge variant={rule.revertValues ? 'success' : 'secondary'}>
                              {rule.revertValues ? 'Revertable' : 'Audit Only'}
                            </Badge>
                          </div>
                          <div>
                            <h3 className="text-base font-semibold">Edit Rule</h3>
                            <p className="text-sm text-muted-foreground">
                              Created {formatDateTimeUtc(rule.edit.auditInfo.createDate)} by{' '}
                              <code>{rule.edit.auditInfo.createdBy}</code> from{' '}
                              <code>{rule.edit.sourceId}</code>
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRule(rule)}
                          disabled={!canRevert || applyEdits.isPending}
                        >
                          <Undo2 className="h-4 w-4 mr-1.5" />
                          Revert to Imported Values
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium">Scope</p>
                        <p className="text-sm text-muted-foreground">{rule.scopeSummary}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Changes</p>
                        {rule.fieldSummaries.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No field-level changes recorded.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {rule.fieldSummaries.map((summary) => (
                              <li
                                key={`${rule.edit.id}-${summary.label}`}
                                className="flex flex-col gap-1 rounded-md bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <span className="text-sm font-medium">{summary.label}</span>
                                <span className="text-sm text-muted-foreground">
                                  {summary.value}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">Current Matches</p>
                        {sampleTransactions.length === 0 ? (
                          <div className="flex items-start gap-2 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                              This edit no longer matches any currently loaded transactions.
                            </span>
                          </div>
                        ) : (
                          <div className="rounded-md border border-border">
                            <ul className="divide-y divide-border">
                              {sampleTransactions.map((transaction) => (
                                <li
                                  key={`${rule.edit.id}-${transaction.id}`}
                                  className="px-3 py-2 text-sm text-foreground"
                                >
                                  {buildSampleLabel(transaction)}
                                </li>
                              ))}
                            </ul>
                            {currentMatchCount > sampleTransactions.length && (
                              <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                                ...and {currentMatchCount - sampleTransactions.length} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>

      <Dialog
        open={selectedRule != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRule(null);
          }
        }}
      >
        <DialogContent
          title="Revert Edit Rule"
          description="This creates a new voiding edit that restores affected fields to their imported values."
        >
          <div className="space-y-4">
            {selectedRule && (
              <>
                <p className="text-sm text-muted-foreground">
                  This revert will target{' '}
                  <span className="font-semibold text-foreground">
                    {selectedRule.affectedTransactions.length}
                  </span>{' '}
                  current transaction{selectedRule.affectedTransactions.length === 1 ? '' : 's'}.
                </p>

                <div className="rounded-md border border-border">
                  <ul className="divide-y divide-border">
                    {selectedRule.fieldSummaries
                      .filter((summary) => !summary.isVoided)
                      .map((summary) => (
                        <li
                          key={`revert-${summary.label}`}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{summary.label}</span>
                          <span className="text-muted-foreground">Revert to imported value</span>
                        </li>
                      ))}
                  </ul>
                </div>

                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  Original edit ID: <code>{selectedRule.edit.id}</code>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRule(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRevert}
              disabled={selectedRule?.revertValues == null || applyEdits.isPending}
            >
              {applyEdits.isPending ? (
                'Reverting...'
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Revert Rule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

RulesPage.displayName = 'RulesPage';
