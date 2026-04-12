import { describe, it, expect } from 'vitest';
import { TransactionReason } from '@moneyinmotion/core';
import { GenericStatementParser } from '../../src/parsers/statement/generic-statement-parser.js';
import { ContentType } from '../../src/parsers/file-format/types.js';

describe('StatementParserBase (via GenericStatementParser)', () => {
    describe('column mapping', () => {
        it('maps standard column names to correct imported value fields', () => {
            const csv = [
                'Transaction Date,Description,Amount',
                '01/15/2024,WHOLE FOODS,-45.99',
            ].join('\n');

            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.entityName).toBe('WHOLE FOODS');
            expect(values[0]!.amount).toBe(-45.99);
            expect(values[0]!.transactionDate).toBeTruthy();
        });

        it('maps debit and credit columns separately', () => {
            const csv = [
                'Date,Description,Debit,Credit',
                '01/15/2024,PURCHASE,50.00,',
                '01/16/2024,REFUND,,25.00',
            ].join('\n');

            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(2);
            expect(values[0]!.amount).toBe(-50.00); // debit is negated
            expect(values[1]!.amount).toBe(25.00);  // credit is positive
        });

        it('maps post date column', () => {
            const csv = [
                'Transaction Date,Post Date,Description,Amount',
                '01/15/2024,01/16/2024,STORE,-10.00',
            ].join('\n');

            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.postedDate).toBeTruthy();
        });

        it('maps check reference column', () => {
            const csv = [
                'Date,Description,Amount,ChkRef',
                '01/15/2024,CHECK PAYMENT,-500.00,1234',
            ].join('\n');

            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.checkReference).toBe('1234');
        });

        it('maps unmapped columns to provider attributes', () => {
            const csv = [
                'Date,Description,Amount,SomeCustom',
                '01/15/2024,STORE,-10.00,custom-value',
            ].join('\n');

            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.providerAttributes).toBeTruthy();
            expect(values[0]!.providerAttributes!['somecustom']).toBe('custom-value');
        });
    });

    describe('transaction reason inference', () => {
        it('infers Purchase for negative amount', () => {
            const csv = 'Date,Description,Amount\n01/15/2024,STORE,-25.00\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.Purchase);
        });

        it('infers Fee for negative amount with FEE in name', () => {
            const csv = 'Date,Description,Amount\n01/15/2024,MONTHLY FEE,-12.00\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.Fee);
        });

        it('infers AtmWithdrawal for negative amount with ATM in name', () => {
            const csv = 'Date,Description,Amount\n01/15/2024,ATM WITHDRAWAL,-200.00\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.AtmWithdrawal);
        });

        it('infers LoanPayment for negative amount with LOAN in name', () => {
            const csv = 'Date,Description,Amount\n01/15/2024,AUTO LOAN PAYMENT,-350.00\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.LoanPayment);
        });

        it('infers CheckPayment for negative amount with check reference', () => {
            const csv = 'Date,Description,Amount,ChkRef\n01/15/2024,CHECK,-500.00,1234\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.CheckPayment);
        });

        it('infers OtherCredit for positive amount', () => {
            const csv = 'Date,Description,Amount\n01/15/2024,SOME CREDIT,50.00\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.OtherCredit);
        });

        it('infers Interest for positive amount with INTEREST in name', () => {
            const csv = 'Date,Description,Amount\n01/15/2024,INTEREST PAYMENT,2.50\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.Interest);
        });

        it('infers Return for positive amount with REFUND in name', () => {
            const csv = 'Date,Description,Amount\n01/15/2024,REFUND - AMAZON,15.99\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.Return);
        });

        it('infers Return for positive amount with RETURN in name', () => {
            const csv = 'Date,Description,Amount\n01/15/2024,RETURN CREDIT,10.00\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.Return);
        });

        it('infers PointsCredit for positive amount with POINTS CREDIT in name', () => {
            const csv = 'Date,Description,Amount\n01/15/2024,POINTS CREDIT REWARD,5.00\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.PointsCredit);
        });

        it('parses explicit type column', () => {
            const csv = 'Date,Description,Amount,Type\n01/15/2024,STORE,-25.00,Sale\n';
            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.Purchase);
        });
    });

    describe('line numbering', () => {
        it('assigns sequential line numbers', () => {
            const csv = [
                'Date,Description,Amount',
                '01/15/2024,STORE1,-10.00',
                '01/16/2024,STORE2,-20.00',
                '01/17/2024,STORE3,-30.00',
            ].join('\n');

            const parser = new GenericStatementParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.lineNumber).toBe(1);
            expect(values[1]!.lineNumber).toBe(2);
            expect(values[2]!.lineNumber).toBe(3);
        });
    });
});
