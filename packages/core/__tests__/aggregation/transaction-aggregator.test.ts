import { describe, it, expect } from 'vitest';
import { TransactionAggregator } from '../../src/aggregation/transaction-aggregator.js';
import { Transaction, type ImportedValues } from '../../src/models/transaction.js';
import { TransactionReason } from '../../src/models/transaction-reason.js';

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

function makeTx(overrides?: Partial<ImportedValues>): Transaction {
    return Transaction.create(
        'import-001',
        'acct-amex',
        false,
        makeImportedValues(overrides),
    );
}

// ---------------------------------------------------------------------------
// Basic aggregation
// ---------------------------------------------------------------------------

describe('TransactionAggregator', () => {
    it('should accumulate totals from added transactions', () => {
        const agg = new TransactionAggregator({ name: 'root' });

        agg.add(makeTx({ amount: -50, entityName: 'Store A' }));
        agg.add(makeTx({ amount: -30, entityName: 'Store B' }));
        agg.add(makeTx({ amount: 20, entityName: 'Refund', transactionReason: TransactionReason.Return }));

        expect(agg.count).toBe(3);
        expect(agg.sum).toBe(-60);
        expect(agg.positiveSum).toBe(20);
        expect(agg.negativeSum).toBe(80); // abs of negative amounts
    });

    it('should store leaf transactions when no subAggregateFn is provided', () => {
        const agg = new TransactionAggregator({ name: 'flat' });

        agg.add(makeTx({ amount: -10, entityName: 'A' }));
        agg.add(makeTx({ amount: -20, entityName: 'B' }));

        const txs = agg.getTransactions();
        expect(txs).toHaveLength(2);
    });

    // -----------------------------------------------------------------------
    // Hierarchical grouping
    // -----------------------------------------------------------------------

    describe('hierarchical grouping', () => {
        it('should delegate transactions to sub-aggregators via subAggregateFn', () => {
            const root = new TransactionAggregator({
                name: 'root',
                subAggregateFn: (parent, tx) => {
                    const key = tx.amount < 0 ? 'negative' : 'positive';
                    return parent.getOrCreateSub(key, (p) =>
                        new TransactionAggregator({ name: key, parent: p }),
                    );
                },
            });

            root.add(makeTx({ amount: -50, entityName: 'Expense1' }));
            root.add(makeTx({ amount: -30, entityName: 'Expense2' }));
            root.add(makeTx({ amount: 20, entityName: 'Income1', transactionReason: TransactionReason.Return }));

            const subs = root.getSubAggregators();
            expect(subs).toHaveLength(2);

            const negSub = subs.find((s) => s.name === 'negative');
            const posSub = subs.find((s) => s.name === 'positive');

            expect(negSub).toBeDefined();
            expect(posSub).toBeDefined();
            expect(negSub!.count).toBe(2);
            expect(posSub!.count).toBe(1);

            // Leaf rows should be on the sub-aggregators, not on root.
            expect(root.getTransactions()).toHaveLength(0);
            expect(negSub!.getTransactions()).toHaveLength(2);
            expect(posSub!.getTransactions()).toHaveLength(1);
        });

        it('should compute correct sums at every level', () => {
            const root = new TransactionAggregator({
                name: 'root',
                subAggregateFn: (parent, tx) => {
                    const name = tx.displayEntityNameNormalized;
                    return parent.getOrCreateSub(name, (p) =>
                        new TransactionAggregator({ name, parent: p }),
                    );
                },
            });

            root.add(makeTx({ amount: -100, entityName: 'Amazon' }));
            root.add(makeTx({ amount: -50, entityName: 'Amazon' }));
            root.add(makeTx({ amount: -25, entityName: 'Walmart' }));

            expect(root.sum).toBe(-175);
            expect(root.count).toBe(3);

            const subs = root.getSubAggregators();
            expect(subs).toHaveLength(2);

            // getSubAggregators sorts by sum ascending (most negative first).
            expect(subs[0].sum).toBe(-150); // Amazon
            expect(subs[1].sum).toBe(-25);  // Walmart
        });
    });

    // -----------------------------------------------------------------------
    // Sorting
    // -----------------------------------------------------------------------

    describe('sorting', () => {
        it('should sort sub-aggregators by sum ascending (most negative first)', () => {
            const root = new TransactionAggregator({
                name: 'root',
                subAggregateFn: (parent, tx) => {
                    const name = tx.displayEntityNameNormalized;
                    return parent.getOrCreateSub(name, (p) =>
                        new TransactionAggregator({ name, parent: p }),
                    );
                },
            });

            root.add(makeTx({ amount: -10, entityName: 'Small' }));
            root.add(makeTx({ amount: -500, entityName: 'Large' }));
            root.add(makeTx({ amount: -50, entityName: 'Medium' }));

            const subs = root.getSubAggregators();
            expect(subs[0].name).toContain('Large');
            expect(subs[1].name).toContain('Medium');
            expect(subs[2].name).toContain('Small');
        });

        it('should sort leaf transactions by correctedTransactionDate descending', () => {
            const agg = new TransactionAggregator({ name: 'flat' });

            agg.add(makeTx({ amount: -10, transactionDate: '2024-01-01', entityName: 'A' }));
            agg.add(makeTx({ amount: -20, transactionDate: '2024-03-15', entityName: 'B' }));
            agg.add(makeTx({ amount: -30, transactionDate: '2024-02-10', entityName: 'C' }));

            const txs = agg.getTransactions();
            expect(txs[0].correctedTransactionDate).toBe('2024-03-15');
            expect(txs[1].correctedTransactionDate).toBe('2024-02-10');
            expect(txs[2].correctedTransactionDate).toBe('2024-01-01');
        });

        it('should sort sub-aggregators by sortOrder', () => {
            const root = new TransactionAggregator({ name: 'root' });

            const c = new TransactionAggregator({ name: 'C', parent: root });
            c.sortOrder = 3;
            const a = new TransactionAggregator({ name: 'A', parent: root });
            a.sortOrder = 1;
            const b = new TransactionAggregator({ name: 'B', parent: root });
            b.sortOrder = 2;

            root.getOrCreateSub('C', () => c);
            root.getOrCreateSub('A', () => a);
            root.getOrCreateSub('B', () => b);

            const sorted = root.getSubAggregatorsBySortOrder();
            expect(sorted[0].name).toBe('A');
            expect(sorted[1].name).toBe('B');
            expect(sorted[2].name).toBe('C');
        });
    });

    // -----------------------------------------------------------------------
    // Finalize
    // -----------------------------------------------------------------------

    describe('finalize', () => {
        it('should set visibility flags on all nodes', () => {
            const root = new TransactionAggregator({
                name: 'root',
                subAggregateFn: (parent, tx) => {
                    const key = 'group';
                    return parent.getOrCreateSub(key, (p) =>
                        new TransactionAggregator({ name: key, parent: p }),
                    );
                },
            });

            root.add(makeTx({ amount: -10, entityName: 'X' }));
            root.finalize();

            // Root (depth 0) should be visible.
            expect(root.isVisible).toBe(true);

            // Child at depth 1 should also be visible (top-level).
            const child = root.getSubAggregators()[0];
            expect(child).toBeDefined();
            expect(child.isVisible).toBe(true);
        });

        it('should propagate finalize to all sub-aggregators', () => {
            const root = new TransactionAggregator({
                name: 'root',
                subAggregateFn: (parent, tx) => {
                    return parent.getOrCreateSub('child', (p) => {
                        return new TransactionAggregator({
                            name: 'child',
                            parent: p,
                            subAggregateFn: (innerParent) => {
                                return innerParent.getOrCreateSub('grandchild', (gp) =>
                                    new TransactionAggregator({ name: 'grandchild', parent: gp }),
                                );
                            },
                        });
                    });
                },
            });

            root.add(makeTx({ amount: -10, entityName: 'A' }));
            root.finalize();

            const child = root.getSubAggregators()[0];
            const grandchild = child.getSubAggregators()[0];

            // All nodes should have been visited by finalize.
            expect(grandchild).toBeDefined();
            expect(grandchild.count).toBe(1);
        });
    });

    // -----------------------------------------------------------------------
    // getAllTransactions (recursive)
    // -----------------------------------------------------------------------

    describe('getAllTransactions', () => {
        it('should recursively collect all leaf transactions', () => {
            const root = new TransactionAggregator({
                name: 'root',
                subAggregateFn: (parent, tx) => {
                    const name = tx.displayEntityNameNormalized;
                    return parent.getOrCreateSub(name, (p) =>
                        new TransactionAggregator({ name, parent: p }),
                    );
                },
            });

            root.add(makeTx({ amount: -10, entityName: 'A' }));
            root.add(makeTx({ amount: -20, entityName: 'B' }));
            root.add(makeTx({ amount: -30, entityName: 'A' }));

            const all = root.getAllTransactions();
            expect(all).toHaveLength(3);
        });
    });

    // -----------------------------------------------------------------------
    // Key counters
    // -----------------------------------------------------------------------

    describe('key counters', () => {
        it('should track transaction reasons', () => {
            const agg = new TransactionAggregator({ name: 'root' });

            agg.add(makeTx({ amount: -10, entityName: 'A', transactionReason: TransactionReason.Purchase }));
            agg.add(makeTx({ amount: -5, entityName: 'B', transactionReason: TransactionReason.Fee }));
            agg.add(makeTx({ amount: -15, entityName: 'C', transactionReason: TransactionReason.Purchase }));

            expect(agg.transactionReasonCounter.keyCount).toBe(2);
            expect(agg.transactionReasonCounter.getTop()?.key).toBe(TransactionReason.Purchase);
        });

        it('should track account IDs', () => {
            const agg = new TransactionAggregator({ name: 'root' });

            agg.add(makeTx({ amount: -10, entityName: 'A' }));
            agg.add(makeTx({ amount: -20, entityName: 'B' }));

            expect(agg.accountCounter.keyCount).toBe(1);
            expect(agg.accountCounter.getTop()?.key).toBe('acct-amex');
        });
    });

    // -----------------------------------------------------------------------
    // Depth and groupId
    // -----------------------------------------------------------------------

    describe('depth and groupId', () => {
        it('should set depth 0 for root', () => {
            const root = new TransactionAggregator({ name: 'root' });
            expect(root.depth).toBe(0);
        });

        it('should increment depth for children', () => {
            const root = new TransactionAggregator({ name: 'root' });
            const child = new TransactionAggregator({ name: 'child', parent: root });
            const grandchild = new TransactionAggregator({ name: 'grandchild', parent: child });

            expect(child.depth).toBe(1);
            expect(grandchild.depth).toBe(2);
        });

        it('should derive groupId from parent', () => {
            const root = new TransactionAggregator({ name: 'root' });
            const child = new TransactionAggregator({ name: 'child', parent: root });

            expect(root.groupId).toBe('.root');
            expect(child.groupId).toBe('.root.child');
        });

        it('should use explicit groupId when provided', () => {
            const agg = new TransactionAggregator({ name: 'x', groupId: 'custom-id' });
            expect(agg.groupId).toBe('custom-id');
        });
    });
});
