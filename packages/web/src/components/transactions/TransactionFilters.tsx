import React from 'react';
import { transactionReasonTitleLookup } from '@moneyinmotion/core';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useTransactionsStore, emptyFilters } from '../../store/transactions-store.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { Button } from '../ui/button.js';
import { transactionCategory } from '../../lib/transaction-explorer.js';
import { ruleChangesLabel } from '../../lib/rules.js';

export function TransactionFilters() {
  const {
    transactions,
    records: reporting,
    filters,
    setFilters,
    selectedYear,
    selectedMonth,
  } = useTransactionsStore();
  const accounts = React.useMemo(
    () =>
      [...new Set(reporting.map((t) => t.accountId))]
        .sort()
        .map((id) => ({ value: id, label: transactions?.getAccountInfo(id).title || id })),
    [reporting, transactions],
  );
  const categories = React.useMemo(
    () =>
      [...new Set(reporting.map(transactionCategory))]
        .sort()
        .map((value) => ({ value, label: value })),
    [reporting],
  );
  const reasons = React.useMemo(
    () =>
      [...new Set(reporting.map((t) => String(t.correctedTransactionReason)))]
        .map((value) => ({ value, label: transactionReasonTitleLookup[value] ?? value }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [reporting],
  );
  const active = Object.values(filters).filter(Boolean).length;
  const matchedRuleLabel = React.useMemo(() => {
    if (!filters.rule || !transactions) return '';
    const rules = [...transactions.getClonedEdits()];
    const index = rules.findIndex((rule) => rule.id === filters.rule);
    return index < 0
      ? 'Unavailable saved rule'
      : `Rule ${index + 1} · ${ruleChangesLabel(rules[index]!.values)}`;
  }, [transactions, filters.rule]);
  let sourceLabel = filters.source;
  if (filters.source && transactions) {
    try {
      sourceLabel = transactions.getImportInfo(filters.source).portableAddress;
    } catch {
      sourceLabel = `Unavailable source (${filters.source})`;
    }
  }
  const periodFrom = selectedYear ? `${selectedYear}-${selectedMonth || '01'}-01` : '';
  const periodTo = selectedYear
    ? new Date(Date.UTC(Number(selectedYear), selectedMonth ? Number(selectedMonth) : 12, 0))
        .toISOString()
        .slice(0, 10)
    : '';
  const chipLabels = {
    source: `Source file: ${sourceLabel}`,
    rule: matchedRuleLabel,
    merchant: `Merchant: ${filters.merchant}`,
    flow: `Activity: ${filters.flow}`,
    account: `Account: ${accounts.find((account) => account.value === filters.account)?.label ?? filters.account}`,
    category: `Category: ${filters.category}`,
    reason: `Type: ${transactionReasonTitleLookup[filters.reason] ?? filters.reason}`,
    review: `Review: ${{ flagged: 'Marked for review', unmatched: 'Unmatched order details', uncategorized: 'Uncategorized', incomplete: 'Incomplete matches' }[filters.review] ?? filters.review}`,
    min: `Amount ≥ ${filters.min}`,
    max: `Amount ≤ ${filters.max}`,
  };
  return (
    <section aria-label="Filter transactions" className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Search transactions</span>
        <Search aria-hidden className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search merchant, order, category, note, account…"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
        />
      </label>
      <div role="group" className="flex flex-wrap gap-2" aria-label="Active filters">
        {(Object.keys(chipLabels) as (keyof typeof chipLabels)[])
          .filter((key) => filters[key])
          .map((key) => (
            <button
              key={key}
              type="button"
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-900"
              title={`Remove ${key} filter`}
              aria-label={`Remove filter: ${chipLabels[key]}`}
              onClick={() => setFilters({ [key]: '' })}
            >
              <span className="break-all">{chipLabels[key]}</span>
              <span aria-hidden>×</span>
            </button>
          ))}
      </div>
      <details className="rounded-lg border border-border bg-muted/20">
        <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4" />
          Filters{' '}
          {active > 0 && (
            <span className="rounded-full bg-primary px-2 text-xs leading-5 text-primary-foreground">
              {active} active
            </span>
          )}
        </summary>
        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-medium">
            Account
            <Select
              className="mt-1"
              value={filters.account}
              options={[{ value: '', label: 'All accounts' }, ...accounts]}
              onChange={(e) => setFilters({ account: e.target.value })}
            />
          </label>
          <label className="text-xs font-medium">
            Transaction type
            <Select
              className="mt-1"
              value={filters.reason}
              options={[{ value: '', label: 'All types' }, ...reasons]}
              onChange={(e) => setFilters({ reason: e.target.value })}
            />
          </label>
          <label className="text-xs font-medium">
            Category
            <Select
              className="mt-1"
              value={filters.category}
              options={[{ value: '', label: 'All categories' }, ...categories]}
              onChange={(e) => setFilters({ category: e.target.value })}
            />
          </label>
          <label className="text-xs font-medium">
            Review status
            <Select
              className="mt-1"
              value={filters.review}
              options={[
                { value: '', label: 'Any status' },
                { value: 'flagged', label: 'Marked for review' },
                { value: 'unmatched', label: 'Unmatched to a payment' },
                { value: 'uncategorized', label: 'Uncategorized' },
                { value: 'incomplete', label: 'Incomplete order matches' },
              ]}
              onChange={(e) => setFilters({ review: e.target.value })}
            />
          </label>
          <label className="text-xs font-medium">
            Activity
            <Select
              className="mt-1"
              value={filters.flow}
              options={[
                { value: '', label: 'All activity, including transfers' },
                { value: 'activity', label: 'Credits and debits (excludes transfers/unmatched)' },
                { value: 'credits', label: 'Recorded credits' },
                { value: 'debits', label: 'Recorded debits' },
              ]}
              onChange={(e) => setFilters({ flow: e.target.value })}
            />
          </label>
          <label className="text-xs font-medium">
            From date
            <Input
              className="mt-1"
              type="date"
              value={filters.from || periodFrom}
              onChange={(e) => setFilters({ from: e.target.value, to: filters.to || periodTo })}
            />
          </label>
          <label className="text-xs font-medium">
            Through date
            <Input
              className="mt-1"
              type="date"
              value={filters.to || periodTo}
              onChange={(e) => setFilters({ to: e.target.value, from: filters.from || periodFrom })}
            />
          </label>
          <label className="text-xs font-medium">
            Minimum amount
            <Input
              className="mt-1"
              type="number"
              step="0.01"
              value={filters.min}
              placeholder="e.g. -500"
              onChange={(e) => setFilters({ min: e.target.value })}
            />
          </label>
          <label className="text-xs font-medium">
            Maximum amount
            <Input
              className="mt-1"
              type="number"
              step="0.01"
              value={filters.max}
              placeholder="e.g. 100"
              onChange={(e) => setFilters({ max: e.target.value })}
            />
          </label>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                const { from, to, ...nonDateFilters } = emptyFilters;
                void from;
                void to;
                setFilters(nonDateFilters);
              }}
            >
              Clear search and filters
            </Button>
          </div>
        </div>
        <p className="px-3 pb-3 text-xs text-muted-foreground">
          Dates are inclusive (UTC). Setting a custom date replaces the sidebar period. Amounts are
          signed: negative for outgoing, positive for incoming.
        </p>
        {filters.from && filters.to && filters.from > filters.to && (
          <p role="alert" className="px-3 pb-3 text-sm text-destructive">
            From date must be on or before Through date.
          </p>
        )}
        {filters.min !== '' && filters.max !== '' && Number(filters.min) > Number(filters.max) && (
          <p role="alert" className="px-3 pb-3 text-sm text-destructive">
            Minimum amount must not exceed maximum amount.
          </p>
        )}
      </details>
    </section>
  );
}
