import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TransactionReason } from '@moneyinmotion/core';
import { AmexParser } from '../../src/parsers/statement/amex-parser.js';

const FIXTURES_DIR = path.join(import.meta.dirname, '..', 'fixtures');

describe('AmexParser', () => {
    it('parses Amex CSV with fixed column layout', () => {
        const content = fs.readFileSync(
            path.join(FIXTURES_DIR, 'amex-sample.csv'),
            'utf-8',
        );

        const parser = new AmexParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values).toHaveLength(3);
    });

    it('extracts transaction date from first column', () => {
        const content = '01/15/2024,Reference: ABC123,-45.99,WHOLE FOODS,GROCERY STORE  Groceries\n';
        const parser = new AmexParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values).toHaveLength(1);
        expect(values[0]!.transactionDate).toBeTruthy();
    });

    it('extracts entity name from description column', () => {
        const content = '01/15/2024,Reference: ABC123,-45.99,WHOLE FOODS MARKET,STORE  Groceries\n';
        const parser = new AmexParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.entityName).toBe('WHOLE FOODS MARKET');
    });

    it('extracts amount correctly', () => {
        const content = '01/15/2024,Reference: ABC123,-45.99,STORE,RETAIL  Shopping\n';
        const parser = new AmexParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.amount).toBe(-45.99);
    });

    it('extracts category from other info (letters)', () => {
        const content = '01/15/2024,Reference: ABC123,-45.99,STORE,RETAIL STORE  Groceries\n';
        const parser = new AmexParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.providerCategoryName).toBe('Groceries');
    });

    it('extracts phone number from other info (digits)', () => {
        const content = '01/15/2024,Reference: ABC123,-10.00,STORE,CITY  800-555-1234\n';
        const parser = new AmexParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.phoneNumber).toBe('800-555-1234');
    });

    it('extracts reference number from amex reference column', () => {
        const content = '01/15/2024,Reference: 320240116ABC123,-45.99,STORE,RETAIL  Shopping\n';
        const parser = new AmexParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.instituteReference).toBe('320240116ABC123');
    });

    it('handles positive amounts as credits', () => {
        const content = '01/20/2024,Reference: ABC789,125.00,AMEX PAYMENT THANK YOU,\n';
        const parser = new AmexParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.amount).toBe(125.00);
        expect(values[0]!.transactionReason).toBe(TransactionReason.OtherCredit);
    });

    it('infers Purchase for negative amounts', () => {
        const content = '01/15/2024,Reference: ABC123,-45.99,STORE,RETAIL  Shopping\n';
        const parser = new AmexParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.transactionReason).toBe(TransactionReason.Purchase);
    });
});
