import React, { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Copy, Pencil } from 'lucide-react';
import { ScopeType, type TransactionEditData, type Transactions } from '@moneyinmotion/core';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { Pagination } from '../ui/pagination.js';
import {
  fieldNames,
  transactionRuleEffects,
  type RuleEffectSummary,
} from '../../lib/rule-effects.js';
import { ruleChangesLabel, scopeLabel } from '../../lib/rules.js';
import { provenanceTimestamp } from '../../lib/transaction-provenance.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { formatCurrency, formatDate } from '../../lib/utils.js';

/** Inspect observed applications without editing or replaying financial data. */
export function RuleInspectionDialog({
  rule,
  transactions,
  summary,
  onClose,
  onEdit,
  onDuplicate,
}: {
  rule: TransactionEditData;
  transactions: Transactions;
  summary: RuleEffectSummary;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim().toLowerCase());
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState('newest');
  const rules = useMemo(() => [...transactions.getClonedEdits()], [transactions]);
  const order = rules.findIndex((item) => item.id === rule.id) + 1;
  const matches = useMemo(
    () =>
      summary.matches
        .filter((tx) =>
          `${tx.displayEntityNameNormalized} ${tx.correctedTransactionDate} ${transactions.getAccountInfo(tx.accountId).title} ${tx.id}`
            .toLowerCase()
            .includes(search),
        )
        .sort((left, right) => {
          const compared =
            sort === 'oldest'
              ? left.correctedTransactionDate.localeCompare(right.correctedTransactionDate)
              : sort === 'amount'
                ? left.correctedAmount - right.correctedAmount
                : sort === 'merchant'
                  ? left.displayEntityNameNormalized.localeCompare(
                      right.displayEntityNameNormalized,
                    )
                  : right.correctedTransactionDate.localeCompare(left.correctedTransactionDate);
          return compared || left.id.localeCompare(right.id);
        }),
    [summary, transactions, search, sort],
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matches.length / 10) - 1));
  const missing = rule.scopeFilters
    .filter((scope) => scope.type === ScopeType.TransactionId)
    .flatMap((scope) => [...scope.parameters])
    .filter((id) => !transactions.getTransaction(id));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title={`Rule ${order} · results & details`}
        description="Inspect recorded matches and the latest recorded field writers. No changes are made here."
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="font-semibold">{ruleChangesLabel(rule.values)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {rule.scopeFilters.map(scopeLabel).join(' AND ')}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="flex flex-col rounded-md bg-muted p-3">
              <dt>Recorded matches</dt>
              <dd className="order-first text-xl font-bold">{summary.matches.length}</dd>
            </div>
            <div className="flex flex-col rounded-md bg-emerald-50 p-3 text-emerald-900">
              <dt>With latest field writes</dt>
              <dd className="order-first text-xl font-bold">{summary.effectiveRecords}</dd>
            </div>
            <div className="flex flex-col rounded-md bg-amber-50 p-3 text-amber-900">
              <dt>With overridden fields</dt>
              <dd className="order-first text-xl font-bold">{summary.overriddenRecords}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            The last two counts may overlap when different fields have different winning rules.
            Matching does not mean a dollar amount changed. Source and item records can both be
            present; do not sum this list as a report.
          </p>
          {missing.length > 0 && (
            <details className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <summary className="cursor-pointer font-medium">
                {missing.length} unavailable transaction references
              </summary>
              <p className="mt-2">
                These exact targets are absent from loaded history. Rebuild from retained
                statements, or edit the rule to remove or replace targets you have verified. No
                replacement is guessed.
              </p>
              <ul className="mt-2 list-inside list-disc break-all text-xs">
                {missing.map((id, index) => (
                  <li key={`${id}-${index}`}>{id}</li>
                ))}
              </ul>
            </details>
          )}
          <Link
            className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
            to={transactionsHref({ rule: rule.id, basis: 'records', view: 'list' })}
          >
            <ArrowUpRight className="h-4 w-4" />
            Explore all recorded matches
          </Link>
          <label className="block text-xs font-medium">
            Find a matched record
            <Input
              className="mt-1"
              value={query}
              placeholder="Merchant, date, account, or ID"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className="block text-xs font-medium">
            Sort matched records
            <Select
              className="mt-1"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(0);
              }}
              options={[
                { value: 'newest', label: 'Date: newest first' },
                { value: 'oldest', label: 'Date: oldest first' },
                { value: 'amount', label: 'Amount: low to high' },
                { value: 'merchant', label: 'Merchant: A–Z' },
              ]}
            />
          </label>
          <ul className="divide-y divide-border rounded-md border border-border">
            {matches.slice(currentPage * 10, (currentPage + 1) * 10).map((tx) => {
              const effect = transactionRuleEffects(tx, rules).find((item) => item.id === rule.id)!;
              const incomplete = tx.appliedEditIdsDescending?.some(
                (id) => !rules.some((saved) => saved.id === id),
              );
              return (
                <li key={tx.id} className="space-y-1 p-3 text-xs">
                  <Link
                    className="font-medium text-primary underline underline-offset-2"
                    to={transactionsHref({ transaction: tx.id, basis: 'records', view: 'list' })}
                  >
                    {tx.displayEntityNameNormalized}
                  </Link>
                  <p className="text-muted-foreground">
                    {formatDate(tx.correctedTransactionDate)} ·{' '}
                    {transactions.getAccountInfo(tx.accountId).title || tx.accountId} ·{' '}
                    {formatCurrency(tx.correctedAmount)}
                  </p>
                  {effect.effective.length > 0 && (
                    <p className="text-emerald-800">
                      {incomplete ? 'Latest known writer' : 'Controls'}:{' '}
                      {fieldNames(effect.effective)}
                    </p>
                  )}
                  {effect.overridden.length > 0 && (
                    <p className="text-muted-foreground">
                      Overridden: {fieldNames(effect.overridden)}
                    </p>
                  )}
                  {incomplete && (
                    <p className="text-amber-800">
                      Incomplete recorded rule history; current values may have additional causes.
                    </p>
                  )}
                </li>
              );
            })}
            {!matches.length && (
              <li className="p-4 text-sm text-muted-foreground">
                {summary.matches.length
                  ? 'No matches for this search.'
                  : 'No recorded matches. This rule may apply to future imports; check its conditions if you expected existing matches.'}
              </li>
            )}
          </ul>
          <Pagination
            page={currentPage}
            pageSize={10}
            total={matches.length}
            onChange={setPage}
            noun="records"
          />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">Identity &amp; saved metadata</summary>
            <dl className="mt-2 space-y-1 break-all">
              <dt>Rule ID</dt>
              <dd>{rule.id}</dd>
              <dt>Created</dt>
              <dd>
                {provenanceTimestamp(rule.auditInfo.createDate)} · {rule.auditInfo.createdBy}
              </dd>
              <dt>Last edited</dt>
              <dd>
                {provenanceTimestamp(rule.auditInfo.updateDate)}
                {rule.auditInfo.updatedBy ? ` · ${rule.auditInfo.updatedBy}` : ''}
              </dd>
              <dt>Producer</dt>
              <dd>{rule.sourceId}</dd>
            </dl>
            <p className="mt-3">
              This is the current rule version, not a history of deleted or edited versions.
              Producer labels are recorded metadata, not authenticated identities.
            </p>
          </details>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDuplicate}>
            <Copy className="mr-1 h-4 w-4" />
            Duplicate
          </Button>
          <Button onClick={onEdit}>
            <Pencil className="mr-1 h-4 w-4" />
            Edit rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
