import { describe, it, expect } from 'vitest';
import { TransactionAggregates } from '../../src/aggregation/transaction-aggregates.js';
import { TransactionReason } from '../../src/models/transaction-reason.js';

// ---------------------------------------------------------------------------
// Basic add / totals
// ---------------------------------------------------------------------------

describe('TransactionAggregates', () => {
    it('should start with zero totals', () => {
        const agg = new TransactionAggregates();

        expect(agg.positiveTotal).toBe(0);
        expect(agg.negativeTotal).toBe(0);
        expect(agg.netTotal).toBe(0);
        expect(agg.count).toBe(0);
        expect(agg.byReason.size).toBe(0);
    });

    it('should accumulate positive amounts', () => {
        const agg = new TransactionAggregates();
        agg.add(100, TransactionReason.Return);
        agg.add(50, TransactionReason.Interest);

        expect(agg.positiveTotal).toBe(150);
        expect(agg.negativeTotal).toBe(0);
        expect(agg.netTotal).toBe(150);
        expect(agg.count).toBe(2);
    });

    it('should accumulate negative amounts', () => {
        const agg = new TransactionAggregates();
        agg.add(-75.50, TransactionReason.Purchase);
        agg.add(-24.50, TransactionReason.Fee);

        expect(agg.positiveTotal).toBe(0);
        expect(agg.negativeTotal).toBe(-100);
        expect(agg.netTotal).toBe(-100);
        expect(agg.count).toBe(2);
    });

    it('should compute net total from mixed positive and negative', () => {
        const agg = new TransactionAggregates();
        agg.add(-200, TransactionReason.Purchase);
        agg.add(50, TransactionReason.Return);
        agg.add(-10, TransactionReason.Fee);
        agg.add(30, TransactionReason.Interest);

        expect(agg.positiveTotal).toBe(80);
        expect(agg.negativeTotal).toBe(-210);
        expect(agg.netTotal).toBe(-130);
        expect(agg.count).toBe(4);
    });

    it('should treat zero amounts as positive', () => {
        const agg = new TransactionAggregates();
        agg.add(0, TransactionReason.Purchase);

        expect(agg.positiveTotal).toBe(0);
        expect(agg.negativeTotal).toBe(0);
        expect(agg.count).toBe(1);
    });

    // -----------------------------------------------------------------------
    // byReason tracking
    // -----------------------------------------------------------------------

    describe('byReason', () => {
        it('should track totals per reason', () => {
            const agg = new TransactionAggregates();
            agg.add(-50, TransactionReason.Purchase);
            agg.add(-30, TransactionReason.Purchase);
            agg.add(10, TransactionReason.Return);

            expect(agg.byReason.get(TransactionReason.Purchase)).toBe(-80);
            expect(agg.byReason.get(TransactionReason.Return)).toBe(10);
            expect(agg.byReason.size).toBe(2);
        });

        it('should handle a single reason', () => {
            const agg = new TransactionAggregates();
            agg.add(-100, TransactionReason.Fee);

            expect(agg.byReason.get(TransactionReason.Fee)).toBe(-100);
            expect(agg.byReason.size).toBe(1);
        });
    });

    // -----------------------------------------------------------------------
    // format
    // -----------------------------------------------------------------------

    describe('format', () => {
        it('should format non-zero reason totals sorted by absolute value', () => {
            const agg = new TransactionAggregates();
            agg.add(-123.45, TransactionReason.Purchase);
            agg.add(45, TransactionReason.Return);

            const formatted = agg.format();
            // Return ($45) has smaller abs value than Purchase ($123.45)
            expect(formatted).toBe('Return: $45.00    Purchase: -$123.45');
        });

        it('should exclude reasons with zero total', () => {
            const agg = new TransactionAggregates();
            agg.add(-50, TransactionReason.Purchase);
            agg.add(50, TransactionReason.Purchase); // nets to zero
            agg.add(-10, TransactionReason.Fee);

            const formatted = agg.format();
            expect(formatted).toBe('Fee: -$10.00');
        });

        it('should return an empty string when there are no entries', () => {
            const agg = new TransactionAggregates();
            expect(agg.format()).toBe('');
        });

        it('should format a single entry', () => {
            const agg = new TransactionAggregates();
            agg.add(-2.50, TransactionReason.Fee);

            expect(agg.format()).toBe('Fee: -$2.50');
        });
    });
});
