/**
 * Confirmation dialog shown when an edit affects multiple transactions.
 *
 * Displays a count and scrollable list of affected transaction names
 * so the user can verify before proceeding.
 *
 * @module
 */

import React from 'react';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { Button } from '../ui/button.js';

export interface EditConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to close the dialog. */
  onOpenChange: (open: boolean) => void;
  /** Total number of transactions affected by the edit. */
  affectedCount: number;
  /** Names of affected transactions (a representative sample). */
  affectedNames: string[];
  /** Callback invoked when the user confirms the edit. */
  onConfirm: () => void;
  /** Whether a save operation is in progress. */
  isPending?: boolean;
}

/** Maximum number of names to display in the scrollable list. */
const MAX_DISPLAYED_NAMES = 10;

/**
 * A confirmation dialog that warns the user when an edit will affect
 * multiple transactions, showing a count and preview of affected names.
 */
export const EditConfirmDialog: React.FC<EditConfirmDialogProps> = ({
  open,
  onOpenChange,
  affectedCount,
  affectedNames,
  onConfirm,
  isPending = false,
}) => {
  const displayedNames = affectedNames.slice(0, MAX_DISPLAYED_NAMES);
  const remainingCount = affectedCount - displayedNames.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Confirm Edit">
        <div className="space-y-4">
          <p className="text-sm">
            This edit will affect{' '}
            <span className="font-semibold text-foreground">{affectedCount}</span>{' '}
            transaction{affectedCount !== 1 ? 's' : ''}.
          </p>

          {displayedNames.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-border">
              <ul className="divide-y divide-border">
                {displayedNames.map((name, idx) => (
                  <li
                    key={`${name}-${idx}`}
                    className="px-3 py-1.5 text-sm text-foreground"
                  >
                    {name}
                  </li>
                ))}
              </ul>
              {remainingCount > 0 && (
                <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border">
                  ...and {remainingCount} more
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Applying...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

EditConfirmDialog.displayName = 'EditConfirmDialog';
