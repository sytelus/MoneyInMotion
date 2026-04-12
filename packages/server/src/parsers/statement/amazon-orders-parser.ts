/**
 * Amazon Orders statement parser, ported from C# AmazonOrdersParser.
 *
 * Handles Amazon order CSV exports with item subtotal detection,
 * order total extraction, attribute handling, and status filtering.
 *
 * @module
 */

import type { ImportedValues } from '@moneyinmotion/core';
import { TransactionReason, LineItemType, isNullOrWhitespace } from '@moneyinmotion/core';
import type { ParsedRow } from '../file-format/types.js';
import { ContentType, createFileFormatParser } from '../file-format/index.js';
import { StatementParserBase, StatementColumnType } from './statement-parser-base.js';

export class AmazonOrdersParser extends StatementParserBase {
    private parsedRows: ParsedRow[];

    constructor(content: string) {
        super();

        const parser = createFileFormatParser(ContentType.Csv);
        this.parsedRows = parser.parse(content);
    }

    protected getTransactionProperties(): ParsedRow[] {
        return this.parsedRows;
    }

    protected override setCalculatedAttributes(importedValues: ImportedValues): void {
        super.setCalculatedAttributes(importedValues);

        const attrs = importedValues.providerAttributes ?? {};

        // Override transaction date with shipment date if available
        const shipmentDateString = attrs['shipment date'];
        if (!isNullOrWhitespace(shipmentDateString)) {
            importedValues.transactionDate = this.parseDateValue(shipmentDateString!);
        }

        // Determine line item type
        importedValues.lineItemType = ('item subtotal' in attrs)
            ? LineItemType.ItemSubtotal
            : LineItemType.None;

        // Parent-child match filter
        importedValues.parentChildMatchFilter =
            `${attrs['order id'] ?? ''}|${attrs['carrier name & tracking number'] ?? ''}`;

        importedValues.instituteReference = this.setImportedValueText(
            importedValues.instituteReference,
            importedValues.parentChildMatchFilter,
            StatementColumnType.InstituteReference,
        );

        importedValues.subAccountName = this.setImportedValueText(
            importedValues.subAccountName,
            attrs['buyer name'] ?? '',
            StatementColumnType.SubAccountName,
        );

        if (importedValues.lineItemType !== LineItemType.None) {
            // Individual item
            importedValues.amount = this.parseAmount(attrs['item subtotal'] ?? '0') * -1;
            importedValues.entityId = attrs['asin/isbn'] ?? null;
        } else {
            // Order total
            importedValues.amount = this.parseAmount(attrs['total charged'] ?? '0') * -1;

            // Parse values for future use
            attrs['total promotions'] = String(this.parseAmount(attrs['total promotions'] ?? '0'));
            attrs['shipping charge'] = String(-1 * this.parseAmount(attrs['shipping charge'] ?? '0'));
            attrs['tax charged'] = String(-1 * this.parseAmount(attrs['tax charged'] ?? '0'));
        }

        importedValues.transactionReason = importedValues.amount <= 0
            ? TransactionReason.Purchase
            : TransactionReason.Return;

        if (isNullOrWhitespace(importedValues.entityName)) {
            if (importedValues.lineItemType !== LineItemType.None) {
                importedValues.entityName =
                    `Amazon ASIN# ${attrs['asin/isbn'] ?? ''} Sold By ${attrs['seller'] ?? ''}, Order# ${attrs['order id'] ?? ''}, Shipment# ${attrs['carrier name & tracking number'] ?? ''}`;
            } else {
                importedValues.entityName =
                    `Amazon Order# ${attrs['order id'] ?? ''}, Shipment# ${attrs['carrier name & tracking number'] ?? ''}`;
            }
            importedValues.entityNameNormalized = importedValues.entityName;
        }
    }

    /**
     * Disable default inference -- Amazon sets reason explicitly.
     */
    protected override inferTransactionReason(importedValues: ImportedValues): number {
        return importedValues.transactionReason ?? TransactionReason.Purchase;
    }

    protected override validateImportedValues(importedValues: ImportedValues): boolean {
        const attrs = importedValues.providerAttributes ?? {};

        // Amazon renamed column "shipment/order condition" to "order status"
        const shippingStatus = (
            attrs['shipment/order condition'] ?? attrs['order status'] ?? ''
        ).toLowerCase();

        if (shippingStatus === 'shipment planned' || shippingStatus === 'shipping soon') {
            return false;
        }

        return super.validateImportedValues(importedValues);
    }

    /**
     * Handle replacement character (0xFFFD) as zero amount.
     */
    protected override parseAmount(columnValue: string): number {
        if (columnValue === '\uFFFD') {
            return 0;
        }
        return super.parseAmount(columnValue);
    }
}
