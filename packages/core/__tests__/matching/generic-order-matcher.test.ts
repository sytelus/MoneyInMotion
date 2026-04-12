import { describe, it, expect } from 'vitest';
import { GenericOrderMatcher } from '../../src/matching/generic-order-matcher.js';
import { Transaction, type ImportedValues } from '../../src/models/transaction.js';
import { Transactions } from '../../src/models/transactions.js';
import { TransactionReason } from '../../src/models/transaction-reason.js';
import { LineItemType } from '../../src/models/line-item-type.js';
import type { AccountInfo } from '../../src/models/account-info.js';
import { AccountType } from '../../src/models/account-info.js';
import type { ImportInfo } from '../../src/models/import-info.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Credit card account (parent for non-line-item matching). */
function makeCreditCardAccount(overrides?: Partial<AccountInfo>): AccountInfo {
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

/** Order-history account (children come from here). */
function makeOrderAccount(overrides?: Partial<AccountInfo>): AccountInfo {
    return {
        id: 'acct-amazon',
        instituteName: 'Amazon',
        title: 'Amazon Orders',
        type: AccountType.OrderHistory,
        requiresParent: true,
        interAccountNameTags: ['AMAZON', 'AMZN'],
        ...overrides,
    };
}

function makeImportInfo(overrides?: Partial<ImportInfo>): ImportInfo {
    return {
        id: 'import-001',
        portableAddress: 'statements/amazon/2024-01.csv',
        contentHash: 'importhash001',
        format: 'csv',
        ...overrides,
    };
}

function makeTransaction(
    accountId: string,
    importId: string,
    overrides?: Partial<ImportedValues>,
): Transaction {
    return Transaction.create(
        importId,
        accountId,
        false,
        {
            amount: -25.99,
            transactionDate: '2024-03-15',
            entityName: 'AMAZON MARKETPLACE',
            transactionReason: TransactionReason.Purchase,
            ...overrides,
        },
    );
}

// ---------------------------------------------------------------------------
// getParents — line-item matching by matchFilter
// ---------------------------------------------------------------------------

describe('GenericOrderMatcher.getParents — line items', () => {
    it('should match line-item children to parents by matchFilter', () => {
        const orderAcct = makeOrderAccount();
        const ccAcct = makeCreditCardAccount();
        const imp = makeImportInfo();

        const txns = new Transactions('test');
        txns.addNew(
            makeTransaction('acct-chase', 'import-001', { amount: -25.99, entityName: 'AMAZON MKT' }),
            ccAcct,
            imp,
            false,
        );

        // Parent in order account: LineItemType.None with matchFilter
        const parent = makeTransaction('acct-amazon', 'import-001', {
            amount: -25.99,
            entityName: 'Order #123',
            lineItemType: LineItemType.None,
            parentChildMatchFilter: 'ORDER-123',
            requiresParent: false,
        });
        txns.addNew(parent, orderAcct, imp, true);

        // Child in order account: LineItemType.ItemSubtotal with matchFilter
        const child = makeTransaction('acct-amazon', 'import-001', {
            amount: -20.00,
            entityName: 'Widget',
            lineItemType: LineItemType.ItemSubtotal,
            parentChildMatchFilter: 'ORDER-123',
            requiresParent: true,
        });
        txns.addNew(child, orderAcct, imp, true);

        const matcher = new GenericOrderMatcher(orderAcct, 'shipping', 'tax', 'discount');
        const results = matcher.getParents([child], txns);

        expect(results).toHaveLength(1);
        expect(results[0]!.child.id).toBe(child.id);
        expect(results[0]!.parent.id).toBe(parent.id);
    });

    it('should throw when multiple parents match the same matchFilter', () => {
        const orderAcct = makeOrderAccount();
        const imp = makeImportInfo();

        const txns = new Transactions('test');

        // Two parents with the same matchFilter
        const parent1 = makeTransaction('acct-amazon', 'import-001', {
            amount: -25.99,
            entityName: 'Order #123 A',
            lineItemType: LineItemType.None,
            parentChildMatchFilter: 'ORDER-123',
            requiresParent: false,
            instituteReference: 'ref-1',
        });
        txns.addNew(parent1, orderAcct, imp, true);

        const parent2 = makeTransaction('acct-amazon', 'import-001', {
            amount: -30.00,
            entityName: 'Order #123 B',
            lineItemType: LineItemType.None,
            parentChildMatchFilter: 'ORDER-123',
            requiresParent: false,
            instituteReference: 'ref-2',
        });
        txns.addNew(parent2, orderAcct, imp, true);

        const child = makeTransaction('acct-amazon', 'import-001', {
            amount: -20.00,
            entityName: 'Widget',
            lineItemType: LineItemType.ItemSubtotal,
            parentChildMatchFilter: 'ORDER-123',
            requiresParent: true,
        });
        txns.addNew(child, orderAcct, imp, true);

        const matcher = new GenericOrderMatcher(orderAcct, 'shipping', 'tax', 'discount');
        expect(() => matcher.getParents([child], txns)).toThrow(/parents for Child ID/);
    });

    it('should return nothing when no parent matches the matchFilter', () => {
        const orderAcct = makeOrderAccount();
        const imp = makeImportInfo();

        const txns = new Transactions('test');

        const child = makeTransaction('acct-amazon', 'import-001', {
            amount: -20.00,
            entityName: 'Widget',
            lineItemType: LineItemType.ItemSubtotal,
            parentChildMatchFilter: 'ORDER-999',
            requiresParent: true,
        });
        txns.addNew(child, orderAcct, imp, true);

        const matcher = new GenericOrderMatcher(orderAcct, 'shipping', 'tax', 'discount');
        const results = matcher.getParents([child], txns);
        expect(results).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// getParents — non-line-item matching by amount+date
// ---------------------------------------------------------------------------

describe('GenericOrderMatcher.getParents — non-line items', () => {
    it('should match non-line-item children to credit card parents by exact amount and date', () => {
        const orderAcct = makeOrderAccount();
        const ccAcct = makeCreditCardAccount();
        const imp = makeImportInfo();

        const txns = new Transactions('test');

        // Credit card parent (different account, has "AMAZON" in name tags)
        const ccParent = makeTransaction('acct-chase', 'import-001', {
            amount: -55.00,
            entityName: 'AMAZON MKTPLACE PMTS',
            transactionDate: '2024-03-15',
        });
        txns.addNew(ccParent, ccAcct, imp, false);

        // Order child (non-line-item, same amount and date)
        const orderChild = makeTransaction('acct-amazon', 'import-001', {
            amount: -55.00,
            entityName: 'Amazon Order #456',
            transactionDate: '2024-03-15',
            lineItemType: LineItemType.None,
            requiresParent: true,
        });
        txns.addNew(orderChild, orderAcct, imp, true);

        const matcher = new GenericOrderMatcher(orderAcct, 'shipping', 'tax', 'discount');
        const results = matcher.getParents([orderChild], txns);

        expect(results).toHaveLength(1);
        expect(results[0]!.child.id).toBe(orderChild.id);
        expect(results[0]!.parent.id).toBe(ccParent.id);
    });

    it('should fuzzy match non-line-item children when exact match fails', () => {
        const orderAcct = makeOrderAccount();
        const ccAcct = makeCreditCardAccount();
        const imp = makeImportInfo();

        const txns = new Transactions('test');

        // Credit card parent with slightly different amount and date
        const ccParent = makeTransaction('acct-chase', 'import-001', {
            amount: -55.50,
            entityName: 'AMAZON MKTPLACE PMTS',
            transactionDate: '2024-03-16', // 1 day off
        });
        txns.addNew(ccParent, ccAcct, imp, false);

        // Order child
        const orderChild = makeTransaction('acct-amazon', 'import-001', {
            amount: -55.00,
            entityName: 'Amazon Order #456',
            transactionDate: '2024-03-15',
            lineItemType: LineItemType.None,
            requiresParent: true,
        });
        txns.addNew(orderChild, orderAcct, imp, true);

        const matcher = new GenericOrderMatcher(orderAcct, 'shipping', 'tax', 'discount');
        const results = matcher.getParents([orderChild], txns);

        expect(results).toHaveLength(1);
        expect(results[0]!.child.id).toBe(orderChild.id);
        expect(results[0]!.parent.id).toBe(ccParent.id);
    });

    it('should not match when amount difference exceeds 1', () => {
        const orderAcct = makeOrderAccount();
        const ccAcct = makeCreditCardAccount();
        const imp = makeImportInfo();

        const txns = new Transactions('test');

        const ccParent = makeTransaction('acct-chase', 'import-001', {
            amount: -57.00,
            entityName: 'AMAZON MKTPLACE PMTS',
            transactionDate: '2024-03-15',
        });
        txns.addNew(ccParent, ccAcct, imp, false);

        const orderChild = makeTransaction('acct-amazon', 'import-001', {
            amount: -55.00,
            entityName: 'Amazon Order #456',
            transactionDate: '2024-03-15',
            lineItemType: LineItemType.None,
            requiresParent: true,
        });
        txns.addNew(orderChild, orderAcct, imp, true);

        const matcher = new GenericOrderMatcher(orderAcct, 'shipping', 'tax', 'discount');
        const results = matcher.getParents([orderChild], txns);
        expect(results).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// handleIncompleteParent — with discount/shipping/tax adjustments
// ---------------------------------------------------------------------------

describe('GenericOrderMatcher.handleIncompleteParent', () => {
    it('should return true when missingChildAmount is zero', () => {
        const orderAcct = makeOrderAccount();
        const ccAcct = makeCreditCardAccount();
        const imp = makeImportInfo();

        const txns = new Transactions('test');
        const parent = makeTransaction('acct-chase', 'import-001', {
            amount: -100.00,
            entityName: 'AMAZON MKTPLACE PMTS',
        });
        txns.addNew(parent, ccAcct, imp, false);

        const matcher = new GenericOrderMatcher(orderAcct, 'shipping charge', 'tax charged', 'total promotions');
        expect(matcher.handleIncompleteParent(parent, txns, 0)).toBe(true);
    });

    it('should create adjustment children for discount, shipping, tax, and remainder', () => {
        const orderAcct = makeOrderAccount();
        const ccAcct = makeCreditCardAccount();
        const imp = makeImportInfo();

        const txns = new Transactions('test');

        // Parent with provider attributes for shipping/tax/discount
        // Note: discount is positive (it's a credit amount that reduces the total)
        const parent = makeTransaction('acct-chase', 'import-001', {
            amount: -100.00,
            entityName: 'AMAZON MKTPLACE PMTS',
            providerAttributes: {
                'shipping charge': '5.99',
                'tax charged': '8.25',
                'total promotions': '2.00',
            },
        });
        txns.addNew(parent, ccAcct, imp, false);

        const matcher = new GenericOrderMatcher(orderAcct, 'shipping charge', 'tax charged', 'total promotions');

        // Missing child amount = parent.amount - sum(children)
        // The missing is accounted for by: promotions(2) + shipping(5.99) + tax(8.25) = 16.24
        // updatedMissing = 16.24 - 16.24 = 0 (tolerable)
        const missingAmount = 2.00 + 5.99 + 8.25; // = 16.24
        const result = matcher.handleIncompleteParent(parent, txns, missingAmount);

        expect(result).toBe(true);

        // Parent should now have children for discount, shipping, and tax
        // (adjustment for 0 remainder is skipped because amount=0)
        const children = parent.children;
        expect(children).not.toBeNull();

        const childValues = Object.values(children!);
        // Discount (2.00), Shipping (5.99), Tax (8.25) — 3 non-zero children
        // Adjustment remainder = 0 (skipped)
        expect(childValues.length).toBe(3);

        const entityNames = childValues.map((c) => c.entityName);
        expect(entityNames.some((n) => n.startsWith('Discount'))).toBe(true);
        expect(entityNames.some((n) => n.startsWith('Shipping'))).toBe(true);
        expect(entityNames.some((n) => n.startsWith('Tax'))).toBe(true);
    });

    it('should return false when remaining missing amount is intolerable', () => {
        const orderAcct = makeOrderAccount();
        const ccAcct = makeCreditCardAccount();
        const imp = makeImportInfo();

        const txns = new Transactions('test');

        const parent = makeTransaction('acct-chase', 'import-001', {
            amount: -100.00,
            entityName: 'AMAZON MKTPLACE PMTS',
            providerAttributes: {
                'shipping charge': '5.99',
                'tax charged': '8.25',
                'total promotions': '0',
            },
        });
        txns.addNew(parent, ccAcct, imp, false);

        const matcher = new GenericOrderMatcher(orderAcct, 'shipping charge', 'tax charged', 'total promotions');

        // Missing = 50.00; after removing shipping(5.99) + tax(8.25) + promo(0) = 14.24
        // updatedMissing = 50 - 14.24 = 35.76, which is NOT tolerable (> 2% of 100 = 2, and > 0.50)
        const result = matcher.handleIncompleteParent(parent, txns, 50.00);
        expect(result).toBe(false);

        // No children should have been created
        expect(parent.children).toBeNull();
    });

    it('should handle missing provider attributes gracefully', () => {
        const orderAcct = makeOrderAccount();
        const ccAcct = makeCreditCardAccount();
        const imp = makeImportInfo();

        const txns = new Transactions('test');

        const parent = makeTransaction('acct-chase', 'import-001', {
            amount: -100.00,
            entityName: 'AMAZON MKTPLACE PMTS',
            // No providerAttributes
        });
        txns.addNew(parent, ccAcct, imp, false);

        const matcher = new GenericOrderMatcher(orderAcct, 'shipping charge', 'tax charged', 'total promotions');

        // Missing = 0.30, updatedMissing = 0.30 - (0 + 0 + 0) = 0.30, tolerable (< 0.50)
        const result = matcher.handleIncompleteParent(parent, txns, 0.30);
        expect(result).toBe(true);

        // Should create only the final adjustment child (discount/shipping/tax are all 0)
        const children = parent.children;
        expect(children).not.toBeNull();
        const childValues = Object.values(children!);
        expect(childValues.length).toBe(1);
        expect(childValues[0]!.entityName).toContain('Adjustment');
    });
});
