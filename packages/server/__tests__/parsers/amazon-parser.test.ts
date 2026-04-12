import { describe, it, expect } from 'vitest';
import { TransactionReason, LineItemType } from '@moneyinmotion/core';
import { AmazonOrdersParser } from '../../src/parsers/statement/amazon-orders-parser.js';

/**
 * Build a minimal Amazon orders CSV string.
 *
 * The parser uses lowercase column names from the CSV header row.
 * Item subtotal presence toggles line-item vs order-total mode.
 */
function buildAmazonCsv(
    rows: Record<string, string>[],
    columns?: string[],
): string {
    const defaultColumns = [
        'order id',
        'order date',
        'shipment date',
        'shipment/order condition',
        'title',
        'buyer name',
        'carrier name & tracking number',
        'asin/isbn',
        'seller',
        'item subtotal',
        'total charged',
        'total promotions',
        'shipping charge',
        'tax charged',
    ];
    const headers = columns ?? defaultColumns;
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => row[h] ?? '').join(','));
    }
    return lines.join('\n');
}

describe('AmazonOrdersParser', () => {
    describe('item subtotal vs order total detection', () => {
        it('detects ItemSubtotal when "item subtotal" column is present', () => {
            const csv = buildAmazonCsv([
                {
                    'order id': 'ORD-001',
                    'order date': '01/15/2024',
                    'shipment date': '01/17/2024',
                    'shipment/order condition': 'Shipped',
                    title: 'Widget A',
                    'buyer name': 'John Doe',
                    'carrier name & tracking number': 'UPS-123',
                    'asin/isbn': 'B0001',
                    seller: 'Widgets Inc',
                    'item subtotal': '$12.99',
                },
            ]);

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.lineItemType).toBe(LineItemType.ItemSubtotal);
            // Item subtotal amount is negated
            expect(values[0]!.amount).toBe(-12.99);
        });

        it('detects order total when "item subtotal" column is absent', () => {
            const columns = [
                'order id',
                'order date',
                'shipment date',
                'shipment/order condition',
                'title',
                'buyer name',
                'carrier name & tracking number',
                'total charged',
                'total promotions',
                'shipping charge',
                'tax charged',
            ];
            const csv = buildAmazonCsv(
                [
                    {
                        'order id': 'ORD-001',
                        'order date': '01/15/2024',
                        'shipment date': '01/17/2024',
                        'shipment/order condition': 'Shipped',
                        title: 'Widget A',
                        'buyer name': 'John Doe',
                        'carrier name & tracking number': 'UPS-123',
                        'total charged': '$25.99',
                        'total promotions': '$0.00',
                        'shipping charge': '$5.00',
                        'tax charged': '$2.00',
                    },
                ],
                columns,
            );

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            expect(values[0]!.lineItemType).toBe(LineItemType.None);
            // Order total is negated
            expect(values[0]!.amount).toBe(-25.99);
        });

        it('sets Purchase reason for negative amounts', () => {
            const csv = buildAmazonCsv([
                {
                    'order id': 'ORD-001',
                    'order date': '01/15/2024',
                    'shipment date': '01/17/2024',
                    'shipment/order condition': 'Shipped',
                    title: 'Widget A',
                    'buyer name': 'John Doe',
                    'carrier name & tracking number': 'UPS-123',
                    'asin/isbn': 'B0001',
                    seller: 'Widgets Inc',
                    'item subtotal': '$12.99',
                },
            ]);

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.transactionReason).toBe(TransactionReason.Purchase);
        });

        it('sets Return reason for positive amounts (refunds)', () => {
            const csv = buildAmazonCsv([
                {
                    'order id': 'ORD-002',
                    'order date': '01/15/2024',
                    'shipment date': '01/17/2024',
                    'shipment/order condition': 'Shipped',
                    title: 'Widget B',
                    'buyer name': 'John Doe',
                    'carrier name & tracking number': 'UPS-456',
                    'asin/isbn': 'B0002',
                    seller: 'Widgets Inc',
                    'item subtotal': '-$5.00',
                },
            ]);

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            // amount = parseAmount("-$5.00") * -1 = (-5) * -1 = 5 (positive => Return)
            expect(values[0]!.amount).toBe(5.00);
            expect(values[0]!.transactionReason).toBe(TransactionReason.Return);
        });
    });

    describe('status filtering', () => {
        it('skips rows with "shipment planned" status', () => {
            const csv = buildAmazonCsv([
                {
                    'order id': 'ORD-001',
                    'order date': '01/15/2024',
                    'shipment date': '01/17/2024',
                    'shipment/order condition': 'Shipment Planned',
                    title: 'Widget A',
                    'buyer name': 'John Doe',
                    'carrier name & tracking number': 'UPS-123',
                    'asin/isbn': 'B0001',
                    seller: 'Widgets Inc',
                    'item subtotal': '$12.99',
                },
            ]);

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(0);
        });

        it('skips rows with "shipping soon" status', () => {
            const csv = buildAmazonCsv([
                {
                    'order id': 'ORD-001',
                    'order date': '01/15/2024',
                    'shipment date': '',
                    'shipment/order condition': 'Shipping Soon',
                    title: 'Widget A',
                    'buyer name': 'John Doe',
                    'carrier name & tracking number': '',
                    'asin/isbn': 'B0001',
                    seller: 'Widgets Inc',
                    'item subtotal': '$12.99',
                },
            ]);

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(0);
        });

        it('uses "order status" column as alternative to "shipment/order condition"', () => {
            const columns = [
                'order id',
                'order date',
                'shipment date',
                'order status',
                'title',
                'buyer name',
                'carrier name & tracking number',
                'asin/isbn',
                'seller',
                'item subtotal',
            ];
            const csv = buildAmazonCsv(
                [
                    {
                        'order id': 'ORD-001',
                        'order date': '01/15/2024',
                        'shipment date': '',
                        'order status': 'Shipment Planned',
                        title: 'Widget A',
                        'buyer name': 'John Doe',
                        'carrier name & tracking number': '',
                        'asin/isbn': 'B0001',
                        seller: 'Widgets Inc',
                        'item subtotal': '$12.99',
                    },
                ],
                columns,
            );

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(0);
        });

        it('keeps rows with "Shipped" status', () => {
            const csv = buildAmazonCsv([
                {
                    'order id': 'ORD-001',
                    'order date': '01/15/2024',
                    'shipment date': '01/17/2024',
                    'shipment/order condition': 'Shipped',
                    title: 'Widget A',
                    'buyer name': 'John Doe',
                    'carrier name & tracking number': 'UPS-123',
                    'asin/isbn': 'B0001',
                    seller: 'Widgets Inc',
                    'item subtotal': '$12.99',
                },
            ]);

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
        });
    });

    describe('replacement character handling', () => {
        it('treats replacement character (U+FFFD) as zero amount', () => {
            const csv = buildAmazonCsv([
                {
                    'order id': 'ORD-001',
                    'order date': '01/15/2024',
                    'shipment date': '01/17/2024',
                    'shipment/order condition': 'Shipped',
                    title: 'Widget A',
                    'buyer name': 'John Doe',
                    'carrier name & tracking number': 'UPS-123',
                    'asin/isbn': 'B0001',
                    seller: 'Widgets Inc',
                    'item subtotal': '\uFFFD',
                },
            ]);

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            // parseAmount('\uFFFD') returns 0, then * -1 = -0
            expect(values[0]!.amount).toBe(-0);
        });
    });

    describe('shipment date override', () => {
        it('overrides transaction date with shipment date when available', () => {
            const csv = buildAmazonCsv([
                {
                    'order id': 'ORD-001',
                    'order date': '01/10/2024',
                    'shipment date': '01/17/2024',
                    'shipment/order condition': 'Shipped',
                    title: 'Widget A',
                    'buyer name': 'John Doe',
                    'carrier name & tracking number': 'UPS-123',
                    'asin/isbn': 'B0001',
                    seller: 'Widgets Inc',
                    'item subtotal': '$12.99',
                },
            ]);

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            // The transaction date should reflect the shipment date, not order date
            const txDate = new Date(values[0]!.transactionDate);
            expect(txDate.getUTCMonth()).toBe(0); // January
            expect(txDate.getUTCDate()).toBe(17);
        });

        it('does not set transaction date when shipment date is empty and no date column is mapped', () => {
            const csv = buildAmazonCsv([
                {
                    'order id': 'ORD-001',
                    'order date': '01/10/2024',
                    'shipment date': '',
                    'shipment/order condition': 'Shipped',
                    title: 'Widget A',
                    'buyer name': 'John Doe',
                    'carrier name & tracking number': 'UPS-123',
                    'asin/isbn': 'B0001',
                    seller: 'Widgets Inc',
                    'item subtotal': '$12.99',
                },
            ]);

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values).toHaveLength(1);
            // "order date" is not a recognized date column by the base parser
            // (it maps "date" or "transaction date"), so without a shipment
            // date the transaction date is not set.
            expect(values[0]!.transactionDate).toBeUndefined();
        });
    });

    describe('entity name construction', () => {
        it('builds entity name with ASIN for line items', () => {
            const csv = buildAmazonCsv([
                {
                    'order id': 'ORD-001',
                    'order date': '01/15/2024',
                    'shipment date': '01/17/2024',
                    'shipment/order condition': 'Shipped',
                    title: '',
                    'buyer name': 'John Doe',
                    'carrier name & tracking number': 'UPS-123',
                    'asin/isbn': 'B0001',
                    seller: 'Widgets Inc',
                    'item subtotal': '$12.99',
                },
            ]);

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.entityName).toContain('Amazon ASIN# B0001');
            expect(values[0]!.entityName).toContain('Sold By Widgets Inc');
            expect(values[0]!.entityName).toContain('Order# ORD-001');
        });

        it('builds entity name with Order# for order totals', () => {
            const columns = [
                'order id',
                'order date',
                'shipment date',
                'shipment/order condition',
                'title',
                'buyer name',
                'carrier name & tracking number',
                'total charged',
                'total promotions',
                'shipping charge',
                'tax charged',
            ];
            const csv = buildAmazonCsv(
                [
                    {
                        'order id': 'ORD-001',
                        'order date': '01/15/2024',
                        'shipment date': '01/17/2024',
                        'shipment/order condition': 'Shipped',
                        title: '',
                        'buyer name': 'John Doe',
                        'carrier name & tracking number': 'UPS-123',
                        'total charged': '$25.99',
                        'total promotions': '$0.00',
                        'shipping charge': '$5.00',
                        'tax charged': '$2.00',
                    },
                ],
                columns,
            );

            const parser = new AmazonOrdersParser(csv);
            const values = parser.getTransactionImportedValues();

            expect(values[0]!.entityName).toContain('Amazon Order# ORD-001');
            expect(values[0]!.entityName).toContain('Shipment# UPS-123');
        });
    });
});
