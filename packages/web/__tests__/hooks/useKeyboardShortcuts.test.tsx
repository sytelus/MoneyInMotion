import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../src/hooks/useKeyboardShortcuts.js';

afterEach(cleanup);

function dispatchKey(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  document.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  it('leaves dialog Escape handling and already-consumed keys to their owner', () => {
    const onEscape = vi.fn();
    const onEditNote = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onEscape, onEditNote }));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onEscape).not.toHaveBeenCalled();
    dialog.remove();
    const consumed = new KeyboardEvent('keydown', {
      key: 'n',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    consumed.preventDefault();
    document.dispatchEvent(consumed);
    expect(onEditNote).not.toHaveBeenCalled();
    dispatchKey('Escape');
    expect(onEscape).toHaveBeenCalledOnce();
  });
  it('does not consume keys when the mounted caller has no matching action', () => {
    renderHook(() => useKeyboardShortcuts({ onEditNote: vi.fn() }));

    expect(dispatchKey('?').defaultPrevented).toBe(false);
    expect(dispatchKey('ArrowLeft').defaultPrevented).toBe(false);
    expect(dispatchKey('t', { altKey: true }).defaultPrevented).toBe(false);
  });

  it('invokes and consumes a registered shortcut', () => {
    const onShowHelp = vi.fn();
    const onEditCategory = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onShowHelp, onEditCategory }));

    expect(dispatchKey('?').defaultPrevented).toBe(true);
    expect(dispatchKey('t', { altKey: true }).defaultPrevented).toBe(true);
    expect(onShowHelp).toHaveBeenCalledOnce();
    expect(onEditCategory).toHaveBeenCalledOnce();
  });

  it('suppresses editing shortcuts while a form field has focus', () => {
    const onEditNote = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onEditNote }));
    const input = document.createElement('input');
    document.body.append(input);

    const event = new KeyboardEvent('keydown', {
      key: 'n',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(onEditNote).not.toHaveBeenCalled();
    input.remove();
  });
});
