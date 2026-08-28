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
  /** Show the keyboard shortcuts help dialog. */
  onShowHelp?: () => void;
}

/**
 * Determine whether the event target is an interactive form element where
 * keyboard shortcuts should be suppressed.
 */
function isInputFocused(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
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

    // `?` key — show help dialog
    if (event.key === '?' && a.onShowHelp) {
      event.preventDefault();
      a.onShowHelp();
      return;
    }

    // Alt+key shortcuts
    if (event.altKey) {
      switch (event.key.toLowerCase()) {
        case 't':
          if (!a.onEditCategory) return;
          event.preventDefault();
          a.onEditCategory();
          return;
        case 'n':
          if (!a.onEditNote) return;
          event.preventDefault();
          a.onEditNote();
          return;
        case 'e':
          if (!a.onEditAttributes) return;
          event.preventDefault();
          a.onEditAttributes();
          return;
        case 'f':
          if (event.shiftKey) {
            if (!a.onRemoveFlag) return;
            event.preventDefault();
            a.onRemoveFlag();
          } else {
            if (!a.onToggleFlag) return;
            event.preventDefault();
            a.onToggleFlag();
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
