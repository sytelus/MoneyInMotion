/**
 * Hook that registers global keyboard shortcuts for transaction navigation
 * and editing actions.
 *
 * Shortcuts are only active when no `<input>`, `<textarea>`, or other
 * interactive form element has focus (Escape is the exception so dialogs
 * can always be dismissed).
 *
 * The user-facing list of shortcuts lives in `lib/shortcuts.ts` and is
 * rendered by `KeyboardShortcutsDialog` and `WelcomePage`. The wiring
 * below must stay in sync with that list.
 *
 * @module
 */

import { useEffect, useEffectEvent } from 'react';

export interface KeyboardShortcutActions {
  /** Open the category editor dialog. */
  onEditCategory?: () => void;
  /** Open the note editor dialog. */
  onEditNote?: () => void;
  /** Open the attribute editor dialog. */
  onEditAttributes?: () => void;
  /** Toggle the user flag on the selected transaction. */
  onToggleFlag?: () => void;
  /** Remove the user flag from the selected transaction. */
  onRemoveFlag?: () => void;
  /** Close any open editing dialog. */
  onEscape?: () => void;
  /** Collapse the selected group (Left Arrow). */
  onCollapseGroup?: () => void;
  /** Expand the selected group (Right Arrow). */
  onExpandGroup?: () => void;
  /** Expand all group levels (Alt+Right Arrow). */
  onExpandAll?: () => void;
  /** Show the keyboard shortcuts help dialog. */
  onShowHelp?: () => void;
}

/**
 * Determine whether the event target is an interactive form element where
 * keyboard shortcuts should be suppressed.
 */
function isInputFocused(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
}

/**
 * Register global keyboard shortcuts for the application.
 *
 * @param actions - Callback map for each shortcut action.
 */
export function useKeyboardShortcuts(actions: KeyboardShortcutActions): void {
  const handleShortcut = useEffectEvent((event: KeyboardEvent): void => {
    const a = actions;

    // Escape always works, even in inputs (to close dialogs)
    if (event.key === 'Escape') {
      a.onEscape?.();
      return;
    }

    // All other shortcuts require no input focus
    if (isInputFocused(event)) return;

    // Arrow key shortcuts for group expand/collapse
    // Note: Up/Down arrow navigation is handled in TransactionList component
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      a.onCollapseGroup?.();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (event.altKey) {
        a.onExpandAll?.();
      } else {
        a.onExpandGroup?.();
      }
      return;
    }

    // `?` key — show help dialog
    if (event.key === '?') {
      event.preventDefault();
      a.onShowHelp?.();
      return;
    }

    // Alt+key shortcuts
    if (event.altKey) {
      switch (event.key.toLowerCase()) {
        case 't':
          event.preventDefault();
          a.onEditCategory?.();
          return;
        case 'n':
          event.preventDefault();
          a.onEditNote?.();
          return;
        case 'e':
          event.preventDefault();
          a.onEditAttributes?.();
          return;
        case 'f':
          event.preventDefault();
          if (event.shiftKey) {
            a.onRemoveFlag?.();
          } else {
            a.onToggleFlag?.();
          }
          return;
      }
    }
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      handleShortcut(event);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
