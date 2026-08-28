import { describe, it, expect } from 'vitest';
import { TransactionReason, LineItemType } from '@moneyinmotion/core';
import { EtsyBuyerParser } from '../../src/parsers/statement/etsy-buyer-parser.js';

describe('EtsyBuyerParser', () => {
    it('detects order row when grandtotal is present', () => {
        const content = JSON.stringify([
            {
                receipt_id: 'R100',
                order_id: '5001',
                grandtotal: '25.99',
                total_tax_cost: '2.00',
                total_price: '20.99',
                total_shipping_cost: '3.00',
                discount_amt: '0',
                creation_tsz: '1700000000',
                name: 'Seller Shop',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values).toHaveLength(1);
        expect(values[0]!.lineItemType).toBe(LineItemType.None);
    });

    it('detects line item when grandtotal is absent', () => {
        const content = JSON.stringify([
            {
                receipt_id: 'R100',
                transaction_id: 'T200',
                price: '15.00',
                paid_tsz: '1700000000',
                buyer_user_id: 'buyer123',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values).toHaveLength(1);
        expect(values[0]!.lineItemType).toBe(LineItemType.ItemSubtotal);
    });

    it('converts Unix timestamps to ISO dates for order rows', () => {
        // 1700000000 seconds = 2023-11-14T22:13:20.000Z
        const content = JSON.stringify([
            {
                receipt_id: 'R100',
                order_id: '5001',
                grandtotal: '10.00',
                total_tax_cost: '0',
                total_price: '10.00',
                total_shipping_cost: '0',
                discount_amt: '0',
                creation_tsz: '1700000000',
                name: 'Shop',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.transactionDate).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it('converts Unix timestamps to ISO dates for line item rows', () => {
        const content = JSON.stringify([
            {
                receipt_id: 'R100',
                transaction_id: 'T200',
                price: '15.00',
                paid_tsz: '1700000000',
                buyer_user_id: 'buyer123',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.transactionDate).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it('negates amounts for purchases (order row)', () => {
        const content = JSON.stringify([
            {
                receipt_id: 'R100',
                order_id: '5001',
                grandtotal: '25.99',
                total_tax_cost: '0',
                total_price: '25.99',
                total_shipping_cost: '0',
                discount_amt: '0',
                creation_tsz: '1700000000',
                name: 'Shop',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.amount).toBe(-25.99);
    });

    it('negates amounts for purchases (line item row)', () => {
        const content = JSON.stringify([
            {
                receipt_id: 'R100',
                transaction_id: 'T200',
                price: '15.00',
                paid_tsz: '1700000000',
                buyer_user_id: 'buyer123',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.amount).toBe(-15.00);
    });

    it('sets parentChildMatchFilter from receipt_id', () => {
        const receiptId = 'R12345';
        const content = JSON.stringify([
            {
                receipt_id: receiptId,
                order_id: '5001',
                grandtotal: '10.00',
                total_tax_cost: '0',
                total_price: '10.00',
                total_shipping_cost: '0',
                discount_amt: '0',
                creation_tsz: '1700000000',
                name: 'Shop',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.parentChildMatchFilter).toBe(receiptId);
    });

    it('sets transactionReason to Purchase for negative amounts', () => {
        const content = JSON.stringify([
            {
                receipt_id: 'R100',
                order_id: '5001',
                grandtotal: '25.99',
                total_tax_cost: '0',
                total_price: '25.99',
                total_shipping_cost: '0',
                discount_amt: '0',
                creation_tsz: '1700000000',
                name: 'Shop',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.transactionReason).toBe(TransactionReason.Purchase);
    });

    it('sets entityName with order_id for order rows', () => {
        const content = JSON.stringify([
            {
                receipt_id: 'R100',
                order_id: '5001',
                grandtotal: '10.00',
                total_tax_cost: '0',
                total_price: '10.00',
                total_shipping_cost: '0',
                discount_amt: '0',
                creation_tsz: '1700000000',
                name: 'Shop',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.entityName).toBe('Etsy Order# 5001');
    });

    it('sets instituteReference from receipt_id for order rows', () => {
        const content = JSON.stringify([
            {
                receipt_id: 'R100',
                order_id: '5001',
                grandtotal: '10.00',
                total_tax_cost: '0',
                total_price: '10.00',
                total_shipping_cost: '0',
                discount_amt: '0',
                creation_tsz: '1700000000',
                name: 'Shop',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.instituteReference).toBe('R100');
    });

    it('sets instituteReference from transaction_id for line item rows', () => {
        const content = JSON.stringify([
            {
                receipt_id: 'R100',
                transaction_id: 'T200',
                price: '15.00',
                paid_tsz: '1700000000',
                buyer_user_id: 'buyer123',
            },
        ]);

        const parser = new EtsyBuyerParser(content);
        const values = parser.getTransactionImportedValues();

        expect(values[0]!.instituteReference).toBe('T200');
    });
});
