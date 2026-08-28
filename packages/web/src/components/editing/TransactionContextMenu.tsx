/**
 * Context menu for transaction rows.
 *
 * Provides quick access to editing actions (category, note, attributes, and
 * flag) through the transaction row's actions button.
 *
 * @module
 */

import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, Tag, StickyNote, Wrench, Flag, FlagOff } from 'lucide-react';

export interface TransactionContextMenuActions {
  /** Open the category editor. */
  onEditCategory: () => void;
  /** Open the note editor. */
  onEditNote: () => void;
  /** Open the attribute editor. */
  onEditAttributes: () => void;
  /** Toggle the user flag. */
  onToggleFlag: () => void;
  /** Remove the user flag. */
  onRemoveFlag: () => void;
}

/**
 * A Radix dropdown menu item styled consistently.
 */
const MenuItem: React.FC<{
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}> = ({ onSelect, icon, label, shortcut }) => (
  <DropdownMenu.Item
    className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer outline-none hover:bg-accent focus:bg-accent transition-colors"
    onSelect={onSelect}
  >
    {icon}
    <span className="flex-1">{label}</span>
    {shortcut && <span className="ml-auto text-xs text-muted-foreground">{shortcut}</span>}
  </DropdownMenu.Item>
);

/**
 * Dropdown button ("...") that opens the action menu on click.
 */
export const TransactionContextMenuButton: React.FC<
  TransactionContextMenuActions & { title?: string }
> = ({ onEditCategory, onEditNote, onEditAttributes, onToggleFlag, onRemoveFlag, title }) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none"
          aria-label="Transaction actions"
          title={title ?? 'Transaction actions'}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-md z-50"
          align="end"
          sideOffset={4}
        >
          <MenuItem
            onSelect={onEditCategory}
            icon={<Tag className="h-4 w-4" />}
            label="Edit Category"
            shortcut="Alt+T"
          />
          <MenuItem
            onSelect={onEditNote}
            icon={<StickyNote className="h-4 w-4" />}
            label="Edit Note"
            shortcut="Alt+N"
          />
          <MenuItem
            onSelect={onEditAttributes}
            icon={<Wrench className="h-4 w-4" />}
            label="Fix Attributes"
            shortcut="Alt+E"
          />

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <MenuItem
            onSelect={onToggleFlag}
            icon={<Flag className="h-4 w-4" />}
            label="Toggle Flag"
            shortcut="Alt+F"
          />
          <MenuItem
            onSelect={onRemoveFlag}
            icon={<FlagOff className="h-4 w-4" />}
            label="Remove Flag"
            shortcut="Alt+Shift+F"
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

TransactionContextMenuButton.displayName = 'TransactionContextMenuButton';
