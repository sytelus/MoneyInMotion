import { describe, it, expect } from 'vitest';
import {
    Transaction,
    type ImportedValues,
    type TransactionData,
} from '../../src/models/transaction.js';
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
    return Transaction.create(
        'import-001',
        'acct-amex',
        false,
        makeImportedValues(overrides),
    );
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
        expect(() => makeTransaction({ amount: -10, transactionReason: TransactionReason.Purchase })).not.toThrow();
    });

    it('should allow Return with positive amount (incoming)', () => {
        expect(() => makeTransaction({ amount: 10, transactionReason: TransactionReason.Return })).not.toThrow();
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
        expect(Transaction.computeContentHash(fields1)).not.toBe(Transaction.computeContentHash(fields2));
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

    it('should record edit id in appliedEditIdsDescending', () => {
        const tx = makeTransaction();
        tx.applyEdit(makeEdit({ id: 'edit-A' }));
        tx.applyEdit(makeEdit({ id: 'edit-B' }));

        expect(tx.appliedEditIdsDescending).toEqual(['edit-B', 'edit-A']);
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

        tx.applyEdit(makeEdit({
            values: { isFlagged: editValue(true) },
        }));

        expect(tx.isUserFlagged).toBe(true);
    });

    it('should apply categoryPath edit', () => {
        const tx = makeTransaction();
        expect(tx.categoryPath).toEqual([]);

        tx.applyEdit(makeEdit({
            values: { categoryPath: editValue(['Food', 'Groceries']) },
        }));

        expect(tx.categoryPath).toEqual(['Food', 'Groceries']);
    });

    it('should apply note edit', () => {
        const tx = makeTransaction();
        expect(tx.note).toBeNull();

        tx.applyEdit(makeEdit({
            values: { note: editValue('Weekly shopping') },
        }));

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
        tx.applyEdit(makeEdit({
            values: { transactionDate: editValue('2024-04-01') },
        }));
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
        tx.applyEdit(makeEdit({
            values: {
                categoryPath: editValue(['Food']),
                isFlagged: editValue(true),
            },
        }));

        const cloned = tx.clone();

        // Values should be equal
        expect(cloned.id).toBe(tx.id);
        expect(cloned.amount).toBe(tx.amount);
        expect(cloned.categoryPath).toEqual(tx.categoryPath);
        expect(cloned.isUserFlagged).toBe(tx.isUserFlagged);

        // Modifying the clone should not affect the original
        cloned.applyEdit(makeEdit({
            id: 'edit-clone-only',
            values: { entityName: editValue('Modified Name') },
        }));

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
});
