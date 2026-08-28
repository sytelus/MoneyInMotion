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
