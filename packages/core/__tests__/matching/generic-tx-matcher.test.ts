import { describe, it, expect } from 'vitest';
import {
    GenericTxParentChildMatcher,
    isMissingAmountTolerable,
} from '../../src/matching/generic-tx-matcher.js';
import { Transaction, type ImportedValues } from '../../src/models/transaction.js';
import { Transactions } from '../../src/models/transactions.js';
import { TransactionReason } from '../../src/models/transaction-reason.js';
import type { AccountInfo } from '../../src/models/account-info.js';
import { AccountType } from '../../src/models/account-info.js';
import type { ImportInfo } from '../../src/models/import-info.js';
import { createAuditInfo } from '../../src/models/audit-info.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAccountInfo(overrides?: Partial<AccountInfo>): AccountInfo {
    return {
        id: 'acct-chase',
        instituteName: 'Chase',
        title: 'Freedom Card',
        type: AccountType.CreditCard,
        requiresParent: false,
        interAccountNameTags: ['CHASE'],
        ...overrides,
    };
}

function makeImportInfo(overrides?: Partial<ImportInfo>): ImportInfo {
    return {
        id: 'import-001',
        portableAddress: 'statements/chase/2024-01.csv',
        contentHash: 'importhash001',
        format: 'csv',
        ...overrides,
    };
}

function makeTransaction(
    accountId: string,
    overrides?: Partial<ImportedValues>,
): Transaction {
    return Transaction.create(
        'import-001',
        accountId,
        false,
        {
            amount: -100.00,
            transactionDate: '2024-03-15',
            entityName: 'AMAZON MARKETPLACE',
            transactionReason: TransactionReason.Purchase,
            ...overrides,
        },
    );
}

function makePopulatedTransactions(): { txns: Transactions; parent: Transaction } {
    const txns = new Transactions('test');
    const acct = makeAccountInfo();
    const imp = makeImportInfo();

    const parent = makeTransaction('acct-chase', {
        amount: -100.00,
        entityName: 'AMAZON MARKETPLACE',
    });

    txns.addNew(parent, acct, imp, false);
    return { txns, parent };
}

// ---------------------------------------------------------------------------
// isMissingAmountTolerable
// ---------------------------------------------------------------------------

describe('isMissingAmountTolerable', () => {
    it('should return true when missing amount is less than 2% of parent amount', () => {
        const parent = makeTransaction('acct-chase', { amount: -100.00 });
        // 2% of 100 = 2.00; missing = 1.50 < 2.00
        expect(isMissingAmountTolerable(parent, 1.50)).toBe(true);
    });

    it('should return true when missing amount is less than $0.50', () => {
        const parent = makeTransaction('acct-chase', { amount: -10.00 });
        // 2% of 10 = 0.20; missing = 0.30 > 0.20, but 0.30 < 0.50
        expect(isMissingAmountTolerable(parent, 0.30)).toBe(true);
    });

    it('should return false when missing amount exceeds both thresholds', () => {
        const parent = makeTransaction('acct-chase', { amount: -50.00 });
        // 2% of 50 = 1.00; missing = 5.00 > 1.00 and 5.00 > 0.50
        expect(isMissingAmountTolerable(parent, 5.00)).toBe(false);
    });

    it('should handle negative missing amounts', () => {
        const parent = makeTransaction('acct-chase', { amount: -100.00 });
        // abs(-0.30) = 0.30 < 0.50
        expect(isMissingAmountTolerable(parent, -0.30)).toBe(true);
    });

    it('should return false for large missing amounts relative to parent', () => {
        const parent = makeTransaction('acct-chase', { amount: -20.00 });
        // 2% of 20 = 0.40; missing = 3.00 > 0.40 and 3.00 > 0.50
        expect(isMissingAmountTolerable(parent, 3.00)).toBe(false);
    });

    it('should return true when missing is exactly 0', () => {
        const parent = makeTransaction('acct-chase', { amount: -100.00 });
        expect(isMissingAmountTolerable(parent, 0)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// GenericTxParentChildMatcher.getParents
// ---------------------------------------------------------------------------

describe('GenericTxParentChildMatcher.getParents', () => {
    it('should throw when called', () => {
        const matcher = new GenericTxParentChildMatcher();
        const { txns } = makePopulatedTransactions();
        expect(() => matcher.getParents([], txns)).toThrow(
            'GenericTxParentChildMatcher does not support parent search',
        );
    });
});

// ---------------------------------------------------------------------------
// GenericTxParentChildMatcher.handleIncompleteParent
// ---------------------------------------------------------------------------

describe('GenericTxParentChildMatcher.handleIncompleteParent', () => {
    it('should return true when missingChildAmount is zero', () => {
        const matcher = new GenericTxParentChildMatcher();
        const { txns, parent } = makePopulatedTransactions();
        expect(matcher.handleIncompleteParent(parent, txns, 0)).toBe(true);
    });

    it('should create adjustment child for tolerable positive missing amount', () => {
        const matcher = new GenericTxParentChildMatcher();
        const { txns, parent } = makePopulatedTransactions();

        // Missing = 0.30, tolerable (< 0.50)
        const result = matcher.handleIncompleteParent(parent, txns, 0.30);
        expect(result).toBe(true);

        // Should have created an adjustment child with amount = -0.30
        const children = parent.children;
        expect(children).not.toBeNull();
        const childIds = Object.keys(children!);
        expect(childIds.length).toBe(1);

        const childData = children![childIds[0]!]!;
        expect(childData.amount).toBe(-0.30);
        expect(childData.transactionReason).toBe(TransactionReason.MatchAdjustmentDebit);
        expect(childData.entityName).toContain('Adjustment');
        expect(childData.entityName).toContain(parent.entityName);
    });

    it('should create MatchAdjustmentCredit for negative missing amount', () => {
        const matcher = new GenericTxParentChildMatcher();
        const { txns, parent } = makePopulatedTransactions();

        // Missing = -0.20, so finalMissing = 0.20 (positive -> credit)
        const result = matcher.handleIncompleteParent(parent, txns, -0.20);
        expect(result).toBe(true);

        const children = parent.children;
        expect(children).not.toBeNull();
        const childIds = Object.keys(children!);
        expect(childIds.length).toBe(1);

        const childData = children![childIds[0]!]!;
        expect(childData.amount).toBe(0.20);
        expect(childData.transactionReason).toBe(TransactionReason.MatchAdjustmentCredit);
    });

    it('should return false for intolerable missing amount', () => {
        const matcher = new GenericTxParentChildMatcher();
        const { txns, parent } = makePopulatedTransactions();

        // Missing = 10.00, not tolerable (> 2% of 100 = 2.00 and > 0.50)
        const result = matcher.handleIncompleteParent(parent, txns, 10.00);
        expect(result).toBe(false);

        // Should not have created any children
        expect(parent.children).toBeNull();
    });

    it('should register the import info in the collection', () => {
        const matcher = new GenericTxParentChildMatcher();
        const { txns, parent } = makePopulatedTransactions();

        matcher.handleIncompleteParent(parent, txns, 0.10);

        expect(txns.hasImportInfo('CreatedBy.GenericTxParentChildMatcher')).toBe(true);
    });
});
