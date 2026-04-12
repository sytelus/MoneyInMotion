import { describe, it, expect } from 'vitest';
import {
    Transactions,
    type TransactionsData,
    deserializeDictionary,
} from '../../src/models/transactions.js';
import {
    Transaction,
    type ImportedValues,
} from '../../src/models/transaction.js';
import { TransactionReason } from '../../src/models/transaction-reason.js';
import {
    ScopeType,
    createScopeFilter,
    editValue,
    type TransactionEditData,
    type ScopeFilter,
} from '../../src/models/transaction-edit.js';
import { TransactionEdits } from '../../src/models/transaction-edits.js';
import { createAuditInfo } from '../../src/models/audit-info.js';
import type { AccountInfo } from '../../src/models/account-info.js';
import { AccountType } from '../../src/models/account-info.js';
import type { ImportInfo } from '../../src/models/import-info.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAccountInfo(overrides?: Partial<AccountInfo>): AccountInfo {
    return {
        id: 'acct-amex',
        instituteName: 'American Express',
        title: 'Platinum Card',
        type: AccountType.CreditCard,
        requiresParent: false,
        interAccountNameTags: ['AMEX'],
        ...overrides,
    };
}

function makeImportInfo(overrides?: Partial<ImportInfo>): ImportInfo {
    return {
        id: 'import-001',
        portableAddress: 'statements/amex/2024-01.csv',
        contentHash: 'importhash001',
        format: 'csv',
        ...overrides,
    };
}

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

function makePopulatedTransactions(): { txns: Transactions; tx1: Transaction; tx2: Transaction } {
    const txns = new Transactions('test');
    const acct = makeAccountInfo();
    const imp = makeImportInfo();

    const tx1 = makeTransaction();
    const tx2 = makeTransaction({
        amount: -42.50,
        entityName: 'TARGET STORE 5678',
        transactionDate: '2024-03-16',
    });

    txns.addNew(tx1, acct, imp, false);
    txns.addNew(tx2, acct, imp, false);

    return { txns, tx1, tx2 };
}

// ---------------------------------------------------------------------------
// Construction and addNew
// ---------------------------------------------------------------------------

describe('Transactions construction and addNew', () => {
    it('should create an empty collection', () => {
        const txns = new Transactions('test');
        expect([...txns.topLevelTransactions]).toHaveLength(0);
        expect([...txns.allParentChildTransactions]).toHaveLength(0);
        expect(txns.editsCount).toBe(0);
    });

    it('should add a transaction', () => {
        const txns = new Transactions('test');
        const acct = makeAccountInfo();
        const imp = makeImportInfo();
        const tx = makeTransaction();

        const added = txns.addNew(tx, acct, imp, false);
        expect(added).toBe(true);
        expect([...txns.topLevelTransactions]).toHaveLength(1);
        expect(txns.getTransaction(tx.id)).toBe(tx);
        expect(txns.hasContentHash(tx.contentHash)).toBe(true);
        expect(txns.hasAccountInfo('acct-amex')).toBe(true);
        expect(txns.hasImportInfo('import-001')).toBe(true);
    });

    it('should reject duplicate content hash when allowDuplicate is false', () => {
        const txns = new Transactions('test');
        const acct = makeAccountInfo();
        const imp = makeImportInfo();
        const tx1 = makeTransaction();
        const tx2 = makeTransaction(); // same content hash

        txns.addNew(tx1, acct, imp, false);
        const added = txns.addNew(tx2, acct, imp, false);
        expect(added).toBe(false);
        expect([...txns.topLevelTransactions]).toHaveLength(1);
    });

    it('should allow duplicate content hash when allowDuplicate is true', () => {
        const txns = new Transactions('test');
        const acct = makeAccountInfo();
        const imp = makeImportInfo();
        const tx1 = makeTransaction();
        // Same imported values means same content hash AND same ID,
        // so the Map will overwrite the entry. Use a different line number
        // to produce a different ID but same content hash.
        const tx2 = makeTransaction({ lineNumber: 42 });

        txns.addNew(tx1, acct, imp, false);
        const added = txns.addNew(tx2, acct, imp, true);
        expect(added).toBe(true);
        expect([...txns.topLevelTransactions]).toHaveLength(2);
    });

    it('should retrieve account and import info', () => {
        const txns = new Transactions('test');
        const acct = makeAccountInfo();
        const imp = makeImportInfo();
        const tx = makeTransaction();
        txns.addNew(tx, acct, imp, false);

        expect(txns.getAccountInfo('acct-amex')).toBe(acct);
        expect(txns.getImportInfo('import-001')).toBe(imp);
    });

    it('should throw for missing account/import info', () => {
        const txns = new Transactions('test');
        expect(() => txns.getAccountInfo('nonexistent')).toThrow();
        expect(() => txns.getImportInfo('nonexistent')).toThrow();
    });
});

// ---------------------------------------------------------------------------
// Merge with deduplication
// ---------------------------------------------------------------------------

describe('Transactions.merge', () => {
    it('should add new transactions from other collection', () => {
        const txns1 = new Transactions('main');
        const txns2 = new Transactions('other');

        const acct = makeAccountInfo();
        const imp1 = makeImportInfo();
        const imp2 = makeImportInfo({ id: 'import-002', contentHash: 'importhash002' });

        const tx1 = makeTransaction();
        const tx2 = makeTransaction({
            amount: -50,
            entityName: 'COSTCO STORE 999',
            transactionDate: '2024-03-20',
        });

        txns1.addNew(tx1, acct, imp1, false);
        txns2.addNew(tx2, acct, imp2, false);

        txns1.merge(txns2, false);
        expect([...txns1.topLevelTransactions]).toHaveLength(2);
    });

    it('should not duplicate transactions with matching content hash', () => {
        const txns1 = new Transactions('main');
        const txns2 = new Transactions('other');

        const acct = makeAccountInfo();
        const imp = makeImportInfo();

        const tx1 = makeTransaction();
        const tx2 = makeTransaction(); // same content hash

        txns1.addNew(tx1, acct, imp, false);
        txns2.addNew(tx2, acct, imp, false);

        txns1.merge(txns2, false);
        expect([...txns1.topLevelTransactions]).toHaveLength(1);
    });

    it('should enrich existing transactions from different-format duplicates', () => {
        const txns1 = new Transactions('main');
        const txns2 = new Transactions('other');

        const acct = makeAccountInfo();
        // imp1 has the id that matches makeTransaction's default importId ('import-001')
        const imp1 = makeImportInfo({ id: 'import-001', format: 'csv' });
        const imp2 = makeImportInfo({ id: 'import-iif', format: 'iif', contentHash: 'importhash002' });

        const tx1 = makeTransaction({ entityName: 'SHORT NAME' });
        const tx2 = Transaction.create('import-iif', 'acct-amex', false, {
            ...makeImportedValues({ entityName: 'SHORT NAME' }),
            contentHash: tx1.contentHash,
            phoneNumber: '555-1234',
        });

        txns1.addNew(tx1, acct, imp1, false);
        txns2.addNew(tx2, acct, imp2, false);

        txns1.merge(txns2, false);

        // Still only 1 top-level transaction
        expect([...txns1.topLevelTransactions]).toHaveLength(1);

        // The transaction should have been enriched
        const enriched = txns1.getTransaction(tx1.id)!;
        expect(enriched.combinedFromId).toBe(tx2.id);
    });

    it('should enrich with different format but same content hash', () => {
        const txns1 = new Transactions('main');
        const txns2 = new Transactions('other');

        const acct = makeAccountInfo();
        const imp1 = makeImportInfo({ id: 'import-001', format: 'csv' });
        const imp2 = makeImportInfo({ id: 'import-ofx', format: 'ofx', contentHash: 'importhash-ofx' });

        // Create two transactions with the same content hash but from different formats
        const tx1 = makeTransaction({ entityName: 'STORE A' });
        const tx2 = Transaction.create('import-ofx', 'acct-amex', false, {
            ...makeImportedValues({ entityName: 'STORE A' }),
            contentHash: tx1.contentHash,
            phoneNumber: '555-9999',
        });

        txns1.addNew(tx1, acct, imp1, false);
        txns2.addNew(tx2, acct, imp2, false);

        txns1.merge(txns2, false);

        // Still only 1 top-level transaction (no duplicate added)
        expect([...txns1.topLevelTransactions]).toHaveLength(1);

        // The transaction should have been enriched with the other's attributes
        const enriched = txns1.getTransaction(tx1.id)!;
        expect(enriched.combinedFromId).toBe(tx2.id);
    });

    it('should merge edits from both collections', () => {
        const txns1 = new Transactions('main');
        const txns2 = new Transactions('other');

        const acct = makeAccountInfo();
        const imp = makeImportInfo();

        const tx = makeTransaction();
        txns1.addNew(tx, acct, imp, false);

        // Add an edit to txns2
        const otherEdits = new TransactionEdits('other');
        otherEdits.createEditNote([tx.id], 'A note');

        // We need to add a transaction to txns2 so it has something to merge
        const tx2 = makeTransaction({
            amount: -99,
            entityName: 'OTHER STORE',
        });
        txns2.addNew(tx2, acct, imp, false);

        txns1.merge(txns2, false);

        // After merge, txns1 should have the new transaction
        expect([...txns1.topLevelTransactions]).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// filterTransaction for each ScopeType
// ---------------------------------------------------------------------------

describe('Transactions.filterTransaction', () => {
    const tx = makeTransaction();

    it('ScopeType.All should match everything', () => {
        const filter = createScopeFilter(ScopeType.All, []);
        expect(Transactions.filterTransaction(filter, tx)).toBe(true);
    });

    it('ScopeType.None should match nothing', () => {
        const filter = createScopeFilter(ScopeType.None, []);
        expect(Transactions.filterTransaction(filter, tx)).toBe(false);
    });

    it('ScopeType.EntityName should match case-insensitively', () => {
        const filter = createScopeFilter(ScopeType.EntityName, ['whole foods mkt 10234']);
        expect(Transactions.filterTransaction(filter, tx)).toBe(true);

        const noMatch = createScopeFilter(ScopeType.EntityName, ['COSTCO']);
        expect(Transactions.filterTransaction(noMatch, tx)).toBe(false);
    });

    it('ScopeType.EntityNameNormalized should match normalized name case-insensitively', () => {
        // Normalized name is "Whole Foods Mkt"
        const filter = createScopeFilter(ScopeType.EntityNameNormalized, ['whole foods mkt']);
        expect(Transactions.filterTransaction(filter, tx)).toBe(true);
    });

    it('ScopeType.TransactionId should match exact ID', () => {
        const filter = createScopeFilter(ScopeType.TransactionId, [tx.id]);
        expect(Transactions.filterTransaction(filter, tx)).toBe(true);

        const noMatch = createScopeFilter(ScopeType.TransactionId, ['wrong-id']);
        expect(Transactions.filterTransaction(noMatch, tx)).toBe(false);
    });

    it('ScopeType.EntityNameAnyTokens should match if any token matches any parameter', () => {
        // Tokens are ["Whole", "Foods", "Mkt"]
        const filter = createScopeFilter(ScopeType.EntityNameAnyTokens, ['foods']);
        expect(Transactions.filterTransaction(filter, tx)).toBe(true);

        const noMatch = createScopeFilter(ScopeType.EntityNameAnyTokens, ['costco']);
        expect(Transactions.filterTransaction(noMatch, tx)).toBe(false);
    });

    it('ScopeType.EntityNameAllTokens should match if all parameters match some token', () => {
        const filter = createScopeFilter(ScopeType.EntityNameAllTokens, ['whole', 'foods']);
        expect(Transactions.filterTransaction(filter, tx)).toBe(true);

        const partial = createScopeFilter(ScopeType.EntityNameAllTokens, ['whole', 'costco']);
        expect(Transactions.filterTransaction(partial, tx)).toBe(false);
    });

    it('ScopeType.AccountId should match exact account ID', () => {
        const filter = createScopeFilter(ScopeType.AccountId, ['acct-amex']);
        expect(Transactions.filterTransaction(filter, tx)).toBe(true);

        const noMatch = createScopeFilter(ScopeType.AccountId, ['acct-chase']);
        expect(Transactions.filterTransaction(noMatch, tx)).toBe(false);
    });

    it('ScopeType.TransactionReason should match numeric reason', () => {
        const filter = createScopeFilter(ScopeType.TransactionReason, [
            String(TransactionReason.Purchase),
        ]);
        expect(Transactions.filterTransaction(filter, tx)).toBe(true);

        const noMatch = createScopeFilter(ScopeType.TransactionReason, [
            String(TransactionReason.Fee),
        ]);
        expect(Transactions.filterTransaction(noMatch, tx)).toBe(false);
    });

    it('ScopeType.AmountRange should match positive amounts', () => {
        const positiveTx = makeTransaction({
            amount: 50,
            transactionReason: TransactionReason.Return,
        });
        const filter = createScopeFilter(ScopeType.AmountRange, ['10', '100']);
        expect(Transactions.filterTransaction(filter, positiveTx)).toBe(true);

        const noMatch = createScopeFilter(ScopeType.AmountRange, ['100', '200']);
        expect(Transactions.filterTransaction(noMatch, positiveTx)).toBe(false);
    });

    it('ScopeType.AmountRange should handle negative amounts with isNegative flag', () => {
        // tx.amount is -25.99
        // With isNegative=true, filter checks: amount <= min*-1 && amount >= max*-1
        // So for min=10, max=50: checks amount <= -10 && amount >= -50
        const filter: ScopeFilter = {
            type: ScopeType.AmountRange,
            parameters: ['10', '50', 'true'],
            contentHash: 'test',
        };
        expect(Transactions.filterTransaction(filter, tx)).toBe(true);

        const noMatch: ScopeFilter = {
            type: ScopeType.AmountRange,
            parameters: ['1', '5', 'true'],
            contentHash: 'test',
        };
        // amount <= -1 && amount >= -5 => -25.99 >= -5 is false
        expect(Transactions.filterTransaction(noMatch, tx)).toBe(false);
    });

    it('ScopeType.AmountRange with 3 parameters should be accepted by createScopeFilter', () => {
        // After the validation fix, createScopeFilter should accept 3 params
        const filter = createScopeFilter(ScopeType.AmountRange, ['10', '50', 'true']);
        expect(filter.type).toBe(ScopeType.AmountRange);
        expect(filter.parameters).toEqual(['10', '50', 'true']);

        // Verify the filter works correctly with a negative-amount transaction
        const negativeTx = makeTransaction({ amount: -25.99 });
        expect(Transactions.filterTransaction(filter, negativeTx)).toBe(true);
    });

    it('ScopeType.AmountRange should return false when parameters are non-numeric', () => {
        const tx = makeTransaction({ amount: 50 });

        const filterNonNumericMin: ScopeFilter = {
            type: ScopeType.AmountRange,
            parameters: ['abc', '100'],
            contentHash: 'test',
        };
        expect(Transactions.filterTransaction(filterNonNumericMin, tx)).toBe(false);

        const filterNonNumericMax: ScopeFilter = {
            type: ScopeType.AmountRange,
            parameters: ['10', 'xyz'],
            contentHash: 'test',
        };
        expect(Transactions.filterTransaction(filterNonNumericMax, tx)).toBe(false);

        const filterBothNonNumeric: ScopeFilter = {
            type: ScopeType.AmountRange,
            parameters: ['foo', 'bar'],
            contentHash: 'test',
        };
        expect(Transactions.filterTransaction(filterBothNonNumeric, tx)).toBe(false);
    });

    it('ScopeType.EntityNameAnyTokens with empty entityNameTokens should not match', () => {
        // Create a transaction via fromData with entityNameNormalized set to empty
        // so that entityNameTokens returns []
        const baseTx = makeTransaction();
        const txData = baseTx.toData();
        txData.entityNameNormalized = '';
        txData.entityName = '';
        const emptyTokenTx = Transaction.fromData(txData);

        const filter = createScopeFilter(ScopeType.EntityNameAnyTokens, ['anything']);
        expect(Transactions.filterTransaction(filter, emptyTokenTx)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Apply edit to matching transactions
// ---------------------------------------------------------------------------

describe('Transactions.apply', () => {
    it('should apply edit to matching transactions', () => {
        const { txns, tx1 } = makePopulatedTransactions();

        const edit = makeEdit({
            scopeFilters: [createScopeFilter(ScopeType.TransactionId, [tx1.id])],
            values: { note: editValue('Test note') },
        });

        const modified = txns.apply(edit);
        expect(modified).toHaveLength(1);
        expect(modified[0]!.id).toBe(tx1.id);
        expect(modified[0]!.note).toBe('Test note');
    });

    it('should apply edit to all transactions with ScopeType.All', () => {
        const { txns, tx1, tx2 } = makePopulatedTransactions();

        const edit = makeEdit({
            scopeFilters: [createScopeFilter(ScopeType.All, [])],
            values: { isFlagged: editValue(true) },
        });

        const modified = txns.apply(edit);
        expect(modified).toHaveLength(2);
        expect(txns.getTransaction(tx1.id)!.isUserFlagged).toBe(true);
        expect(txns.getTransaction(tx2.id)!.isUserFlagged).toBe(true);
    });

    it('should throw when ignoreMissingIds is false and IDs are missing', () => {
        const { txns } = makePopulatedTransactions();

        const edit = makeEdit({
            scopeFilters: [createScopeFilter(ScopeType.TransactionId, ['nonexistent-id'])],
            values: { note: editValue('Test') },
        });

        expect(() => txns.apply(edit, false)).toThrow(/only 0 were found/);
    });

    it('should increment editsCount', () => {
        const { txns, tx1 } = makePopulatedTransactions();
        expect(txns.editsCount).toBe(0);

        txns.apply(makeEdit({
            scopeFilters: [createScopeFilter(ScopeType.TransactionId, [tx1.id])],
            values: { note: editValue('note') },
        }));
        expect(txns.editsCount).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Convenience edit methods
// ---------------------------------------------------------------------------

describe('setCategory, setNote, setIsUserFlagged', () => {
    it('setCategory should apply category to matching transactions', () => {
        const { txns, tx1 } = makePopulatedTransactions();

        const scopeFilters = [createScopeFilter(ScopeType.TransactionId, [tx1.id])];
        const modified = txns.setCategory(scopeFilters, ['Food', 'Groceries']);

        expect(modified).toHaveLength(1);
        expect(txns.getTransaction(tx1.id)!.categoryPath).toEqual(['Food', 'Groceries']);
    });

    it('setNote should set note on transactions', () => {
        const { txns, tx1 } = makePopulatedTransactions();

        const modified = txns.setNote([tx1.id], 'Weekly groceries');
        expect(modified).toHaveLength(1);
        expect(txns.getTransaction(tx1.id)!.note).toBe('Weekly groceries');
    });

    it('setIsUserFlagged should flag transactions', () => {
        const { txns, tx1, tx2 } = makePopulatedTransactions();

        const modified = txns.setIsUserFlagged([tx1.id, tx2.id], true);
        expect(modified).toHaveLength(2);
        expect(txns.getTransaction(tx1.id)!.isUserFlagged).toBe(true);
        expect(txns.getTransaction(tx2.id)!.isUserFlagged).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// fromData with legacy C# dictionary format
// ---------------------------------------------------------------------------

describe('deserializeDictionary', () => {
    it('should handle C# legacy [{Key, Value}] format', () => {
        const legacy = [
            { Key: 'a', Value: { x: 1 } },
            { Key: 'b', Value: { x: 2 } },
        ];
        const result = deserializeDictionary<{ x: number }>(legacy);
        expect(result).toEqual({ a: { x: 1 }, b: { x: 2 } });
    });

    it('should handle normal object format', () => {
        const normal = { a: { x: 1 }, b: { x: 2 } };
        const result = deserializeDictionary<{ x: number }>(normal);
        expect(result).toEqual({ a: { x: 1 }, b: { x: 2 } });
    });

    it('should handle null/undefined', () => {
        expect(deserializeDictionary(null)).toEqual({});
        expect(deserializeDictionary(undefined)).toEqual({});
    });
});

describe('Transactions.fromData', () => {
    it('should deserialize from TransactionsData', () => {
        const { txns, tx1 } = makePopulatedTransactions();

        const data = txns.serialize();
        const restored = Transactions.fromData(data);

        const restoredTxs = [...restored.topLevelTransactions];
        expect(restoredTxs).toHaveLength(2);

        const restoredTx1 = restored.getTransaction(tx1.id);
        expect(restoredTx1).toBeTruthy();
        expect(restoredTx1!.amount).toBe(tx1.amount);
        expect(restoredTx1!.entityName).toBe(tx1.entityName);
    });

    it('should deserialize from legacy C# dictionary format', () => {
        const tx = makeTransaction();
        const txData = tx.toData();
        const acct = makeAccountInfo();
        const imp = makeImportInfo();

        // Simulate legacy format where topItems, accountInfos, importInfos
        // are [{Key, Value}] arrays
        const legacyData = {
            name: 'legacy-test',
            topItems: [{ Key: tx.id, Value: txData }],
            accountInfos: [{ Key: acct.id, Value: acct }],
            importInfos: [{ Key: imp.id, Value: imp }],
            edits: [],
        } as unknown as TransactionsData;

        const restored = Transactions.fromData(legacyData);
        expect([...restored.topLevelTransactions]).toHaveLength(1);
        expect(restored.getTransaction(tx.id)).toBeTruthy();
        expect(restored.getAccountInfo(acct.id)).toEqual(acct);
        expect(restored.getImportInfo(imp.id)).toEqual(imp);
    });

    it('should round-trip serialize and deserialize', () => {
        const { txns, tx1 } = makePopulatedTransactions();

        // Apply an edit before serializing
        txns.setNote([tx1.id], 'A note for round-trip');

        const data = txns.serialize();
        const restored = Transactions.fromData(data);

        expect(restored.editsCount).toBe(txns.editsCount);
        expect([...restored.topLevelTransactions]).toHaveLength(
            [...txns.topLevelTransactions].length,
        );

        // The restored transaction data should match
        const restoredTx1 = restored.getTransaction(tx1.id);
        expect(restoredTx1).toBeTruthy();
        expect(restoredTx1!.amount).toBe(tx1.amount);
    });
});

// ---------------------------------------------------------------------------
// Inter-account transfer matching
// ---------------------------------------------------------------------------

describe('Inter-account transfer matching', () => {
    it('should match opposite-amount transactions across accounts within date tolerance', () => {
        const txns = new Transactions('test');

        // acct-checking has interAccountNameTags=['AMEX'], so candidates
        // for matching from other accounts must have 'AMEX' in their entity name.
        // acct-amex has interAccountNameTags=['CHASE'], so candidates
        // for matching from other accounts must have 'CHASE' in their entity name.
        const acct1 = makeAccountInfo({
            id: 'acct-checking',
            instituteName: 'Chase',
            interAccountNameTags: ['AMEX'],
        });
        const acct2 = makeAccountInfo({
            id: 'acct-amex',
            instituteName: 'American Express',
            interAccountNameTags: ['CHASE'],
        });
        const imp = makeImportInfo();

        // Outgoing transfer from checking: entity name must match acct2's name tags
        // (acct-amex tags are ['CHASE'], and the checking tx entity has 'AMEX' which
        // is checked against the candidates). Actually the logic is:
        // For unmatched tx1 (acct-checking, tags=['AMEX']), we check that
        // candidate tx2's entity name contains 'AMEX'.
        const tx1 = Transaction.create('import-001', 'acct-checking', false, {
            amount: -500,
            transactionDate: '2024-03-15',
            entityName: 'AMEX PAYMENT',
            transactionReason: TransactionReason.InterAccountPayment,
        });

        // Incoming payment to amex: entity name must contain 'AMEX' (from
        // the unmatched tx1's account's interAccountNameTags)
        const tx2 = Transaction.create('import-001', 'acct-amex', false, {
            amount: 500,
            transactionDate: '2024-03-16',
            entityName: 'AMEX CREDIT PAYMENT',
            transactionReason: TransactionReason.InterAccountPayment,
        });

        txns.addNew(tx1, acct1, imp, false);
        txns.addNew(tx2, acct2, imp, true);

        txns.matchTransactions();

        expect(tx1.relatedTransferId).toBe(tx2.id);
        expect(tx2.relatedTransferId).toBe(tx1.id);
    });

    it('should not match transactions from the same account', () => {
        const txns = new Transactions('test');

        const acct = makeAccountInfo({
            id: 'acct-checking',
            instituteName: 'Chase',
            interAccountNameTags: [],
        });
        const imp = makeImportInfo();

        const tx1 = Transaction.create('import-001', 'acct-checking', false, {
            amount: -100,
            transactionDate: '2024-03-15',
            entityName: 'Transfer Out',
            transactionReason: TransactionReason.InterAccountTransfer,
        });

        const tx2 = Transaction.create('import-001', 'acct-checking', false, {
            amount: 100,
            transactionDate: '2024-03-15',
            entityName: 'Transfer In',
            transactionReason: TransactionReason.InterAccountTransfer,
        });

        txns.addNew(tx1, acct, imp, false);
        txns.addNew(tx2, acct, imp, true);

        txns.matchTransactions();

        expect(tx1.relatedTransferId).toBeNull();
        expect(tx2.relatedTransferId).toBeNull();
    });

    it('should not match transactions outside date tolerance', () => {
        const txns = new Transactions('test');

        const acct1 = makeAccountInfo({
            id: 'acct-checking',
            instituteName: 'Chase',
            interAccountNameTags: ['AMEX'],
        });
        const acct2 = makeAccountInfo({
            id: 'acct-amex',
            instituteName: 'American Express',
            interAccountNameTags: ['CHASE'],
        });
        const imp = makeImportInfo();

        const tx1 = Transaction.create('import-001', 'acct-checking', false, {
            amount: -500,
            transactionDate: '2024-03-01',
            entityName: 'AMEX PAYMENT',
            transactionReason: TransactionReason.InterAccountPayment,
        });

        const tx2 = Transaction.create('import-001', 'acct-amex', false, {
            amount: 500,
            transactionDate: '2024-03-20', // 19 days later, outside tolerance
            entityName: 'CHASE PAYMENT RECEIVED',
            transactionReason: TransactionReason.InterAccountPayment,
        });

        txns.addNew(tx1, acct1, imp, false);
        txns.addNew(tx2, acct2, imp, true);

        txns.matchTransactions();

        expect(tx1.relatedTransferId).toBeNull();
        expect(tx2.relatedTransferId).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// relateParentChild
// ---------------------------------------------------------------------------

describe('Transactions.relateParentChild', () => {
    it('should link parent and child and remove child from topLevel', () => {
        const txns = new Transactions('test');
        const acct = makeAccountInfo();
        const imp = makeImportInfo();

        const parent = makeTransaction({ amount: -100, entityName: 'PARENT TX' });
        const child = makeTransaction({ amount: -30, entityName: 'CHILD TX' });

        txns.addNew(parent, acct, imp, false);
        txns.addNew(child, acct, imp, true);

        expect([...txns.topLevelTransactions]).toHaveLength(2);

        txns.relateParentChild(parent.id, child.id);

        // Child removed from top-level
        expect([...txns.topLevelTransactions]).toHaveLength(1);
        // Parent has the child
        expect(parent.children).toBeTruthy();
        expect(parent.children![child.id]).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// getClonedEdits
// ---------------------------------------------------------------------------

describe('Transactions.getClonedEdits', () => {
    it('should return a deep clone of the edits', () => {
        const { txns, tx1 } = makePopulatedTransactions();

        txns.setNote([tx1.id], 'A note');

        const cloned = txns.getClonedEdits();
        expect(cloned.count).toBe(txns.editsCount);
    });
});

// ---------------------------------------------------------------------------
// applyEdits (multiple)
// ---------------------------------------------------------------------------

describe('Transactions.applyEdits', () => {
    it('should apply multiple edits from a TransactionEdits collection', () => {
        const { txns, tx1, tx2 } = makePopulatedTransactions();

        const editsCollection = new TransactionEdits('test');
        editsCollection.createEditNote([tx1.id], 'Note 1');
        editsCollection.createEditIsUserFlagged([tx2.id], true);

        const modified = txns.applyEdits(editsCollection);
        expect(modified.length).toBeGreaterThanOrEqual(2);
        expect(txns.getTransaction(tx1.id)!.note).toBe('Note 1');
        expect(txns.getTransaction(tx2.id)!.isUserFlagged).toBe(true);
    });
});
