/**
 * The everyday way to categorize: type or pick a category and choose whether
 * it applies to just the selected transactions or to every transaction from
 * the same merchant, including future imports. Saves one ordinary rule, so it
 * can be undone here or changed later on the Rules page. Anything more
 * involved goes to the full rule editor through "More options".
 *
 * @module
 */
import React, { useMemo, useState } from 'react';
import {
  ScopeType,
  createAuditInfo,
  createScopeFilter,
  createUUID,
  editValue,
  type Transaction,
  type TransactionEditData,
} from '@moneyinmotion/core';
import type { RuleChangeResult } from '../../api/client.js';
import { useManageRules } from '../../api/hooks.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Notice } from '../ui/notice.js';
import { cn, countLabel } from '../../lib/utils.js';

/** Offered until the user's own categories take their place. */
const STARTER_CATEGORIES = [
  'Groceries',
  'Dining',
  'Rent',
  'Utilities',
  'Transportation',
  'Shopping',
  'Subscriptions',
  'Entertainment',
  'Health',
  'Travel',
];

/** Parse "Shopping / Home" into a category path. */
export function parseCategoryPath(text: string): string[] {
  return text
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The shared normalized merchant name of the targets, or null when they differ. */
function sharedMerchant(targets: Transaction[]): string | null {
  const names = new Set(targets.map((tx) => tx.entityNameNormalized ?? ''));
  const [only] = names;
  return names.size === 1 && only ? only : null;
}

export interface QuickCategorySaved {
  result: RuleChangeResult;
  rule: TransactionEditData;
  summary: string;
}

export function QuickCategoryDialog({
  transactions,
  onOpenChange,
  onSaved,
  onMoreOptions,
}: {
  transactions: Transaction[];
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: QuickCategorySaved) => void;
  onMoreOptions: () => void;
}) {
  const collection = useTransactionsStore((state) => state.transactions);
  const manageRules = useManageRules();
  const first = transactions[0];
  const merchant = sharedMerchant(transactions);
  const merchantLabel = first?.displayEntityNameNormalized ?? merchant ?? '';
  // Start from the current category only when every target shares it.
  const [text, setText] = useState(() => {
    const names = new Set(transactions.map((tx) => tx.categoryPath.join(' / ')));
    return names.size === 1 ? [...names][0]! : '';
  });
  const [scope, setScope] = useState<'merchant' | 'selected'>(merchant ? 'merchant' : 'selected');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const suggestions = useMemo(() => {
    const used = new Map<string, number>();
    for (const tx of collection?.topLevelTransactions ?? []) {
      const name = tx.categoryPath.join(' / ');
      if (name) used.set(name, (used.get(name) ?? 0) + 1);
    }
    const own = [...used.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    return [...new Set([...own, ...STARTER_CATEGORIES])].slice(0, 14);
  }, [collection]);

  const scopeFilters = useMemo(
    () =>
      scope === 'merchant' && merchant
        ? [createScopeFilter(ScopeType.EntityNameNormalized, [merchant])]
        : [
            createScopeFilter(
              ScopeType.TransactionId,
              transactions.map((tx) => tx.id),
            ),
          ],
    [scope, merchant, transactions],
  );

  const merchantCount = useMemo(() => {
    if (!collection || !merchant) return 0;
    const probe = { scopeFilters: [createScopeFilter(ScopeType.EntityNameNormalized, [merchant])] };
    return collection.filterTransactions(probe as unknown as TransactionEditData).length;
  }, [collection, merchant]);

  if (!first) return null;
  const path = parseCategoryPath(text);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!path.length || saving) return;
    const rule: TransactionEditData = {
      id: createUUID(),
      auditInfo: createAuditInfo('web-ui'),
      scopeFilters,
      values: { categoryPath: editValue(path) },
      sourceId: 'web-ui',
    };
    setSaving(true);
    setError('');
    try {
      const result = await manageRules.mutateAsync([{ previous: null, next: rule }]);
      const records = countLabel(result.affectedTransactionsCount, 'record');
      onSaved({
        result,
        rule,
        summary:
          scope === 'merchant'
            ? `${merchantLabel} is now “${path.join(' / ')}”: ${records} updated, and future imports will follow.`
            : `Set “${path.join(' / ')}” on ${records}.`,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const title =
    transactions.length === 1
      ? `Category for ${merchantLabel}`
      : `Category for ${transactions.length.toLocaleString()} transactions`;

  return (
    <Dialog open onOpenChange={(open) => !saving && onOpenChange(open)}>
      <DialogContent title={title} className="max-w-lg">
        <form onSubmit={save} className="space-y-4">
          {error && (
            <Notice tone="error" title="Category was not saved">
              {error}
            </Notice>
          )}
          <div className="space-y-2">
            <label htmlFor="quick-category" className="text-sm font-medium">
              Category
            </label>
            <Input
              id="quick-category"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Groceries, or Shopping / Home"
            />
            <div className="flex flex-wrap gap-1.5" aria-label="Suggested categories">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setText(name)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent',
                    name === path.join(' / ')
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border',
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Apply to</legend>
            {merchant && (
              <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                <input
                  type="radio"
                  name="quick-category-scope"
                  checked={scope === 'merchant'}
                  onChange={() => setScope('merchant')}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="font-medium">Everything from {merchantLabel}</span>
                  <span className="block text-xs text-muted-foreground">
                    {countLabel(merchantCount, 'record')} now, plus future imports.
                  </span>
                </span>
              </label>
            )}
            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
              <input
                type="radio"
                name="quick-category-scope"
                checked={scope === 'selected'}
                onChange={() => setScope('selected')}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-medium">
                  {transactions.length === 1
                    ? 'Only this transaction'
                    : `Only these ${transactions.length.toLocaleString()} transactions`}
                </span>
              </span>
            </label>
          </fieldset>

          <DialogFooter className="flex-wrap items-center">
            <button
              type="button"
              className="mr-auto text-sm text-primary underline-offset-2 hover:underline"
              onClick={onMoreOptions}
            >
              More options…
            </button>
            <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!path.length || saving}>
              {saving ? 'Saving…' : 'Save category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
