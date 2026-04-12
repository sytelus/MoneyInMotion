/**
 * Dialog listing all available keyboard shortcuts.
 *
 * Can be opened by pressing `?` (when no input is focused) or by clicking
 * the help button in the header.
 *
 * @module
 */

import React from 'react';
import { Dialog, DialogContent } from '../ui/dialog.js';
import { KEYBOARD_SHORTCUTS } from '../../lib/shortcuts.js';

export interface KeyboardShortcutsDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
}

/**
 * A modal dialog that displays all available keyboard shortcuts in a
 * two-column table with styled `<kbd>` elements. The shortcut list itself
 * lives in `lib/shortcuts.ts` so it stays in sync with the Welcome page.
 */
export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Keyboard Shortcuts" description="Quick reference for all available shortcuts.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Key</th>
              <th className="text-left py-2 text-muted-foreground font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {KEYBOARD_SHORTCUTS.map((entry) => (
              <tr key={entry.keys} className="border-b border-border last:border-b-0">
                <td className="py-2 pr-4">
                  <kbd className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                    {entry.keys}
                  </kbd>
                </td>
                <td className="py-2">{entry.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
};

KeyboardShortcutsDialog.displayName = 'KeyboardShortcutsDialog';
