import { describe, it, expect } from 'vitest';
import { TransactionReason } from '@moneyinmotion/core';
import { BarclayParser } from '../../src/parsers/statement/barclay-parser.js';

describe('BarclayParser', () => {
    it('skips banner lines and parses data correctly', () => {
        const content = [
            'Barclay Bank Statement',                           // banner line (short)
            'Account Summary',                                  // banner line (short)
            'Date,Description,Amount,Balance',                  // real header (4 cols)
            '01/15/2024,Grocery Store,-50.00,1000.00',
            '01/16/2024,Gas Station,-30.00,970.00',
        ].join('\n');

        const parser = new BarclayParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values).toHaveLength(2);
    });

    it('maps date column correctly', () => {
        const content = [
            'Banner Line',
            'Date,Description,Amount,Balance',
            '01/15/2024,Grocery Store,-50.00,1000.00',
        ].join('\n');

        const parser = new BarclayParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values).toHaveLength(1);
        expect(values[0]!.transactionDate).toBeTruthy();
    });

    it('maps description to entity name', () => {
        const content = [
            'Banner Line',
            'Date,Description,Amount,Balance',
            '01/15/2024,Grocery Store,-50.00,1000.00',
        ].join('\n');

        const parser = new BarclayParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.entityName).toBe('Grocery Store');
    });

    it('maps amount correctly for negative values', () => {
        const content = [
            'Banner Line',
            'Date,Description,Amount,Balance',
            '01/15/2024,Grocery Store,-50.00,1000.00',
        ].join('\n');

        const parser = new BarclayParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.amount).toBe(-50.00);
    });

    it('infers Purchase for negative amounts', () => {
        const content = [
            'Banner Line',
            'Date,Description,Amount,Balance',
            '01/15/2024,Grocery Store,-50.00,1000.00',
        ].join('\n');

        const parser = new BarclayParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.transactionReason).toBe(TransactionReason.Purchase);
    });

    it('infers OtherCredit for positive amounts', () => {
        const content = [
            'Banner Line',
            'Date,Description,Amount,Balance',
            '01/20/2024,Deposit,500.00,1500.00',
        ].join('\n');

        const parser = new BarclayParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.transactionReason).toBe(TransactionReason.OtherCredit);
    });

    it('ignores balance column', () => {
        const content = [
            'Banner Line',
            'Date,Description,Amount,Balance',
            '01/15/2024,Store,-25.00,975.00',
        ].join('\n');

        const parser = new BarclayParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values).toHaveLength(1);
        // Balance column should be ignored (StatementColumnType.Ignore)
        // so it should not appear in providerAttributes
        expect(values[0]!.providerAttributes?.['balance']).toBeUndefined();
    });

    it('handles multiple banner lines before the header', () => {
        const content = [
            'Line 1',
            'Line 2',
            'Line 3',
            'Date,Description,Amount,Balance',
            '01/15/2024,Grocery Store,-50.00,1000.00',
        ].join('\n');

        const parser = new BarclayParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values).toHaveLength(1);
        expect(values[0]!.entityName).toBe('Grocery Store');
    });
});
