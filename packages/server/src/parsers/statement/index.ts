/**
 * Statement parsers barrel export and factory.
 *
 * @module
 */

export { StatementParserBase, StatementColumnType } from './statement-parser-base.js';
export { GenericStatementParser } from './generic-statement-parser.js';
export { AmexParser } from './amex-parser.js';
export { PayPalParser } from './paypal-parser.js';
export { AmazonOrdersParser } from './amazon-orders-parser.js';
export { EtsyBuyerParser } from './etsy-buyer-parser.js';
export { BarclayParser } from './barclay-parser.js';

import type { AccountType } from '@moneyinmotion/core';
import { AccountType as AT } from '@moneyinmotion/core';
import { ContentType } from '../file-format/index.js';
import type { StatementParserBase } from './statement-parser-base.js';
import { GenericStatementParser } from './generic-statement-parser.js';
import { AmexParser } from './amex-parser.js';
import { PayPalParser } from './paypal-parser.js';
import { AmazonOrdersParser } from './amazon-orders-parser.js';
import { EtsyBuyerParser } from './etsy-buyer-parser.js';
import { BarclayParser } from './barclay-parser.js';

function normalizeInstituteName(instituteName: string): string {
    return instituteName.replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

/**
 * Factory function to get the appropriate statement parser based on
 * institution name and account type.
 *
 * Mirrors the C# TransactionsStorage.GetStatementFileParser logic.
 *
 * @param instituteName - The financial institution name.
 * @param accountType   - The account type.
 * @param content       - The raw file content.
 * @param contentType   - The file content type (csv, json, iif).
 * @returns A statement parser instance.
 */
export function getStatementParser(
    instituteName: string,
    accountType: AccountType,
    content: string,
    contentType: ContentType,
): StatementParserBase {
    switch (normalizeInstituteName(instituteName)) {
        case 'americanexpress':
        case 'amex':
            return new AmexParser(content);
        case 'barclaybank':
        case 'barclaycard':
            return new BarclayParser(content);
        case 'amazon':
            if (accountType === AT.OrderHistory) {
                return new AmazonOrdersParser(content);
            }
            break;
        case 'etsy':
            if (accountType === AT.OrderHistory) {
                return new EtsyBuyerParser(content);
            }
            break;
        case 'paypal':
            if (accountType === AT.EPayment) {
                return new PayPalParser(content, contentType);
            }
            break;
    }

    // Default: generic parser for CSV
    return new GenericStatementParser(content, contentType, [ContentType.Csv]);
}
