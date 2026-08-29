import { describe, it, expect } from 'vitest';
import { Transaction, type ImportedValues } from '../../src/models/transaction.js';
import { TransactionReason, UnknownAdjustment } from '../../src/models/transaction-reason.js';
import { editValue, type TransactionEditData } from '../../src/models/transaction-edit.js';
import { createAuditInfo } from '../../src/models/audit-info.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImportedValues(overrides?: Partial<ImportedValues>): ImportedValues {
  return {
    amount: -25.99,
    transactionDate: '2024-03-15',
    entityName: 'WHOLE FOODS MKT 10234',
    transactionReason: TransactionReason.Purchase,
    ...overrides,
  };
}

function makeTransaction(overrides?: Partial<ImportedValues>): Transaction {
  return Transaction.create('import-001', 'acct-amex', false, makeImportedValues(overrides));
}

function makeEdit(overrides?: Partial<TransactionEditData>): TransactionEditData {
  return {
    id: 'edit-001',
    auditInfo: createAuditInfo(),
    scopeFilters: [],
    values: {},
    sourceId: 'test',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe('Transaction.create', () => {
  it('should construct a transaction from imported values', () => {
    const tx = makeTransaction();

    expect(tx.accountId).toBe('acct-amex');
    expect(tx.importId).toBe('import-001');
    expect(tx.amount).toBe(-25.99);
    expect(tx.entityName).toBe('WHOLE FOODS MKT 10234');
    expect(tx.transactionReason).toBe(TransactionReason.Purchase);
    expect(tx.transactionDate).toBe('2024-03-15');
  });

  it('should compute entityNameNormalized automatically', () => {
    const tx = makeTransaction();
    // "WHOLE FOODS MKT 10234" => all-uppercase, no dots => title case
    // "10234" is 5 digits => stripped from last token
    expect(tx.entityNameNormalized).toBe('Whole Foods Mkt');
  });

  it('should use provided entityNameNormalized if given', () => {
    const tx = makeTransaction({ entityNameNormalized: 'Custom Name' });
    expect(tx.entityNameNormalized).toBe('Custom Name');
  });

  it('should generate a non-empty id', () => {
    const tx = makeTransaction();
    expect(tx.id).toBeTruthy();
    expect(tx.id.length).toBeGreaterThan(0);
  });

  it('should generate a non-empty contentHash', () => {
    const tx = makeTransaction();
    expect(tx.contentHash).toBeTruthy();
    expect(tx.contentHash.length).toBeGreaterThan(0);
  });

  it('should produce deterministic id for same input', () => {
    const tx1 = makeTransaction();
    const tx2 = makeTransaction();
    expect(tx1.id).toBe(tx2.id);
    expect(tx1.contentHash).toBe(tx2.contentHash);
  });

  it('reproduces the persisted C# content hash and ID contract', () => {
    const tx = Transaction.create('7c6478f179c10dba372a3cad488cfdd8', 'Amazon-Orders', true, {
      amount: -40.93,
      transactionDate: '2003-03-12T08:00:00.000Z',
      entityName:
        'Amazon Order# 104-9025610-6117534, Shipment# DHL (Delivered by USPS)(98012084925)',
      transactionReason: TransactionReason.Purchase,
      instituteReference: '104-9025610-6117534|DHL (Delivered by USPS)(98012084925)',
      lineNumber: 1,
    });

    expect(tx.contentHash).toBe('396c5461d423a6c1b6536f3866eb201f');
    expect(tx.id).toBe('fb1ebea756951272f1d30ae706d6d08b');
  });

  it('should produce different ids for different amounts', () => {
    const tx1 = makeTransaction({ amount: -10 });
    const tx2 = makeTransaction({ amount: -20 });
    expect(tx1.id).not.toBe(tx2.id);
  });

  it('should throw when amount is missing', () => {
    expect(() => {
      Transaction.create('import-001', 'acct', false, {
        amount: null as unknown as number,
        transactionDate: '2024-01-01',
        entityName: 'Test',
        transactionReason: TransactionReason.Purchase,
      });
    }).toThrow(/Amount must have value/);
  });

  it('should throw when entityName is empty', () => {
    expect(() => {
      Transaction.create('import-001', 'acct', false, {
        amount: -10,
        transactionDate: '2024-01-01',
        entityName: '',
        transactionReason: TransactionReason.Purchase,
      });
    }).toThrow(/EntityName must have value/);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Transaction validation', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'should reject a non-finite amount (%s)',
    (amount) => {
      expect(() => makeTransaction({ amount })).toThrow(/finite number/i);
    },
  );

  it('should reject a non-integer transaction reason', () => {
    expect(() => makeTransaction({ transactionReason: 1.5 })).toThrow(/must be an integer/i);
  });

  it('should throw when positive amount has outgoing reason (non-Purchase)', () => {
    expect(() => {
      makeTransaction({
        amount: 50,
        transactionReason: TransactionReason.Fee,
      });
    }).toThrow(/positive.*outgoing/i);
  });

  it('should throw when negative amount has incoming reason', () => {
    expect(() => {
      makeTransaction({
        amount: -50,
        transactionReason: TransactionReason.Return,
      });
    }).toThrow(/negative.*incoming/i);
  });

  it('should throw when reason is UnknownAdjustment', () => {
    expect(() => {
      makeTransaction({
        amount: -10,
        transactionReason: UnknownAdjustment,
      });
    }).toThrow(/UnknownAdjustment/);
  });

  it('should allow Purchase with negative amount (the default outgoing)', () => {
    expect(() =>
      makeTransaction({ amount: -10, transactionReason: TransactionReason.Purchase }),
    ).not.toThrow();
  });

  it('should allow Return with positive amount (incoming)', () => {
    expect(() =>
      makeTransaction({ amount: 10, transactionReason: TransactionReason.Return }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Content hash
// ---------------------------------------------------------------------------

describe('Content hash computation', () => {
  it('should compute consistent content hashes', () => {
    const fields = ['acct-1', '0', '-25.99', 'WHOLE FOODS', '', '2024-03-15 00:00:00Z', ''];
    const hash1 = Transaction.computeContentHash(fields);
    const hash2 = Transaction.computeContentHash(fields);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different content', () => {
    const fields1 = ['acct-1', '0', '-25.99', 'WHOLE FOODS', '', '2024-03-15 00:00:00Z', ''];
    const fields2 = ['acct-1', '0', '-35.99', 'WHOLE FOODS', '', '2024-03-15 00:00:00Z', ''];
    expect(Transaction.computeContentHash(fields1)).not.toBe(
      Transaction.computeContentHash(fields2),
    );
  });
});

// ---------------------------------------------------------------------------
// applyEdit
// ---------------------------------------------------------------------------

describe('Transaction.applyEdit', () => {
  it('should apply an entity name edit', () => {
    const tx = makeTransaction();
    const edit = makeEdit({
      values: { entityName: editValue('Whole Foods Market') },
    });

    tx.applyEdit(edit);

    expect(tx.correctedEntityName).toBe('Whole Foods Market');
    expect(tx.displayEntityNameNormalized).toBe('Whole Foods Market');
  });

  it('should expose edited amount and reason as effective values', () => {
    const tx = makeTransaction();
    tx.applyEdit(
      makeEdit({
        values: {
          amount: editValue(-19.25),
          transactionReason: editValue(TransactionReason.Fee),
        },
      }),
    );

    expect(tx.amount).toBe(-25.99);
    expect(tx.transactionReason).toBe(TransactionReason.Purchase);
    expect(tx.correctedAmount).toBe(-19.25);
    expect(tx.correctedTransactionReason).toBe(TransactionReason.Fee);
  });

  it('should record edit id in appliedEditIdsDescending', () => {
    const tx = makeTransaction();
    tx.applyEdit(makeEdit({ id: 'edit-A' }));
    tx.applyEdit(makeEdit({ id: 'edit-B' }));

    expect(tx.appliedEditIdsDescending).toEqual(['edit-B', 'edit-A']);
  });

  it('should ignore reapplying the same edit id', () => {
    const tx = makeTransaction();
    const edit = makeEdit({
      id: 'edit-A',
      values: { note: editValue('Deduped note') },
    });

    tx.applyEdit(edit);
    const firstUpdateDate = tx.auditInfo.updateDate;
    tx.applyEdit(edit);

    expect(tx.note).toBe('Deduped note');
    expect(tx.appliedEditIdsDescending).toEqual(['edit-A']);
    expect(tx.auditInfo.updateDate).toBe(firstUpdateDate);
  });

  it('should update auditInfo on edit', () => {
    const tx = makeTransaction();
    const originalCreateDate = tx.auditInfo.createDate;

    tx.applyEdit(makeEdit());

    expect(tx.auditInfo.createDate).toBe(originalCreateDate);
    expect(tx.auditInfo.updateDate).toBeTruthy();
  });

  it('should apply isFlagged edit', () => {
    const tx = makeTransaction();
    expect(tx.isUserFlagged).toBeNull();

    tx.applyEdit(
      makeEdit({
        values: { isFlagged: editValue(true) },
      }),
    );

    expect(tx.isUserFlagged).toBe(true);
  });

  it('should apply categoryPath edit', () => {
    const tx = makeTransaction();
    expect(tx.categoryPath).toEqual([]);

    tx.applyEdit(
      makeEdit({
        values: { categoryPath: editValue(['Food', 'Groceries']) },
      }),
    );

    expect(tx.categoryPath).toEqual(['Food', 'Groceries']);
  });

  it('should apply note edit', () => {
    const tx = makeTransaction();
    expect(tx.note).toBeNull();

    tx.applyEdit(
      makeEdit({
        values: { note: editValue('Weekly shopping') },
      }),
    );

    expect(tx.note).toBe('Weekly shopping');
  });
});

// ---------------------------------------------------------------------------
// Display properties
// ---------------------------------------------------------------------------

describe('Display properties', () => {
  it('correctedEntityName returns null when no edit', () => {
    const tx = makeTransaction();
    expect(tx.correctedEntityName).toBeNull();
  });

  it('displayEntityNameNormalized falls back to entityNameNormalized', () => {
    const tx = makeTransaction();
    expect(tx.displayEntityNameNormalized).toBe(tx.entityNameNormalized);
  });

  it('categoryPath returns empty array when no edit', () => {
    const tx = makeTransaction();
    expect(tx.categoryPath).toEqual([]);
  });

  it('correctedTransactionDate falls back to transactionDate', () => {
    const tx = makeTransaction();
    expect(tx.correctedTransactionDate).toBe('2024-03-15');
  });

  it('correctedTransactionDate uses edited date when present', () => {
    const tx = makeTransaction();
    tx.applyEdit(
      makeEdit({
        values: { transactionDate: editValue('2024-04-01') },
      }),
    );
    expect(tx.correctedTransactionDate).toBe('2024-04-01');
  });

  it('entityNameTokens splits displayEntityNameNormalized', () => {
    const tx = makeTransaction();
    // displayEntityNameNormalized is "Whole Foods Mkt"
    expect(tx.entityNameTokens).toEqual(['Whole', 'Foods', 'Mkt']);
  });
});

// ---------------------------------------------------------------------------
// Clone
// ---------------------------------------------------------------------------

describe('Transaction.clone', () => {
  it('should produce an independent deep copy', () => {
    const tx = makeTransaction();
    tx.applyEdit(
      makeEdit({
        values: {
          categoryPath: editValue(['Food']),
          isFlagged: editValue(true),
        },
      }),
    );

    const cloned = tx.clone();

    // Values should be equal
    expect(cloned.id).toBe(tx.id);
    expect(cloned.amount).toBe(tx.amount);
    expect(cloned.categoryPath).toEqual(tx.categoryPath);
    expect(cloned.isUserFlagged).toBe(tx.isUserFlagged);

    // Modifying the clone should not affect the original
    cloned.applyEdit(
      makeEdit({
        id: 'edit-clone-only',
        values: { entityName: editValue('Modified Name') },
      }),
    );

    expect(cloned.correctedEntityName).toBe('Modified Name');
    expect(tx.correctedEntityName).not.toBe('Modified Name');
  });
});

// ---------------------------------------------------------------------------
// fromData round-trip
// ---------------------------------------------------------------------------

describe('Transaction.fromData', () => {
  it('should reconstruct a transaction from serialised data', () => {
    const tx = makeTransaction();
    const data = tx.toData();
    const restored = Transaction.fromData(data);

    expect(restored.id).toBe(tx.id);
    expect(restored.amount).toBe(tx.amount);
    expect(restored.entityName).toBe(tx.entityName);
    expect(restored.entityNameNormalized).toBe(tx.entityNameNormalized);
    expect(restored.contentHash).toBe(tx.contentHash);
  });

  it('rejects malformed legacy dictionaries instead of silently dropping entries', () => {
    const data = makeTransaction().toData();
    data.providerAttributes = [{ Key: '', Value: 'value' }] as unknown as Record<string, string>;

    expect(() => Transaction.fromData(data)).toThrow(/malformed legacy dictionary/i);
  });

  it('rejects invalid persisted transaction and posted dates', () => {
    const invalidTransactionDate = makeTransaction().toData();
    invalidTransactionDate.transactionDate = '2024-02-30';
    expect(() => Transaction.fromData(invalidTransactionDate)).toThrow(/TransactionDate/i);

    const invalidPostedDate = makeTransaction().toData();
    invalidPostedDate.postedDate = 'not-a-date';
    expect(() => Transaction.fromData(invalidPostedDate)).toThrow(/PostedDate/i);
  });

  it.each([
    ['amount', '12.50', /finite number/i],
    ['requiresParent', 'false', /RequiresParent/i],
    ['lineNumber', 1.5, /LineNumber/i],
    ['lineItemType', 99, /LineItemType/i],
    ['appliedEditIdsDescending', [''], /AppliedEditIdsDescending/i],
    ['providerAttributes', { valid: 42 }, /ProviderAttributes/i],
    ['auditInfo', { createDate: 'not-a-date', createdBy: '' }, /AuditInfo/i],
  ])('rejects an invalid persisted %s field', (field, value, message) => {
    const data = makeTransaction().toData() as unknown as Record<string, unknown>;
    data[field as string] = value;

    expect(() => Transaction.fromData(data as never)).toThrow(message as RegExp);
  });

  it('rejects malformed embedded edits before their values reach calculations or rendering', () => {
    const data = makeTransaction().toData();
    data.mergedEdit = {
      amount: { value: '12.50', isVoided: false },
    } as never;

    expect(() => Transaction.fromData(data)).toThrow(/MergedEdit\.amount\.value/i);
  });

  it('rejects non-object child transaction entries', () => {
    const data = makeTransaction().toData();
    data.children = { broken: null } as never;

    expect(() => Transaction.fromData(data)).toThrow(
      /Child transaction "broken" must be an object/i,
    );
  });

  it('rejects a child whose parent reference disagrees with its containing graph', () => {
    const parent = makeTransaction({ entityName: 'Parent' });
    const child = makeTransaction({ entityName: 'Child', lineNumber: 2 });
    parent.addChild(child);
    const data = parent.toData();
    data.children![child.id]!.parentId = 'different-parent';

    expect(() => Transaction.fromData(data)).toThrow(/references parent "different-parent"/i);
  });
});

describe('Transaction.combineAttributes', () => {
  it('rejects reuse when either side has already participated in a combination', () => {
    const destination = makeTransaction({ entityName: 'Destination' });
    const firstSource = makeTransaction({ entityName: 'First Source', lineNumber: 2 });
    const secondSource = makeTransaction({ entityName: 'Second Source', lineNumber: 3 });
    destination.combineAttributes(firstSource);

    expect(() => destination.combineAttributes(secondSource)).toThrow(/combine transaction again/i);

    const otherDestination = makeTransaction({ entityName: 'Other Destination', lineNumber: 4 });
    expect(() => otherDestination.combineAttributes(firstSource)).toThrow(
      /combine transaction again/i,
    );
  });
});

// ---------------------------------------------------------------------------
// completeParent
// ---------------------------------------------------------------------------

describe('Transaction.completeParent', () => {
  it('should mark parent complete when children sum matches amount exactly', () => {
    const parent = makeTransaction({ amount: -10 });
    const child1 = makeTransaction({ amount: -6, entityName: 'Child 1' });
    const child2 = makeTransaction({ amount: -4, entityName: 'Child 2' });
    parent.addChild(child1);
    parent.addChild(child2);

    const result = parent.completeParent();
    expect(result.isComplete).toBe(true);
    expect(result.missingChildAmount).toBe(0);
    expect(parent.hasMissingChild).toBe(false);
  });

  it('should treat floating-point rounding within half a cent as complete', () => {
    const parent = makeTransaction({ amount: -0.3 });
    // 0.1 + 0.1 + 0.1 = 0.30000000000000004 in IEEE 754
    const c1 = makeTransaction({ amount: -0.1, entityName: 'C1' });
    const c2 = makeTransaction({ amount: -0.1, entityName: 'C2' });
    const c3 = makeTransaction({ amount: -0.1, entityName: 'C3' });
    parent.addChild(c1);
    parent.addChild(c2);
    parent.addChild(c3);

    const result = parent.completeParent();
    expect(result.isComplete).toBe(true);
    expect(parent.hasMissingChild).toBe(false);
  });

  it('should flag parent incomplete when missing amount exceeds epsilon', () => {
    const parent = makeTransaction({ amount: -10 });
    const child = makeTransaction({ amount: -6, entityName: 'Partial' });
    parent.addChild(child);

    const result = parent.completeParent();
    expect(result.isComplete).toBe(false);
    expect(result.missingChildAmount).toBeCloseTo(-4, 5);
    expect(parent.hasMissingChild).toBe(true);
  });

  it('uses edited amounts when checking whether children reconcile', () => {
    const parent = makeTransaction({ amount: -10 });
    const child = makeTransaction({ amount: -10, entityName: 'Child' });
    parent.addChild(child);
    expect(parent.completeParent().isComplete).toBe(true);

    child.applyEdit(
      makeEdit({
        values: { amount: editValue(-8) },
      }),
    );

    expect(parent.completeParent()).toMatchObject({
      isComplete: false,
      missingChildAmount: -2,
    });
  });
});

describe('Transaction.addChild', () => {
  it('rejects a self-referencing child relationship', () => {
    const tx = makeTransaction();
    expect(() => tx.addChild(tx)).toThrow(/create a cycle/i);
    expect(tx.children).toBeNull();
    expect(tx.parentId).toBeNull();
  });

  it('rejects a relationship that would create an ancestor cycle', () => {
    const ancestor = makeTransaction({ entityName: 'Ancestor' });
    const descendant = makeTransaction({ entityName: 'Descendant', lineNumber: 2 });
    ancestor.addChild(descendant);

    expect(() => descendant.addChild(ancestor)).toThrow(/create a cycle/i);
    expect(ancestor.parentId).toBeNull();
    expect(descendant.parentId).toBe(ancestor.id);
  });
});
