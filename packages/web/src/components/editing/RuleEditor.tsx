import React, { useMemo, useState } from 'react';
import {
  createAuditInfo,
  createUUID,
  createScopeFilter,
  ScopeType,
  type EditedValues,
  type ScopeFilter,
  type TransactionEditData,
  type Transactions,
  transactionReasonTitleLookup,
} from '@moneyinmotion/core';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Textarea } from '../ui/textarea.js';
import { Select } from '../ui/select.js';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { RuleValuesEditor } from './RuleValuesEditor.js';
import { editableRule, scopeNames } from '../../lib/rules.js';
import type { RuleChange } from '../../api/client.js';
import { RuleTargetPicker } from './RuleTargetPicker.js';
import { useAccounts } from '../../api/hooks.js';

export function RuleEditor({
  rules,
  transactions,
  onClose,
  onReview,
  initialScopes,
  initialValues,
  open = true,
  title,
  description,
}: {
  rules: TransactionEditData[];
  transactions: Transactions;
  onClose: () => void;
  onReview: (changes: RuleChange[]) => void;
  initialScopes?: ScopeFilter[];
  initialValues?: EditedValues;
  open?: boolean;
  title?: string;
  description?: string;
}) {
  const configuredAccounts = useAccounts();
  const accountOptions = useMemo(() => {
    const observed = new Set(
      [...transactions.allParentChildTransactions].map((transaction) => transaction.accountId),
    );
    const accounts = new Map(
      [...observed].map((id) => [id, transactions.getAccountInfo(id).title || id]),
    );
    for (const {
      config: { accountInfo },
    } of configuredAccounts.data ?? [])
      accounts.set(
        accountInfo.id,
        `${accountInfo.title || accountInfo.id}${observed.has(accountInfo.id) ? '' : ' · no imported records'}`,
      );
    return [...accounts]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [transactions, configuredAccounts.data]);
  const bulk = rules.length > 1;
  const [values, setValues] = useState<EditedValues>(
    initialValues ?? (bulk ? {} : (rules[0]?.values ?? {})),
  );
  const [scopes, setScopes] = useState(() =>
    (
      initialScopes ??
      rules[0]?.scopeFilters ?? [{ type: ScopeType.EntityNameAllTokens, parameters: [''] }]
    ).map((s) => ({ type: s.type, parameters: [...s.parameters] })),
  );
  const [error, setError] = useState('');
  const changeScope = (index: number, patch: Partial<(typeof scopes)[number]>) =>
    setScopes(scopes.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const review = () => {
    try {
      if (!Object.values(values).some((v) => v != null))
        throw new Error('Choose at least one field to change.');
      for (const [key, field] of Object.entries(values)) {
        if (!field || field.isVoided) continue;
        if (
          rules.length === 1 &&
          JSON.stringify(field) === JSON.stringify(rules[0]?.values?.[key as keyof EditedValues])
        )
          continue;
        if (typeof field.value === 'string' && !field.value.trim())
          throw new Error(`Enter a value for ${key}, or choose Restore imported value.`);
        if (Array.isArray(field.value) && field.value.some((v: string) => !v.trim()))
          throw new Error('Category segments cannot be empty.');
        if (typeof field.value === 'number' && !Number.isFinite(field.value))
          throw new Error('Enter a valid amount.');
      }
      const filters = bulk ? [] : scopes.map((s) => createScopeFilter(s.type, s.parameters));
      const patch = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v != null),
      ) as EditedValues;
      onReview(
        rules.length
          ? rules.map((rule) => ({
              previous: rule,
              next: {
                ...editableRule(rule),
                scopeFilters: bulk ? editableRule(rule).scopeFilters : filters,
                values: bulk ? { ...rule.values, ...patch } : values,
              },
            }))
          : [
              {
                previous: null,
                next: {
                  id: createUUID(),
                  auditInfo: createAuditInfo('rules-ui'),
                  scopeFilters: filters,
                  values,
                  sourceId: 'rules-ui',
                },
              },
            ],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title={
          title ??
          (bulk ? `Edit ${rules.length} rules` : rules.length ? 'Edit rule' : 'Create rule')
        }
        description={
          description ??
          'Preview the effects before saving. Imported statement values stay unchanged.'
        }
        className="max-w-3xl"
      >
        {!bulk && (
          <fieldset className="mb-6 space-y-3">
            <legend className="mb-2 font-semibold">
              Match transactions when ALL conditions hold
            </legend>
            <p className="text-xs text-muted-foreground">
              Rules also apply to future imports. Name and amount conditions use imported values,
              before other rules. Multiple values within a condition are alternatives, except “all
              words”.
            </p>
            {scopes.map((s, index) => (
              <div key={index} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    aria-label={`Condition ${index + 1} type`}
                    value={String(s.type)}
                    options={Object.entries(scopeNames).map(([value, label]) => ({ value, label }))}
                    onChange={(e) => {
                      const type = Number(e.target.value) as ScopeType;
                      changeScope(index, {
                        type,
                        parameters:
                          type === ScopeType.All || type === ScopeType.None
                            ? []
                            : type === ScopeType.AmountRange
                              ? ['0', '100', 'false']
                              : type === ScopeType.TransactionId
                                ? []
                                : [''],
                      });
                    }}
                  />
                  <Button
                    variant="ghost"
                    disabled={scopes.length === 1}
                    onClick={() => setScopes(scopes.filter((_, i) => index !== i))}
                    aria-label={`Remove condition ${index + 1}`}
                  >
                    Remove
                  </Button>
                </div>
                {s.type === ScopeType.TransactionId ? (
                  <RuleTargetPicker
                    transactions={transactions}
                    ids={s.parameters}
                    onChange={(parameters) => changeScope(index, { parameters })}
                  />
                ) : s.type === ScopeType.AmountRange ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1 text-xs font-medium">
                      Minimum amount
                      <Input
                        type="number"
                        min="0"
                        value={s.parameters[0]}
                        onChange={(e) =>
                          changeScope(index, {
                            parameters: [
                              e.target.value,
                              s.parameters[1]!,
                              s.parameters[2] ?? 'false',
                            ],
                          })
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      Maximum amount
                      <Input
                        type="number"
                        min="0"
                        value={s.parameters[1]}
                        onChange={(e) =>
                          changeScope(index, {
                            parameters: [
                              s.parameters[0]!,
                              e.target.value,
                              s.parameters[2] ?? 'false',
                            ],
                          })
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      Amount direction
                      <Select
                        value={s.parameters[2] ?? 'false'}
                        options={[
                          { value: 'false', label: 'Incoming (+)' },
                          { value: 'true', label: 'Outgoing (−)' },
                        ]}
                        onChange={(e) =>
                          changeScope(index, {
                            parameters: [s.parameters[0]!, s.parameters[1]!, e.target.value],
                          })
                        }
                      />
                    </label>
                    <p className="text-xs text-muted-foreground sm:col-span-3">
                      Enter positive amounts, then choose incoming or outgoing. For expenses from
                      −$50 to −$10, enter 10 and 50 and choose Outgoing.
                    </p>
                  </div>
                ) : s.type === ScopeType.AccountId && s.parameters.length <= 1 ? (
                  <div className="space-y-2">
                    <Select
                      aria-label="Account condition"
                      value={s.parameters[0] ?? ''}
                      placeholder="Choose an account"
                      options={[
                        ...accountOptions,
                        ...(s.parameters[0] &&
                        !accountOptions.some((option) => option.value === s.parameters[0])
                          ? [
                              {
                                value: s.parameters[0],
                                label: `${s.parameters[0]} · not currently available`,
                              },
                            ]
                          : []),
                      ]}
                      onChange={(e) => changeScope(index, { parameters: [e.target.value] })}
                    />
                    {configuredAccounts.isLoading && (
                      <p role="status" className="text-xs text-muted-foreground">
                        Loading configured accounts; accounts from loaded history are already
                        available.
                      </p>
                    )}
                    {configuredAccounts.error && (
                      <p className="text-xs text-amber-800">
                        Could not load configured accounts. You can still use accounts from loaded
                        history.{' '}
                        <button
                          className="underline"
                          onClick={() => {
                            void configuredAccounts.refetch();
                          }}
                        >
                          Retry account list
                        </button>
                      </p>
                    )}
                  </div>
                ) : s.type === ScopeType.TransactionReason && s.parameters.length <= 1 ? (
                  <Select
                    aria-label="Transaction type condition"
                    value={s.parameters[0] ?? ''}
                    placeholder="Choose a transaction type"
                    options={Object.entries(transactionReasonTitleLookup).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    onChange={(e) => changeScope(index, { parameters: [e.target.value] })}
                  />
                ) : (
                  s.type !== ScopeType.All &&
                  s.type !== ScopeType.None && (
                    <>
                      <Textarea
                        aria-label={`Condition ${index + 1} values`}
                        rows={2}
                        value={s.parameters.join('\n')}
                        onChange={(e) =>
                          changeScope(index, { parameters: e.target.value.split('\n') })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        One{' '}
                        {s.type === ScopeType.EntityNameAllTokens ||
                        s.type === ScopeType.EntityNameAnyTokens
                          ? 'word'
                          : 'value'}{' '}
                        per line. Exact transaction IDs can be copied from transaction details.
                      </p>
                    </>
                  )
                )}
                {s.type === ScopeType.All && (
                  <p className="text-sm text-amber-800">
                    This condition includes every transaction. Review the preview carefully.
                  </p>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              disabled={scopes.length >= 20}
              onClick={() =>
                setScopes([...scopes, { type: ScopeType.AccountId, parameters: [''] }])
              }
            >
              Add condition
            </Button>
          </fieldset>
        )}
        {bulk && (
          <p className="mb-4 text-sm text-muted-foreground">
            Each rule keeps its own conditions and position. Only fields you explicitly set below
            will change.
          </p>
        )}
        <RuleValuesEditor values={values} onChange={setValues} bulk={bulk} />
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={review}>Preview changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
