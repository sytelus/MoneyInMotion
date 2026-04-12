/**
 * Context menu for transaction rows.
 *
 * Provides quick access to editing actions (category, note, attributes,
 * flag) via a dropdown triggered by right-click or a "..." button.
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

export interface TransactionContextMenuProps extends TransactionContextMenuActions {
  /** Content to wrap as a context menu trigger (right-click). */
  children: React.ReactNode;
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
    {shortcut && (
      <span className="ml-auto text-xs text-muted-foreground">{shortcut}</span>
    )}
  </DropdownMenu.Item>
);

/**
 * Dropdown button ("...") that opens the context menu on click.
 * Can also be triggered as a context menu overlay from the parent element.
 */
export const TransactionContextMenuButton: React.FC<TransactionContextMenuActions & { title?: string }> = ({
  onEditCategory,
  onEditNote,
  onEditAttributes,
  onToggleFlag,
  onRemoveFlag,
  title,
}) => {
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

/**
 * Context menu wrapper. Wraps children so that right-clicking opens
 * the transaction editing menu.
 */
export const TransactionContextMenu: React.FC<TransactionContextMenuProps> = ({
  children,
  onEditCategory,
  onEditNote,
  onEditAttributes,
  onToggleFlag,
  onRemoveFlag,
}) => {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-md z-50"
          align="start"
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

TransactionContextMenu.displayName = 'TransactionContextMenu';
