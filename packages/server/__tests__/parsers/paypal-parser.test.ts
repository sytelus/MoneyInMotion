import { describe, it, expect } from 'vitest';
import { TransactionReason, getMD5HashString } from '@moneyinmotion/core';
import { PayPalParser } from '../../src/parsers/statement/paypal-parser.js';
import { ContentType } from '../../src/parsers/file-format/index.js';

/**
 * Build a minimal PayPal CSV string.
 * Columns: date, time, time zone, name, type, status, amount, memo
 */
function buildPayPalCsv(rows: Record<string, string>[]): string {
    const headers = ['date', 'time', 'time zone', 'name', 'type', 'status', 'amount', 'memo'];
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => row[h] ?? '').join(','));
    }
    return lines.join('\n');
}

describe('PayPalParser', () => {
    describe('type-to-reason mapping', () => {
        it('maps "Payment Sent" to Purchase', () => {
            const csv = buildPayPalCsv([
                {
                    date: '01/15/2024',
                    time: '10:30:00',
                    'time zone': 'PST',
                    name: 'ACME Corp',
                    type: 'Payment Sent',
                    status: 'Completed',
                    amount: '-25.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.transactionReason).toBe(TransactionReason.Purchase);
        });

        it('maps "Donation Sent" to Purchase', () => {
            const csv = buildPayPalCsv([
                {
                    date: '01/15/2024',
                    time: '10:30:00',
                    'time zone': 'PST',
                    name: 'Charity Org',
                    type: 'Donation Sent',
                    status: 'Completed',
                    amount: '-50.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.transactionReason).toBe(TransactionReason.Purchase);
        });

        it('maps "Refund" to Return', () => {
            const csv = buildPayPalCsv([
                {
                    date: '01/20/2024',
                    time: '14:00:00',
                    'time zone': 'PST',
                    name: 'Vendor',
                    type: 'Refund',
                    status: 'Completed',
                    amount: '10.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.transactionReason).toBe(TransactionReason.Return);
        });

        it('maps "Payment Received" to PaymentRecieved', () => {
            const csv = buildPayPalCsv([
                {
                    date: '02/01/2024',
                    time: '09:00:00',
                    'time zone': 'EST',
                    name: 'Client',
                    type: 'Payment Received',
                    status: 'Completed',
                    amount: '100.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.transactionReason).toBe(TransactionReason.PaymentRecieved);
        });

        it('maps "BillPay" to Purchase', () => {
            const csv = buildPayPalCsv([
                {
                    date: '02/01/2024',
                    time: '09:00:00',
                    'time zone': 'PST',
                    name: 'Utility Co',
                    type: 'BillPay',
                    status: 'Completed',
                    amount: '-75.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.transactionReason).toBe(TransactionReason.Purchase);
        });

        it('maps "Charge from Visa card" to InterAccountPayment', () => {
            const csv = buildPayPalCsv([
                {
                    date: '02/01/2024',
                    time: '09:00:00',
                    'time zone': 'PST',
                    name: 'PayPal',
                    type: 'Charge from Visa card',
                    status: 'Completed',
                    amount: '-200.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.transactionReason).toBe(TransactionReason.InterAccountPayment);
        });

        it('maps "Credit to Visa card" to InterAccountTransfer', () => {
            const csv = buildPayPalCsv([
                {
                    date: '02/01/2024',
                    time: '09:00:00',
                    'time zone': 'PST',
                    name: 'PayPal',
                    type: 'Credit to Visa card',
                    status: 'Completed',
                    amount: '200.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.transactionReason).toBe(TransactionReason.InterAccountTransfer);
        });

        it('maps "Add funds from a bank account" to InterAccountTransfer', () => {
            const csv = buildPayPalCsv([
                {
                    date: '02/01/2024',
                    time: '09:00:00',
                    'time zone': 'PST',
                    name: 'Bank of America',
                    type: 'Add funds from a bank account',
                    status: 'Completed',
                    amount: '500.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.transactionReason).toBe(TransactionReason.InterAccountTransfer);
        });
    });

    describe('ignorable activity filtering', () => {
        it.each([
            'Denied',
            'Removed',
            'Placed',
            'Canceled',
            'Cleared',
            'Failed',
            'Refunded',
        ])('filters out transactions with status "%s"', (status) => {
            const csv = buildPayPalCsv([
                {
                    date: '01/15/2024',
                    time: '10:30:00',
                    'time zone': 'PST',
                    name: 'SomeVendor',
                    type: 'Payment Sent',
                    status,
                    amount: '-25.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(0);
        });

        it('filters out types starting with "Update to"', () => {
            const csv = buildPayPalCsv([
                {
                    date: '01/15/2024',
                    time: '10:30:00',
                    'time zone': 'PST',
                    name: 'SomeVendor',
                    type: 'Update to Payment Sent',
                    status: 'Completed',
                    amount: '-25.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(0);
        });

        it('filters out "Authorization" type', () => {
            const csv = buildPayPalCsv([
                {
                    date: '01/15/2024',
                    time: '10:30:00',
                    'time zone': 'PST',
                    name: 'SomeVendor',
                    type: 'Authorization',
                    status: 'Completed',
                    amount: '-25.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(0);
        });

        it('filters out "Temporary Hold" type', () => {
            const csv = buildPayPalCsv([
                {
                    date: '01/15/2024',
                    time: '10:30:00',
                    'time zone': 'PST',
                    name: 'SomeVendor',
                    type: 'Temporary Hold',
                    status: 'Completed',
                    amount: '-25.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(0);
        });
    });

    describe('date+time+timezone assembly', () => {
        it('assembles date, time, and timezone into a valid ISO date', () => {
            const csv = buildPayPalCsv([
                {
                    date: '03/15/2024',
                    time: '14:30:00',
                    'time zone': 'PST',
                    name: 'TestVendor',
                    type: 'Payment Sent',
                    status: 'Completed',
                    amount: '-10.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.transactionDate).toBeTruthy();
            // The date should parse to a valid ISO string
            const parsedDate = new Date(values[0]!.transactionDate);
            expect(parsedDate.getTime()).not.toBeNaN();
        });

        it('handles EDT timezone', () => {
            const csv = buildPayPalCsv([
                {
                    date: '06/15/2024',
                    time: '08:00:00',
                    'time zone': 'EDT',
                    name: 'TestVendor',
                    type: 'Payment Sent',
                    status: 'Completed',
                    amount: '-10.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.transactionDate).toBeTruthy();
        });
    });

    describe('custom content hash generation', () => {
        it('generates content hash from name, date, amount, and type', () => {
            const csv = buildPayPalCsv([
                {
                    date: '01/15/2024',
                    time: '10:30:00',
                    'time zone': 'PST',
                    name: 'ACME Corp',
                    type: 'Payment Sent',
                    status: 'Completed',
                    amount: '-25.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.contentHash).toBeTruthy();

            // Verify the hash matches the expected computation
            const expectedHash = getMD5HashString(
                ['ACME Corp', '01/15/2024', '-25.00', 'Payment Sent']
                    .map((s) => s.toUpperCase())
                    .join('\t'),
                true,
            );
            expect(values[0]!.contentHash).toBe(expectedHash);
        });

        it('produces different hashes for different transactions', () => {
            const csv = buildPayPalCsv([
                {
                    date: '01/15/2024',
                    time: '10:30:00',
                    'time zone': 'PST',
                    name: 'Vendor A',
                    type: 'Payment Sent',
                    status: 'Completed',
                    amount: '-25.00',
                },
                {
                    date: '01/16/2024',
                    time: '11:00:00',
                    'time zone': 'PST',
                    name: 'Vendor B',
                    type: 'Payment Sent',
                    status: 'Completed',
                    amount: '-50.00',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(2);
            expect(values[0]!.contentHash).not.toBe(values[1]!.contentHash);
        });
    });

    describe('entity name construction', () => {
        it('combines memo and name when memo is present', () => {
            const csv = buildPayPalCsv([
                {
                    date: '01/15/2024',
                    time: '10:30:00',
                    'time zone': 'PST',
                    name: 'ACME Corp',
                    type: 'Payment Sent',
                    status: 'Completed',
                    amount: '-25.00',
                    memo: 'Invoice #123',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.entityName).toBe('Invoice #123 - ACME Corp');
        });

        it('uses only name when memo is empty', () => {
            const csv = buildPayPalCsv([
                {
                    date: '01/15/2024',
                    time: '10:30:00',
                    'time zone': 'PST',
                    name: 'ACME Corp',
                    type: 'Payment Sent',
                    status: 'Completed',
                    amount: '-25.00',
                    memo: '',
                },
            ]);

            const parser = new PayPalParser(csv, ContentType.Csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.entityName).toBe('ACME Corp');
        });
    });
});
