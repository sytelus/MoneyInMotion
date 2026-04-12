import { describe, it, expect } from 'vitest';
import {
  ScopeType,
  validateScopeFilter,
  createScopeFilter,
  editValue,
  voidedEditValue,
  mergeEditedValues,
  type EditedValues,
} from '../../src/models/transaction-edit.js';

// ---------------------------------------------------------------------------
// ScopeFilter validation
// ---------------------------------------------------------------------------

describe('validateScopeFilter', () => {
  it('should accept zero parameters for ScopeType.None', () => {
    expect(validateScopeFilter(ScopeType.None, [])).toBe('');
  });

  it('should accept zero parameters for ScopeType.All', () => {
    expect(validateScopeFilter(ScopeType.All, [])).toBe('');
  });

  it('should reject non-zero parameters for ScopeType.None', () => {
    const err = validateScopeFilter(ScopeType.None, ['oops']);
    expect(err).not.toBe('');
    expect(err).toContain('no more than 0');
  });

  it('should accept one or more parameters for TransactionId', () => {
    expect(validateScopeFilter(ScopeType.TransactionId, ['id-1'])).toBe('');
    expect(validateScopeFilter(ScopeType.TransactionId, ['id-1', 'id-2'])).toBe('');
  });

  it('should reject zero parameters for TransactionId', () => {
    const err = validateScopeFilter(ScopeType.TransactionId, []);
    expect(err).not.toBe('');
    expect(err).toContain('at least 1');
  });

  it('should require 2 or 3 parameters for AmountRange', () => {
    expect(validateScopeFilter(ScopeType.AmountRange, ['0', '100'])).toBe('');
    expect(validateScopeFilter(ScopeType.AmountRange, ['0', '100', 'true'])).toBe('');

    const errTooFew = validateScopeFilter(ScopeType.AmountRange, ['0']);
    expect(errTooFew).not.toBe('');

    const errTooMany = validateScopeFilter(ScopeType.AmountRange, ['0', '100', 'true', 'extra']);
    expect(errTooMany).not.toBe('');
  });

  it('should accept parameters for EntityName', () => {
    expect(validateScopeFilter(ScopeType.EntityName, ['Walmart'])).toBe('');
  });

  it('should accept parameters for EntityNameNormalized', () => {
    expect(validateScopeFilter(ScopeType.EntityNameNormalized, ['walmart'])).toBe('');
  });

  it('should accept parameters for EntityNameAnyTokens', () => {
    expect(validateScopeFilter(ScopeType.EntityNameAnyTokens, ['wal', 'mart'])).toBe('');
  });

  it('should accept parameters for EntityNameAllTokens', () => {
    expect(validateScopeFilter(ScopeType.EntityNameAllTokens, ['wal'])).toBe('');
  });

  it('should accept parameters for AccountId', () => {
    expect(validateScopeFilter(ScopeType.AccountId, ['acct-1'])).toBe('');
  });

  it('should accept parameters for TransactionReason', () => {
    expect(validateScopeFilter(ScopeType.TransactionReason, ['2'])).toBe('');
  });
});

// ---------------------------------------------------------------------------
// createScopeFilter factory
// ---------------------------------------------------------------------------

describe('createScopeFilter', () => {
  it('should create a valid ScopeFilter for TransactionId', () => {
    const filter = createScopeFilter(ScopeType.TransactionId, ['id-1', 'id-2']);
    expect(filter.type).toBe(ScopeType.TransactionId);
    expect(filter.parameters).toEqual(['id-1', 'id-2']);
    expect(filter.referenceParameters).toBeNull();
    expect(filter.contentHash).toBeDefined();
    expect(filter.contentHash.length).toBeGreaterThan(0);
  });

  it('should include referenceParameters when provided', () => {
    const filter = createScopeFilter(
      ScopeType.EntityName,
      ['Walmart'],
      ['ref-1'],
    );
    expect(filter.referenceParameters).toEqual(['ref-1']);
  });

  it('should throw when parameter count is invalid', () => {
    expect(() => createScopeFilter(ScopeType.AmountRange, ['0'])).toThrow(
      /EditScope parameters are invalid/,
    );
  });

  it('should throw when zero parameters given for a scope that requires them', () => {
    expect(() => createScopeFilter(ScopeType.TransactionId, [])).toThrow(
      /EditScope parameters are invalid/,
    );
  });

  it('should not mutate the input parameter array', () => {
    const params = ['id-1'];
    const filter = createScopeFilter(ScopeType.TransactionId, params);
    params.push('id-2');
    expect(filter.parameters).toEqual(['id-1']);
  });

  it('should produce a deterministic contentHash for the same inputs', () => {
    const f1 = createScopeFilter(ScopeType.EntityName, ['Walmart']);
    const f2 = createScopeFilter(ScopeType.EntityName, ['Walmart']);
    expect(f1.contentHash).toBe(f2.contentHash);
  });

  it('should produce different contentHash for different inputs', () => {
    const f1 = createScopeFilter(ScopeType.EntityName, ['Walmart']);
    const f2 = createScopeFilter(ScopeType.EntityName, ['Target']);
    expect(f1.contentHash).not.toBe(f2.contentHash);
  });
});

// ---------------------------------------------------------------------------
// EditedValues merge
// ---------------------------------------------------------------------------

describe('mergeEditedValues', () => {
  it('Case 1: source field not null + not voided applies source value', () => {
    const target: EditedValues = {
      entityName: editValue('Old Name'),
    };
    const source: EditedValues = {
      entityName: editValue('New Name'),
    };

    mergeEditedValues(target, source);
    expect(target.entityName).not.toBeNull();
    expect(target.entityName!.value).toBe('New Name');
    expect(target.entityName!.isVoided).toBe(false);
  });

  it('Case 2: source field null keeps target value unchanged', () => {
    const target: EditedValues = {
      entityName: editValue('Keep Me'),
      amount: editValue(42.5),
    };
    const source: EditedValues = {
      entityName: null,
      // amount not present at all (undefined)
    };

    mergeEditedValues(target, source);
    expect(target.entityName!.value).toBe('Keep Me');
    expect(target.amount!.value).toBe(42.5);
  });

  it('Case 3: source field not null + voided reverts target field to null', () => {
    const target: EditedValues = {
      entityName: editValue('Will be reverted'),
      note: editValue('Also reverted'),
    };
    const source: EditedValues = {
      entityName: voidedEditValue<string>(),
      note: voidedEditValue<string>(),
    };

    mergeEditedValues(target, source);
    expect(target.entityName).toBeNull();
    expect(target.note).toBeNull();
  });

  it('should merge all 7 fields independently', () => {
    const target: EditedValues = {
      transactionReason: editValue(2),
      transactionDate: editValue('2024-01-01T00:00:00.000Z'),
      amount: editValue(100),
      entityName: editValue('Old'),
      isFlagged: editValue(true),
      note: editValue('old note'),
      categoryPath: editValue(['Food', 'Groceries']),
    };

    const source: EditedValues = {
      transactionReason: editValue(4),           // Case 1: apply
      transactionDate: null,                      // Case 2: keep
      amount: voidedEditValue<number>(),          // Case 3: revert
      entityName: editValue('New'),               // Case 1: apply
      isFlagged: null,                            // Case 2: keep
      note: voidedEditValue<string>(),            // Case 3: revert
      categoryPath: editValue(['Transport']),     // Case 1: apply
    };

    mergeEditedValues(target, source);

    // Case 1: applied
    expect(target.transactionReason!.value).toBe(4);
    expect(target.entityName!.value).toBe('New');
    expect(target.categoryPath!.value).toEqual(['Transport']);

    // Case 2: unchanged
    expect(target.transactionDate!.value).toBe('2024-01-01T00:00:00.000Z');
    expect(target.isFlagged!.value).toBe(true);

    // Case 3: reverted
    expect(target.amount).toBeNull();
    expect(target.note).toBeNull();
  });

  it('should handle merging into an empty target', () => {
    const target: EditedValues = {};
    const source: EditedValues = {
      entityName: editValue('Brand New'),
      isFlagged: editValue(false),
    };

    mergeEditedValues(target, source);
    expect(target.entityName!.value).toBe('Brand New');
    expect(target.isFlagged!.value).toBe(false);
    // Unset fields remain undefined
    expect(target.amount).toBeUndefined();
  });

  it('should return the target for chaining', () => {
    const target: EditedValues = {};
    const result = mergeEditedValues(target, { entityName: editValue('Test') });
    expect(result).toBe(target);
  });

  it('should merge a voided value into another voided value (both remain null)', () => {
    const target: EditedValues = {
      entityName: editValue('Will be voided'),
    };
    // First void the field
    mergeEditedValues(target, { entityName: voidedEditValue<string>() });
    expect(target.entityName).toBeNull();

    // Void it again -- should still be null
    mergeEditedValues(target, { entityName: voidedEditValue<string>() });
    expect(target.entityName).toBeNull();
  });

  it('should leave target unchanged when all source fields are undefined', () => {
    const target: EditedValues = {
      entityName: editValue('Unchanged'),
      amount: editValue(99),
      note: editValue('Keep'),
    };
    const source: EditedValues = {};

    mergeEditedValues(target, source);
    expect(target.entityName!.value).toBe('Unchanged');
    expect(target.amount!.value).toBe(99);
    expect(target.note!.value).toBe('Keep');
  });

  it('should support chaining 3 sequential merges', () => {
    const target: EditedValues = {};

    // Merge 1: set entityName
    mergeEditedValues(target, { entityName: editValue('First') });
    expect(target.entityName!.value).toBe('First');

    // Merge 2: override entityName, set note
    mergeEditedValues(target, {
      entityName: editValue('Second'),
      note: editValue('a note'),
    });
    expect(target.entityName!.value).toBe('Second');
    expect(target.note!.value).toBe('a note');

    // Merge 3: void entityName, keep note, set amount
    mergeEditedValues(target, {
      entityName: voidedEditValue<string>(),
      amount: editValue(42),
    });
    expect(target.entityName).toBeNull();
    expect(target.note!.value).toBe('a note');
    expect(target.amount!.value).toBe(42);
  });
});
