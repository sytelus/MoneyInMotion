import React, { useDeferredValue, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  ListFilter,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  ScopeType,
  Transactions,
  type EditedValues,
  type ScopeFilter,
  type TransactionEditData,
} from '@moneyinmotion/core';
import { useTransactions } from '../api/hooks.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import type { RuleChange } from '../api/client.js';
import { Header } from '../components/layout/Header.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Select } from '../components/ui/select.js';
import { Badge } from '../components/ui/badge.js';
import { Pagination } from '../components/ui/pagination.js';
import { HelpHint } from '../components/ui/help-hint.js';
import { Notice } from '../components/ui/notice.js';
import { RuleEditor } from '../components/editing/RuleEditor.js';
import { RuleChangePreview } from '../components/editing/RuleChangePreview.js';
import { ruleChangesLabel, ruleFields, scopeLabel } from '../lib/rules.js';
import { formatDate } from '../lib/utils.js';
import { ruleKind, summarizeRuleEffects, type RuleEffectSummary } from '../lib/rule-effects.js';
import { RuleInspectionDialog } from '../components/editing/RuleInspectionDialog.js';
import { downloadText } from '../lib/download.js';

const PAGE_SIZE = 50;
export const RulesPage: React.FC = () => {
  const showActions = useMediaQuery('(min-width: 640px)');
  const showScope = useMediaQuery('(min-width: 768px)');
  const showKind = useMediaQuery('(min-width: 1280px)');
  const columnCount = 4 + Number(showActions) + Number(showScope) + Number(showKind);
  const { data, isLoading, error, refetch } = useTransactions();
  const transactions = useMemo(() => (data ? Transactions.fromData(data) : null), [data]);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [field, setField] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('matches');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState('all');
  const [account, setAccount] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(0);
  const resultsRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<TransactionEditData[] | null>(null);
  const [duplicate, setDuplicate] = useState<{
    scopes: ScopeFilter[];
    values: EditedValues;
  } | null>(null);
  const [changes, setChanges] = useState<RuleChange[] | null>(null);
  const [success, setSuccess] = useState('');
  const effects = useMemo(
    () =>
      transactions ? summarizeRuleEffects(transactions) : new Map<string, RuleEffectSummary>(),
    [transactions],
  );
  const rules = useMemo(() => {
    if (!transactions) return [];
    return [...transactions.getClonedEdits()].map((edit, order) => ({
      edit,
      order,
      count: effects.get(edit.id)?.matches.length ?? 0,
      kind: ruleKind(edit),
      accounts: new Set([
        ...(effects.get(edit.id)?.accountIds ?? []),
        ...edit.scopeFilters
          .filter((scope) => scope.type === ScopeType.AccountId)
          .flatMap((scope) => [...scope.parameters]),
      ]),
      missing: edit.scopeFilters
        .filter((s) => s.type === ScopeType.TransactionId)
        .flatMap((s) => [...s.parameters])
        .filter((id) => !transactions.getTransaction(id)).length,
      scope: edit.scopeFilters.map(scopeLabel).join(' AND '),
      targets: edit.scopeFilters
        .filter((s) => s.type === ScopeType.TransactionId)
        .flatMap((s) => s.parameters.map((id) => transactions.getTransaction(id)))
        .filter((tx) => tx != null)
        .map(
          (tx) => `${tx.displayEntityNameNormalized} (${formatDate(tx.correctedTransactionDate)})`,
        ),
      changes: ruleChangesLabel(edit.values),
    }));
  }, [transactions, effects]);
  const accountOptions = useMemo(
    () =>
      [...new Set(rules.flatMap((rule) => [...rule.accounts]))]
        .sort()
        .map((id) => ({ value: id, label: data?.accountInfos[id]?.title || id })),
    [rules, data],
  );
  const filtered = useMemo(() => {
    const words = deferredQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return rules
      .filter(
        (rule) =>
          (field === 'all' ||
            rule.edit.values?.[field as keyof NonNullable<TransactionEditData['values']>] !=
              null) &&
          (kind === 'all' || rule.kind === kind) &&
          (account === 'all' || rule.accounts.has(account)) &&
          (status === 'all' ||
            (status === 'attention'
              ? rule.missing > 0
              : status === 'unapplied'
                ? rule.count === 0
                : rule.count > 0)) &&
          words.every((word) =>
            `${rule.scope} ${rule.targets.join(' ')} ${rule.changes} ${rule.edit.id} ${rule.edit.sourceId} ${rule.edit.auditInfo.createdBy} ${rule.edit.scopeFilters.flatMap((s) => [...s.parameters]).join(' ')}`
              .toLowerCase()
              .includes(word),
          ),
      )
      .sort((a, b) =>
        sort === 'oldest'
          ? a.order - b.order
          : sort === 'matches'
            ? b.count - a.count
            : sort === 'scope'
              ? a.scope.localeCompare(b.scope)
              : sort === 'changes'
                ? a.changes.localeCompare(b.changes)
                : b.order - a.order,
      );
  }, [rules, deferredQuery, field, status, sort, kind, account]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selectedRules = rules.filter((r) => selected.has(r.edit.id)).map((r) => r.edit);
  const inspected = rules.find((rule) => rule.edit.id === params.get('rule'));
  const closeInspection = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('rule');
      return next;
    });
  const openEditor = (rulesToEdit: TransactionEditData[]) => {
    setDuplicate(null);
    setEditor(rulesToEdit);
  };
  const duplicateRule = (rule: TransactionEditData) => {
    setDuplicate({
      scopes: rule.scopeFilters.map((scope) => ({ ...scope, parameters: [...scope.parameters] })),
      values: structuredClone(rule.values ?? {}),
    });
    setEditor([]);
    closeInspection();
  };
  const closeEditor = () => {
    setEditor(null);
    setDuplicate(null);
    setChanges(null);
  };
  const exportRules = () => {
    const exported = selectedRules.length ? selectedRules : filtered.map((rule) => rule.edit);
    downloadText(
      JSON.stringify(exported, null, 2),
      `moneyinmotion-rules-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
    setSuccess(
      `Exported ${exported.length} ${selectedRules.length ? 'selected' : 'filtered'} rules as JSON. The saved rules have not changed.`,
    );
  };
  const resetSelection = () => {
    setPage(0);
    setSelected(new Set());
  };
  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="workspace">
        <div className="workspace-heading">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rules</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Automate recurring changes and manage individual transaction corrections.
            </p>
          </div>
          <Button disabled={!transactions} onClick={() => openEditor([])}>
            <Plus className="mr-2 h-4 w-4" />
            Create rule
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            <strong>{rules.length.toLocaleString()}</strong> saved rules
          </span>
          <button
            className="inline-flex items-center gap-1 text-amber-800 underline underline-offset-4"
            onClick={() => {
              setStatus('attention');
              setQuery('');
              setField('all');
              setKind('all');
              setAccount('all');
              resetSelection();
            }}
          >
            <AlertTriangle className="h-4 w-4" />
            {rules.filter((r) => r.missing).length} need attention
          </button>
          <span className="inline-flex items-center">
            How rules work
            <HelpHint title="Rule order and review marks">
              <p>
                Rules are evaluated against imported values, in their saved order. If two rules
                change the same field, the later rule wins. Sorting this list does not change that
                order. Editing a rule keeps its position.
              </p>
              <p>
                “Mark for review” is a personal reminder, not an exclusion from totals. “Restore
                imported value” explicitly clears a correction. Deleting a rule removes it and
                allows remaining rules to take effect.
              </p>
            </HelpHint>
          </span>
        </div>
        {!isLoading && !error && transactions?.topLevelTransactionCount === 0 && (
          <p className="rounded-md border border-border p-3 text-sm">
            Your saved rules are available, but no transaction history is loaded.{' '}
            <Link className="underline" to="/imports">
              Rebuild transactions in Imports
            </Link>{' '}
            to see their effects.
          </p>
        )}
        {success && (
          <p
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            {success}
          </p>
        )}
        {isLoading && <p role="status">Loading rules…</p>}
        {error && (
          <div role="alert">
            <p>Could not load rules: {error.message}</p>
            <Button
              variant="outline"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          </div>
        )}
        {!isLoading && !error && (
          <>
            <nav aria-label="Rule types" className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All rules' },
                { value: 'automation', label: 'Automations' },
                { value: 'correction', label: 'Transaction corrections' },
              ].map((item) => (
                <Button
                  key={item.value}
                  variant={kind === item.value ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={kind === item.value}
                  onClick={() => {
                    setKind(item.value);
                    resetSelection();
                  }}
                >
                  {item.label}
                  <span className="ml-2 rounded bg-black/10 px-1.5 tabular-nums">
                    {
                      rules.filter((rule) => item.value === 'all' || rule.kind === item.value)
                        .length
                    }
                  </span>
                </Button>
              ))}
            </nav>
            <section
              aria-label="Find rules"
              className="space-y-3 rounded-xl border border-border bg-background p-4"
            >
              <label className="text-xs font-medium">
                <span className="mb-1 flex items-center gap-1">
                  <Search className="h-3.5 w-3.5" />
                  Search rules
                </span>
                <Input
                  value={query}
                  placeholder="Merchant, category, note, account, rule ID…"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    resetSelection();
                  }}
                />
              </label>
              <Button
                variant="outline"
                size="sm"
                className="sm:hidden"
                aria-expanded={showFilters}
                aria-controls="rule-advanced-filters"
                onClick={() => setShowFilters(!showFilters)}
              >
                <ListFilter className="mr-1 h-4 w-4" />
                Filters &amp; sort
                {[field, status, kind, account].filter((value) => value !== 'all').length > 0
                  ? ` · ${[field, status, kind, account].filter((value) => value !== 'all').length} active`
                  : ''}
              </Button>
              <div
                id="rule-advanced-filters"
                className={`${showFilters ? 'grid' : 'hidden'} gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-5`}
              >
                <label className="text-xs font-medium">
                  Changes field
                  <Select
                    className="mt-1"
                    value={field}
                    onChange={(e) => {
                      setField(e.target.value);
                      resetSelection();
                    }}
                    options={[
                      { value: 'all', label: 'All fields' },
                      ...ruleFields.map((f) => ({ value: f.key, label: f.label })),
                    ]}
                  />
                </label>
                <label className="text-xs font-medium">
                  Status
                  <Select
                    className="mt-1"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      resetSelection();
                    }}
                    options={[
                      { value: 'all', label: 'All rules' },
                      { value: 'attention', label: 'Needs attention' },
                      { value: 'applied', label: 'Applied to transactions' },
                      { value: 'unapplied', label: 'No recorded matches' },
                    ]}
                  />
                </label>
                <label className="text-xs font-medium">
                  Sort rules
                  <Select
                    className="mt-1"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(0);
                    }}
                    options={[
                      { value: 'newest', label: 'Last in rule order' },
                      { value: 'oldest', label: 'Rule order (first to last)' },
                      { value: 'matches', label: 'Most matches' },
                      { value: 'scope', label: 'Condition A–Z' },
                      { value: 'changes', label: 'Change / category A–Z' },
                    ]}
                  />
                </label>
                <label className="text-xs font-medium">
                  Rule type
                  <Select
                    className="mt-1"
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value);
                      resetSelection();
                    }}
                    options={[
                      { value: 'all', label: 'Corrections and automations' },
                      { value: 'correction', label: 'Transaction corrections' },
                      { value: 'automation', label: 'Automation rules' },
                      { value: 'inactive', label: 'Matches no transactions' },
                    ]}
                  />
                </label>
                <label className="text-xs font-medium">
                  Account
                  <Select
                    className="mt-1"
                    value={account}
                    onChange={(event) => {
                      setAccount(event.target.value);
                      resetSelection();
                    }}
                    options={[{ value: 'all', label: 'All accounts' }, ...accountOptions]}
                  />
                </label>
                <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-5">
                  Corrections apply to selected transactions; automations can also match future
                  imports. Sorting this table does not change the order in which rules run.
                </p>
              </div>
            </section>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={!visible.length}
                onClick={() =>
                  setSelected(new Set([...selected, ...visible.map((r) => r.edit.id)]))
                }
              >
                Select page
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!filtered.length || filtered.length > 1000}
                onClick={() => setSelected(new Set(filtered.map((r) => r.edit.id)))}
              >
                Select all {filtered.length} results
              </Button>
              <span aria-live="polite" className="text-muted-foreground">
                {selectedRules.length} selected
              </span>
              {selectedRules.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => openEditor(selectedRules)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setChanges(selectedRules.map((previous) => ({ previous, next: null })))
                    }
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete selected
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                    Clear selection
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={!filtered.length && !selectedRules.length}
                onClick={exportRules}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Export {selectedRules.length ? 'selected' : 'results'}
              </Button>
            </div>
            {params.has('rule') && !inspected && (
              <Notice
                tone="warning"
                role="alert"
                title="This rule is no longer available"
                actions={
                  <Button variant="outline" size="sm" onClick={closeInspection}>
                    Dismiss
                  </Button>
                }
              >
                The link points to a rule that is not in the currently saved rules. It may have been
                deleted, or the active data location may have changed.
              </Notice>
            )}
            {filtered.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <ListFilter className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                <h2 className="font-semibold">
                  {rules.length ? 'No rules match these filters' : 'No rules yet'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rules.length
                    ? 'Try a different search or clear the filters.'
                    : 'Create a rule here, or make a correction from Transactions.'}
                </p>
                {rules.length > 0 && (
                  <Button
                    variant="link"
                    onClick={() => {
                      setQuery('');
                      setField('all');
                      setStatus('all');
                      setKind('all');
                      setAccount('all');
                      resetSelection();
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
            <section
              ref={resultsRef}
              tabIndex={-1}
              aria-label="Saved rules"
              className="min-w-0 rounded-xl border border-border bg-background shadow-sm"
            >
              <div className="overflow-x-auto rounded-xl">
                <table
                  className="data-table table-fixed"
                  aria-label="Rules and transaction corrections"
                >
                  <thead>
                    <tr>
                      <th className="w-9 sm:w-10">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="w-9 sm:w-10">
                        <span className="sr-only">Details</span>
                      </th>
                      <th aria-sort={sort === 'changes' ? 'ascending' : 'none'}>
                        <button
                          className="text-left"
                          onClick={() => {
                            setSort('changes');
                            setPage(0);
                          }}
                        >
                          Change / correction
                        </button>
                      </th>
                      <th
                        className="hidden w-[28%] md:table-cell"
                        aria-sort={sort === 'scope' ? 'ascending' : 'none'}
                      >
                        <button
                          onClick={() => {
                            setSort('scope');
                            setPage(0);
                          }}
                        >
                          Applies to
                        </button>
                      </th>
                      <th className="hidden w-32 xl:table-cell">Type</th>
                      <th
                        className="w-20 text-right sm:w-24"
                        aria-sort={sort === 'matches' ? 'descending' : 'none'}
                      >
                        <button
                          onClick={() => {
                            setSort('matches');
                            setPage(0);
                          }}
                        >
                          Matches{sort === 'matches' ? ' ↓' : ''}
                        </button>
                      </th>
                      <th className="hidden w-24 sm:table-cell">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((rule, index) => {
                      const group =
                        rule.count > 1
                          ? 'Multiple transactions'
                          : rule.count === 1
                            ? 'Single transaction'
                            : 'No matching transactions';
                      const previous = visible[index - 1];
                      const previousGroup = previous
                        ? previous.count > 1
                          ? 'Multiple transactions'
                          : previous.count === 1
                            ? 'Single transaction'
                            : 'No matching transactions'
                        : null;
                      const isExpanded = expanded.has(rule.edit.id);
                      return (
                        <React.Fragment key={rule.edit.id}>
                          {sort === 'matches' && group !== previousGroup && (
                            <tr>
                              <th
                                colSpan={columnCount}
                                scope="rowgroup"
                                className="!bg-indigo-50 !py-2 !text-indigo-900"
                              >
                                {group}
                              </th>
                            </tr>
                          )}
                          <tr className="data-row" data-selected={selected.has(rule.edit.id)}>
                            <td>
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-primary"
                                aria-label={`Select rule ${rule.order + 1}`}
                                checked={selected.has(rule.edit.id)}
                                onChange={() => toggle(rule.edit.id)}
                              />
                            </td>
                            <td>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} rule ${rule.order + 1}`}
                                aria-expanded={isExpanded}
                                aria-controls={`rule-details-${rule.order}`}
                                onClick={() =>
                                  setExpanded((current) => {
                                    const next = new Set(current);
                                    if (next.has(rule.edit.id)) next.delete(rule.edit.id);
                                    else next.add(rule.edit.id);
                                    return next;
                                  })
                                }
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </td>
                            <td className="break-words">
                              <button
                                className="text-left font-semibold leading-5 hover:text-primary hover:underline"
                                onClick={() => setParams({ rule: rule.edit.id })}
                              >
                                {rule.changes}
                              </button>
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground md:hidden">
                                {rule.targets[0] || rule.scope}
                              </p>
                              {rule.missing > 0 && (
                                <span className="mt-1 flex items-center text-xs text-warning-foreground">
                                  <AlertTriangle className="mr-1 h-3.5 w-3.5 shrink-0" />
                                  {rule.missing} unavailable transaction
                                  {rule.missing === 1 ? '' : 's'}
                                  <HelpHint title="Unavailable transactions">
                                    <p>
                                      This rule refers to {rule.missing} transaction ID(s) that are
                                      not in the loaded history. That part cannot currently apply.
                                      This is a reference problem, not a missing dollar amount.
                                    </p>
                                    <p>
                                      Rebuild from retained statements in Imports. If the
                                      transaction is still unavailable, edit the rule to select the
                                      right transaction or delete the rule if no longer needed.
                                    </p>
                                  </HelpHint>
                                </span>
                              )}
                            </td>
                            <td className="hidden break-words text-muted-foreground md:table-cell">
                              <p
                                className="line-clamp-2"
                                title={rule.targets.join(' · ') || rule.scope}
                              >
                                {rule.targets.slice(0, 1).join('') || rule.scope}
                              </p>
                              {rule.targets.length > 1 && (
                                <span className="text-xs">
                                  +{rule.targets.length - 1} other targets
                                </span>
                              )}
                            </td>
                            <td className="hidden xl:table-cell">
                              <Badge variant={rule.kind === 'automation' ? 'info' : 'secondary'}>
                                {rule.kind === 'automation'
                                  ? 'Automation'
                                  : rule.kind === 'correction'
                                    ? 'Correction'
                                    : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="text-right">
                              <button
                                className="inline-flex min-h-8 min-w-8 items-center justify-end font-semibold tabular-nums text-primary underline underline-offset-4"
                                aria-label={`View results for rule ${rule.order + 1}: ${rule.count} transaction${rule.count === 1 ? '' : 's'}`}
                                onClick={() => setParams({ rule: rule.edit.id })}
                              >
                                {rule.count.toLocaleString()}
                              </button>
                            </td>
                            <td className="hidden sm:table-cell">
                              <div className="flex">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Edit rule ${rule.order + 1}`}
                                  title="Edit rule"
                                  onClick={() => openEditor([rule.edit])}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  aria-label={`Delete rule ${rule.order + 1}`}
                                  title="Delete rule"
                                  onClick={() => setChanges([{ previous: rule.edit, next: null }])}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr id={`rule-details-${rule.order}`}>
                              <td colSpan={columnCount} className="!bg-slate-50 !p-4">
                                <div className="grid gap-4 text-sm lg:grid-cols-[minmax(0,1fr)_auto]">
                                  <div className="min-w-0 space-y-2">
                                    <p className="font-medium">{rule.scope}</p>
                                    {rule.targets.length > 0 && (
                                      <p className="break-words text-muted-foreground">
                                        {rule.targets.join(' · ')}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      Runs #{rule.order + 1} · Created{' '}
                                      {formatDate(rule.edit.auditInfo.createDate)} by{' '}
                                      {rule.edit.auditInfo.createdBy}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Later rules may override this change. View results to see
                                      which values it currently controls.
                                    </p>
                                    <details className="text-xs">
                                      <summary className="cursor-pointer">
                                        Technical identifiers
                                      </summary>
                                      <p className="mt-2 break-all">
                                        Rule: {rule.edit.id} · Source: {rule.edit.sourceId}
                                      </p>
                                    </details>
                                  </div>
                                  <div className="flex flex-wrap items-start gap-2">
                                    <Button
                                      className="sm:hidden"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openEditor([rule.edit])}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      className="sm:hidden"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setChanges([{ previous: rule.edit, next: null }])
                                      }
                                    >
                                      Delete
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setParams({ rule: rule.edit.id })}
                                    >
                                      <Eye className="mr-1 h-4 w-4" />
                                      View results
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => duplicateRule(rule.edit)}
                                    >
                                      <Copy className="mr-1 h-4 w-4" />
                                      Duplicate
                                    </Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            <Pagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onChange={(nextPage) => {
                setPage(nextPage);
                requestAnimationFrame(() => {
                  resultsRef.current?.scrollIntoView?.({ block: 'start' });
                  resultsRef.current?.focus({ preventScroll: true });
                });
              }}
              noun="rules"
            />
            <Link to="/transactions" className={buttonClassName({ variant: 'link' })}>
              Back to Transactions
            </Link>
          </>
        )}
        {editor && transactions && (
          <RuleEditor
            rules={editor}
            transactions={transactions}
            open={!changes}
            title={duplicate ? 'Duplicate rule' : undefined}
            initialScopes={duplicate?.scopes}
            initialValues={duplicate?.values}
            onClose={closeEditor}
            onReview={(next) => {
              setChanges(next);
            }}
          />
        )}
        {changes && (
          <RuleChangePreview
            transactions={transactions ?? undefined}
            changes={changes}
            onClose={closeEditor}
            onBack={editor ? () => setChanges(null) : undefined}
            onSaved={(result) => {
              closeEditor();
              setSelected(new Set());
              setSuccess(
                `Saved. ${result.affectedTransactionsCount.toLocaleString()} transaction values changed; ${result.totalRules.toLocaleString()} rules remain.`,
              );
            }}
          />
        )}
        {inspected && transactions && !editor && !changes && (
          <RuleInspectionDialog
            rule={inspected.edit}
            transactions={transactions}
            summary={effects.get(inspected.edit.id)!}
            onClose={closeInspection}
            onEdit={() => {
              openEditor([inspected.edit]);
              closeInspection();
            }}
            onDuplicate={() => duplicateRule(inspected.edit)}
          />
        )}
      </main>
    </div>
  );
};
