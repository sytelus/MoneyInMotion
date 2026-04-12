/**
 * Dialog for editing transaction notes.
 *
 * Notes are always scoped to a single transaction (TransactionId scope).
 * Provides a textarea for the note and a button to remove an existing note.
 *
 * @module
 */

import React, { useState } from 'react';
import {
  ScopeType,
  createScopeFilter,
  editValue,
  voidedEditValue,
  type Transaction,
  type TransactionEditData,
} from '@moneyinmotion/core';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Textarea } from '../ui/textarea.js';
import { useApplyEdits } from '../../api/hooks.js';
import { generateEditId } from '../../lib/utils.js';

export interface NoteEditorProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to close the dialog. */
  onOpenChange: (open: boolean) => void;
  /** The transaction to edit. */
  transaction: Transaction;
}

/**
 * Dialog for editing or removing a transaction's note. The scope is always
 * limited to the single transaction (TransactionId).
 */
export const NoteEditor: React.FC<NoteEditorProps> = ({
  open,
  onOpenChange,
  transaction,
}) => {
  const [noteText, setNoteText] = useState(transaction.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const applyEdits = useApplyEdits();

  const handleSave = () => {
    const scopeFilters = [createScopeFilter(ScopeType.TransactionId, [transaction.id])];

    const edit: TransactionEditData = {
      id: generateEditId(),
      auditInfo: {
        createDate: new Date().toISOString(),
        createdBy: 'web-ui',
      },
      scopeFilters,
      values: {
        note: editValue(noteText),
      },
      sourceId: 'web-ui',
    };

    setError(null);
    applyEdits.mutate([edit], {
      onSuccess: () => {
        onOpenChange(false);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to save note');
      },
    });
  };

  const handleRemoveNote = () => {
    const scopeFilters = [createScopeFilter(ScopeType.TransactionId, [transaction.id])];

    const edit: TransactionEditData = {
      id: generateEditId(),
      auditInfo: {
        createDate: new Date().toISOString(),
        createdBy: 'web-ui',
      },
      scopeFilters,
      values: {
        note: voidedEditValue<string>(),
      },
      sourceId: 'web-ui',
    };

    setError(null);
    applyEdits.mutate([edit], {
      onSuccess: () => {
        onOpenChange(false);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to remove note');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit Note" description={`Note for "${transaction.displayEntityNameNormalized}"`}>
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="note-input" className="text-sm font-medium">
              Note
            </label>
            <Textarea
              id="note-input"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Enter a note for this transaction..."
              rows={4}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="justify-between">
          <div>
            {transaction.note && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveNote}
                disabled={applyEdits.isPending}
              >
                Remove Note
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!noteText.trim() || applyEdits.isPending}
            >
              {applyEdits.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

NoteEditor.displayName = 'NoteEditor';
