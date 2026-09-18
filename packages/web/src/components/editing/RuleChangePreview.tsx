import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { manageRules, type RuleChange, type RuleChangeResult } from '../../api/client.js';
import { queryKeys } from '../../api/hooks.js';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { transactionReasonTitleLookup } from '@moneyinmotion/core';
import { formatCurrency, formatDate } from '../../lib/utils.js';

const valueLabels: Record<string, string> = {
  name: 'Merchant / name',
  amount: 'Amount',
  date: 'Date',
  reason: 'Transaction type',
  category: 'Category',
  note: 'Note',
  flagged: 'Marked for review',
};
function displayValue(key: string, value: unknown): string {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return 'None';
  if (Array.isArray(value)) return value.join(' / ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'amount' && typeof value === 'number') return formatCurrency(value);
  if (key === 'date' && typeof value === 'string') return formatDate(value);
  if (key === 'reason') return transactionReasonTitleLookup[String(value)] ?? String(value);
  return String(value);
}

export function RuleChangePreview({
  changes,
  onClose,
  onSaved,
}: {
  changes: RuleChange[];
  onClose: () => void;
  onSaved: (result: RuleChangeResult) => void;
}) {
  const client = useQueryClient();
  const [preview, setPreview] = useState<RuleChangeResult | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    manageRules(changes, true)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [changes]);
  const deleting = changes.every((c) => c.next === null);
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await manageRules(changes, false, preview?.revision);
      await client.invalidateQueries({ queryKey: queryKeys.transactions });
      onSaved(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        title={
          deleting
            ? `Delete ${changes.length} rule${changes.length === 1 ? '' : 's'}?`
            : 'Review rule changes'
        }
        description="Nothing has been saved yet. The server recalculates the full rule set for this preview."
        className="max-w-2xl"
      >
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {!preview && !error && <p role="status">Calculating effects…</p>}
        {preview && (
          <div className="space-y-3">
            <p className="text-lg font-semibold">
              {preview.affectedTransactionsCount.toLocaleString()} transaction
              {preview.affectedTransactionsCount === 1 ? '' : 's'} will change
            </p>
            <p className="text-sm text-muted-foreground">
              {deleting
                ? 'Deleting removes these rules and replays the remaining rules. Earlier rules may take effect again.'
                : 'Rules retain their order. Later rules take precedence when they change the same field.'}{' '}
              Original statements are not modified. Previous rule files are backed up on the server.
            </p>
            {preview.missingTargets > 0 && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                {preview.missingTargets} saved transaction references across the rule set are
                unavailable. These references are kept, but cannot change missing transactions.
                Review “Needs attention” in Rules.
              </p>
            )}
            {preview.affectedTransactionsCount === 0 && (
              <p className="text-sm">
                No current values change. The rule can still affect future imports or be overridden
                by a later rule.
              </p>
            )}
            {preview.samples.length > 0 && (
              <details open>
                <summary className="cursor-pointer text-sm font-medium">
                  Before / after sample (up to 10 transactions)
                </summary>
                <ul className="mt-2 space-y-3 text-sm">
                  {preview.samples.map((sample) => (
                    <li key={sample.id} className="rounded-md border border-border p-3">
                      <p className="font-medium break-words">
                        {String(sample.after['name'] ?? sample.before['name'] ?? sample.id)}
                      </p>
                      {Object.keys(sample.before)
                        .filter(
                          (key) =>
                            JSON.stringify(sample.before[key]) !==
                            JSON.stringify(sample.after[key]),
                        )
                        .map((key) => (
                          <p key={key} className="break-words">
                            <span className="font-medium">{valueLabels[key] ?? key}: </span>
                            {displayValue(key, sample.before[key])} →{' '}
                            {displayValue(key, sample.after[key])}
                          </p>
                        ))}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={deleting ? 'destructive' : 'default'}
            disabled={!preview || saving}
            onClick={() => {
              void save();
            }}
          >
            {saving ? 'Saving…' : deleting ? 'Delete rules' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
