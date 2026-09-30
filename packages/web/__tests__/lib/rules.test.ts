import { describe, expect, it } from 'vitest';
import { editValue, voidedEditValue } from '@moneyinmotion/core';
import { ruleChangesLabel } from '../../src/lib/rules.js';

describe('plain-language rule changes', () => {
  it('distinguishes clearing a value from restoring the imported value', () => {
    expect(ruleChangesLabel({ categoryPath: editValue([]) })).toBe('Category: clear value');
    expect(ruleChangesLabel({ categoryPath: voidedEditValue() })).toBe(
      'Category: restore imported value',
    );
    expect(ruleChangesLabel({ note: editValue('') })).toBe('Note: clear value');
  });
  it('keeps zero amounts and false flags meaningful', () => {
    expect(ruleChangesLabel({ amount: editValue(0) })).toBe('Amount: $0.00');
    expect(ruleChangesLabel({ isFlagged: editValue(false) })).toBe('Mark for review: No');
  });
});
