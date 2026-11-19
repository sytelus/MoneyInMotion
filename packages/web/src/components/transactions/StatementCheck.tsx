import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Transactions } from '@moneyinmotion/core';
import { useManageRules } from '../../api/hooks.js';
import { FLAGGED, type CardStatement } from '../../lib/card-statements.js';
import { statementCheckChange } from '../../lib/statement-checks.js';
import { formatCurrency } from '../../lib/utils.js';
import { Button } from '../ui/button.js';
import { Textarea } from '../ui/textarea.js';

/**
 * Mark a statement that doesn't add up as checked, with a note on what you
 * found; or change the note, or undo the check. Starts with the note open
 * when `startEditing` is set.
 */
export function StatementCheck({
  statement,
  transactions,
  startEditing = false,
  onClose,
}: {
  statement: CardStatement;
  transactions: Transactions;
  startEditing?: boolean;
  onClose?: () => void;
}) {
  const manageRules = useManageRules();
  const check = statement.check;
  const [editing, setEditing] = useState(startEditing);
  const [note, setNote] = useState(check?.current ? check.note : '');
  const [error, setError] = useState<string | null>(null);
  if (!FLAGGED.has(statement.status) && !check) return null;

  const save = (value: string | null) => {
    const change = statementCheckChange(transactions, statement, value);
    if (!change) return;
    setError(null);
    manageRules.mutate([change], {
      onSuccess: () => {
        setEditing(false);
        onClose?.();
      },
      onError: (failure) =>
        setError(failure instanceof Error ? failure.message : 'The check could not be saved.'),
    });
  };

  const difference = formatCurrency(statement.unresolved);
  return (
    <div className="mt-2 space-y-2 text-xs">
      {check?.current && !editing && (
        <p className="flex items-start gap-1.5 text-emerald-900">
          <CheckCircle2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Checked: the {difference} difference is accepted.
            {check.note ? ` ${check.note}` : ''}
          </span>
        </p>
      )}
      {check && !check.current && FLAGGED.has(statement.status) && (
        <p className="text-muted-foreground">
          Checked earlier, when the difference was {formatCurrency(check.difference)}
          {check.note ? `: ${check.note}` : '.'} The difference has changed since, so it needs
          another look.
        </p>
      )}
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            save(note);
          }}
        >
          <label className="block font-medium" htmlFor={`check-${statement.id}`}>
            What did you find? (optional)
          </label>
          <Textarea
            id={`check-${statement.id}`}
            rows={2}
            maxLength={2000}
            value={note}
            placeholder="For example: a $25 credit that isn’t in the export"
            onChange={(event) => setNote(event.target.value)}
          />
          <p className="text-muted-foreground">
            The {difference} difference is accepted and the statement leaves the review list. If a
            later import changes the difference, the statement comes back.
          </p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={manageRules.isPending}>
              {manageRules.isPending ? 'Saving…' : 'Mark as checked'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                onClose?.();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : check?.current ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit note
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={manageRules.isPending}
            onClick={() => save(null)}
          >
            Undo check
          </Button>
        </div>
      ) : (
        FLAGGED.has(statement.status) && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Mark as checked…
          </Button>
        )
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error} Nothing was changed.
        </p>
      )}
    </div>
  );
}
