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

export interface KeyboardShortcutsDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
  key: string;
  action: string;
}

const shortcuts: ShortcutEntry[] = [
  { key: 'Up/Down Arrow', action: 'Navigate transactions' },
  { key: 'Left/Right Arrow', action: 'Collapse/Expand groups' },
  { key: 'Alt+Right Arrow', action: 'Expand all levels' },
  { key: 'Alt+T', action: 'Edit category' },
  { key: 'Alt+N', action: 'Edit note' },
  { key: 'Alt+E', action: 'Fix attributes' },
  { key: 'Alt+F', action: 'Toggle flag' },
  { key: 'Alt+Shift+F', action: 'Remove flag' },
  { key: 'Escape', action: 'Close dialog' },
  { key: '?', action: 'Show this help' },
];

/**
 * A modal dialog that displays all available keyboard shortcuts in a
 * two-column table with styled `<kbd>` elements.
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
            {shortcuts.map((entry) => (
              <tr key={entry.key} className="border-b border-border last:border-b-0">
                <td className="py-2 pr-4">
                  <kbd className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                    {entry.key}
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
