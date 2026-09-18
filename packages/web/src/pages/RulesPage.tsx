import React, { useDeferredValue, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
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
import type { RuleChange } from '../api/client.js';
import { Header } from '../components/layout/Header.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Select } from '../components/ui/select.js';
import { Badge } from '../components/ui/badge.js';
import { Pagination } from '../components/ui/pagination.js';
import { HelpHint } from '../components/ui/help-hint.js';
import { RuleEditor } from '../components/editing/RuleEditor.js';
import { RuleChangePreview } from '../components/editing/RuleChangePreview.js';
import { ruleChangesLabel, ruleFields, scopeLabel } from '../lib/rules.js';
import { formatDate } from '../lib/utils.js';
import { ruleKind, summarizeRuleEffects, type RuleEffectSummary } from '../lib/rule-effects.js';
import { RuleInspectionDialog } from '../components/editing/RuleInspectionDialog.js';
import { downloadText } from '../lib/download.js';

const PAGE_SIZE = 25;
export const RulesPage: React.FC = () => {
  const { data, isLoading, error, refetch } = useTransactions();
  const transactions = useMemo(() => (data ? Transactions.fromData(data) : null), [data]);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [field, setField] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rules</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Manage saved corrections and automation. Rules run on existing transactions and future
              imports; original statement values are preserved.
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
            <Link className="underline" to="/accounts">
              Build from existing statements in Accounts
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
            <section
              aria-label="Find rules"
              className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
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
                className={`${showFilters ? 'grid' : 'hidden'} gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3`}
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
                      { value: 'newest', label: 'Last applied first' },
                      { value: 'oldest', label: 'Rule order (first to last)' },
                      { value: 'matches', label: 'Most matches' },
                      { value: 'scope', label: 'Condition A–Z' },
                      { value: 'changes', label: 'Change / category A–Z' },
                    ]}
                  />
                </label>
                <label className="text-xs font-medium">
                  Rule purpose
                  <Select
                    className="mt-1"
                    value={kind}
                    onChange={(event) => {
                      setKind(event.target.value);
                      resetSelection();
                    }}
                    options={[
                      { value: 'all', label: 'Corrections and automations' },
                      { value: 'correction', label: 'Specific-record corrections' },
                      { value: 'automation', label: 'Reusable automations' },
                      { value: 'inactive', label: 'Matches no transactions' },
                    ]}
                  />
                </label>
                <label className="text-xs font-medium">
                  Account scope or recorded match
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
                <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                  Corrections target specific records. Automations can match future imports. The
                  account filter includes explicit account conditions and recorded matches; it does
                  not predict every future match.
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
              <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                The linked rule is not in the currently saved history. It may have been deleted or
                the active data location may have changed.{' '}
                <button className="underline" onClick={closeInspection}>
                  Dismiss
                </button>
              </p>
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
            <section ref={resultsRef} tabIndex={-1} aria-label="Saved rules" className="space-y-2">
              {visible.map((rule) => (
                <article
                  key={rule.edit.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-primary"
                      aria-label={`Select rule ${rule.order + 1}`}
                      checked={selected.has(rule.edit.id)}
                      onChange={() => toggle(rule.edit.id)}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="break-words text-sm font-semibold">{rule.changes}</h2>
                      <p className="break-words text-sm text-muted-foreground">{rule.scope}</p>
                      {rule.targets.length > 0 && (
                        <p className="break-words text-xs text-muted-foreground">
                          {rule.targets.slice(0, 2).join(' · ')}
                          {rule.targets.length > 2 ? ` · and ${rule.targets.length - 2} more` : ''}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Order {rule.order + 1}</span>
                        <Badge variant="secondary">
                          {rule.kind === 'correction'
                            ? 'Specific records'
                            : rule.kind === 'automation'
                              ? 'Automation'
                              : 'No-match condition'}
                        </Badge>
                        <span>Created {formatDate(rule.edit.auditInfo.createDate)}</span>
                        <button
                          className="font-medium text-primary underline underline-offset-2"
                          onClick={() => setParams({ rule: rule.edit.id })}
                        >
                          {rule.count} recorded matches
                        </button>
                        {rule.missing > 0 && (
                          <span className="inline-flex items-center">
                            <Badge variant="warning">
                              {rule.missing} unavailable transaction{rule.missing === 1 ? '' : 's'}
                            </Badge>
                            <HelpHint title="Unavailable transactions">
                              <p>
                                This rule refers to {rule.missing} transaction ID(s) that are not in
                                the loaded history. That part of the rule cannot currently apply.
                                This is a reference problem, not a missing dollar amount.
                              </p>
                              <p>
                                Build from all retained statements in Accounts. If the transaction
                                still isn’t available, edit this rule to select a valid target or
                                delete it if it is no longer needed. The app does not guess a
                                replacement.
                              </p>
                            </HelpHint>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit rule ${rule.order + 1}`}
                        title="Edit rule"
                        onClick={() => openEditor([rule.edit])}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete rule ${rule.order + 1}`}
                        title="Delete rule"
                        onClick={() => setChanges([{ previous: rule.edit, next: null }])}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="ml-7 mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setParams({ rule: rule.edit.id })}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      Inspect results
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => duplicateRule(rule.edit)}>
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Duplicate
                    </Button>
                  </div>
                  <details className="ml-7 mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Rule details</summary>
                    <div className="mt-2 space-y-1 break-all">
                      <p>ID: {rule.edit.id}</p>
                      <p>
                        Created by {rule.edit.auditInfo.createdBy} · Source: {rule.edit.sourceId}
                      </p>
                      {rule.edit.scopeFilters.map((s, i) => (
                        <p key={i}>
                          {scopeLabel(s)}{' '}
                          {s.type === ScopeType.TransactionId ? s.parameters.join(', ') : ''}
                        </p>
                      ))}
                      <p>
                        Recorded matches show where this rule was applied. Later rules can override
                        these values. Inspect results to see which fields are controlled or
                        overridden.
                      </p>
                    </div>
                  </details>
                </article>
              ))}
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
