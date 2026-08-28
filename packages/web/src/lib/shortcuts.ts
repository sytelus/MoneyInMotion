/**
 * Canonical list of keyboard shortcuts exposed to end users.
 *
 * Keeping this in one place prevents the Welcome page and the
 * in-app help dialog from drifting out of sync. If you add or rename a
 * shortcut in `useKeyboardShortcuts`, update this list too.
 *
 * @module
 */

/** A single user-facing keyboard shortcut entry. */
export interface ShortcutEntry {
  /** Human-readable key combination, e.g. `"Alt+T"` or `"Up / Down"`. */
  readonly keys: string;
  /** Short description of what the shortcut does. */
  readonly action: string;
}

/** Canonical shortcut reference, ordered by expected frequency of use. */
export const KEYBOARD_SHORTCUTS: readonly ShortcutEntry[] = [
  { keys: 'Up / Down', action: 'Navigate transactions' },
  { keys: 'Left / Right', action: 'Collapse / Expand group' },
  { keys: 'Alt + Right', action: 'Expand all nested levels' },
  { keys: 'Alt + T', action: 'Edit category' },
  { keys: 'Alt + N', action: 'Edit note' },
  { keys: 'Alt + E', action: 'Fix attributes' },
  { keys: 'Alt + F', action: 'Toggle flag' },
  { keys: 'Alt + Shift + F', action: 'Remove flag' },
  { keys: 'Escape', action: 'Close dialog' },
  { keys: '?', action: 'Show this keyboard shortcuts help' },
];
