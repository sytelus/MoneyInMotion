/**
 * Etsy Buyer statement parser, ported from C# EtsyBuyerParser.
 *
 * Parses JSON format Etsy order data with Unix timestamps,
 * grandtotal detection, and receipt-based parent-child matching.
 *
 * @module
 */

import type { ImportedValues } from '@moneyinmotion/core';
import { TransactionReason, LineItemType } from '@moneyinmotion/core';
import type { ParsedRow } from '../file-format/types.js';
import { ContentType, createFileFormatParser } from '../file-format/index.js';
import { StatementParserBase, StatementColumnType } from './statement-parser-base.js';

export class EtsyBuyerParser extends StatementParserBase {
    private parsedRows: ParsedRow[];

    constructor(content: string) {
        super();

        const parser = createFileFormatParser(ContentType.Json);
        this.parsedRows = parser.parse(content, {
            ignoreColumns: new Set(['description']),
        });
    }

    protected getTransactionProperties(): ParsedRow[] {
        return this.parsedRows;
    }

    protected override setCalculatedAttributes(importedValues: ImportedValues): void {
        super.setCalculatedAttributes(importedValues);

        const attrs = importedValues.providerAttributes ?? {};

        if ('grandtotal' in attrs) {
            // Order-level row
            importedValues.amount = this.parseAmount(attrs['grandtotal'] ?? '0') * -1;
            importedValues.lineItemType = LineItemType.None;

            // Parse other values for future use
            attrs['total_tax_cost'] = String(this.parseAmount(attrs['total_tax_cost'] ?? '0') * -1);
            attrs['total_price'] = String(this.parseAmount(attrs['total_price'] ?? '0') * -1);
            attrs['total_shipping_cost'] = String(this.parseAmount(attrs['total_shipping_cost'] ?? '0') * -1);
            attrs['discount_amt'] = String(this.parseAmount(attrs['discount_amt'] ?? '0'));

            importedValues.instituteReference = attrs['receipt_id'] ?? null;
            importedValues.subAccountName = this.setImportedValueText(
                importedValues.subAccountName,
                attrs['name'] ?? '',
                StatementColumnType.SubAccountName,
            );

            // Unix timestamp conversion
            const creationTsz = parseInt(attrs['creation_tsz'] ?? '0', 10);
            importedValues.transactionDate = new Date(creationTsz * 1000).toISOString();

            importedValues.entityName = `Etsy Order# ${attrs['order_id'] ?? ''}`;
        } else {
            // Item-level row
            importedValues.amount = this.parseAmount(attrs['price'] ?? '0') * -1;
            importedValues.lineItemType = LineItemType.ItemSubtotal;

            importedValues.instituteReference = attrs['transaction_id'] ?? null;
            importedValues.subAccountName = this.setImportedValueText(
                importedValues.subAccountName,
                attrs['buyer_user_id'] ?? '',
                StatementColumnType.SubAccountName,
            );

            // Unix timestamp conversion
            const paidTsz = parseInt(attrs['paid_tsz'] ?? '0', 10);
            importedValues.transactionDate = new Date(paidTsz * 1000).toISOString();
        }

        importedValues.parentChildMatchFilter = attrs['receipt_id'] ?? null;
        importedValues.transactionReason = importedValues.amount <= 0
            ? TransactionReason.Purchase
            : TransactionReason.Return;
    }

    /**
     * Disable default inference -- Etsy sets reason explicitly.
     */
    protected override inferTransactionReason(importedValues: ImportedValues): number {
        return importedValues.transactionReason ?? TransactionReason.Purchase;
    }
}
