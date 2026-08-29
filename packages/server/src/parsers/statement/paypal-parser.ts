/**
 * PayPal statement parser, ported from C# PayPalParser.
 *
 * PayPal CSV/IIF files have unique column names, date+time+timezone assembly,
 * activity filtering, type-to-reason mapping, and custom content hash.
 *
 * @module
 */

import type { ImportedValues } from '@moneyinmotion/core';
import { TransactionReason, isNullOrWhitespace } from '@moneyinmotion/core';
import { getMD5HashString } from '@moneyinmotion/core';
import type { ParsedRow } from '../file-format/types.js';
import { ContentType, createFileFormatParser } from '../file-format/index.js';
import { StatementParserBase, StatementColumnType } from './statement-parser-base.js';

// ---------------------------------------------------------------------------
// Timezone abbreviation to UTC offset mapping (subset)
// ---------------------------------------------------------------------------

const timezoneOffsets: Record<string, string> = {
  PST: '-08:00',
  PDT: '-07:00',
  MST: '-07:00',
  MDT: '-06:00',
  CST: '-06:00',
  CDT: '-05:00',
  EST: '-05:00',
  EDT: '-04:00',
  GMT: '+00:00',
  UTC: '+00:00',
};

export class PayPalParser extends StatementParserBase {
  private parsedRows: ParsedRow[];

  constructor(content: string, contentType: ContentType) {
    super();

    const allowedTypes = [ContentType.Csv, ContentType.QuickBooksIif];
    if (!allowedTypes.includes(contentType)) {
      throw new Error(
        `Content type "${contentType}" is not supported for PayPal. Allowed: ${allowedTypes.join(', ')}`,
      );
    }

    const parser = createFileFormatParser(contentType);
    this.parsedRows = parser.parse(content);
  }

  protected getTransactionProperties(): ParsedRow[] {
    return this.parsedRows;
  }

  /**
   * Map all PayPal columns to ProviderAttribute so that
   * setCalculatedAttributes can do the custom mapping.
   */
  protected override getColumnType(_columnName: string): StatementColumnType {
    return StatementColumnType.ProviderAttribute;
  }

  protected override setCalculatedAttributes(importedValues: ImportedValues): void {
    super.setCalculatedAttributes(importedValues);

    const attrs = importedValues.providerAttributes ?? {};

    // Assemble date+time+timezone
    const dateString = attrs['date'] ?? '';
    const timeZoneAbbreviation = attrs['time zone'] ?? '';
    let timeZoneHoursString = '';
    if (!isNullOrWhitespace(timeZoneAbbreviation)) {
      const normalizedTimeZone = timeZoneAbbreviation.trim().toUpperCase();
      timeZoneHoursString = timezoneOffsets[normalizedTimeZone] ?? '';
      if (!timeZoneHoursString) {
        throw new Error(`Unsupported PayPal time zone: "${timeZoneAbbreviation}"`);
      }
    }
    const timeString = attrs['time'] ?? '';

    const dateTimeString = `${dateString} ${timeString} ${timeZoneHoursString}`.trim();
    const parsed = new Date(dateTimeString);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Cannot parse PayPal transaction date: "${dateTimeString}"`);
    }
    importedValues.transactionDate = parsed.toISOString();

    // Entity name from memo + name
    const memo = attrs['memo'] ?? '';
    const name = attrs['name'] ?? '';
    importedValues.entityName = !isNullOrWhitespace(memo) ? `${memo} - ${name}` : name;

    // Amount
    importedValues.amount = this.parseAmount(attrs['amount'] ?? '0');

    // PayPal type from CSV "type" or IIF "class"
    const payPalType = attrs['type'] ?? attrs['class'] ?? '';

    setPayPalTransactionReason(importedValues, payPalType);

    // Custom content hash
    const amountString = attrs['amount'] ?? '';
    importedValues.contentHash = getMD5HashString(
      [name, dateString, amountString, payPalType].map((s) => (s ?? '').toUpperCase()).join('\t'),
      true,
    );
  }

  /**
   * Disable default inference -- PayPal sets reason explicitly.
   */
  protected override inferTransactionReason(importedValues: ImportedValues): number {
    return importedValues.transactionReason ?? TransactionReason.Purchase;
  }

  protected override validateImportedValues(importedValues: ImportedValues): boolean {
    if (importedValues.transactionReason == null) {
      return false;
    }
    return super.validateImportedValues(importedValues);
  }
}

// ---------------------------------------------------------------------------
// PayPal-specific transaction reason mapping
// ---------------------------------------------------------------------------

function setPayPalTransactionReason(importedValues: ImportedValues, payPalType: string): void {
  const attrs = importedValues.providerAttributes ?? {};
  let ignorableActivity = false;

  // Check status
  const status = (attrs['status'] ?? '').trim().toLowerCase();
  switch (status) {
    case 'denied':
    case 'removed':
    case 'placed':
    case 'canceled':
    case 'cancelled':
    case 'cleared':
    case 'failed':
    case 'refunded':
      ignorableActivity = true;
      break;
  }

  if (!ignorableActivity) {
    const typeLower = payPalType.toLowerCase();
    if (
      typeLower.startsWith('update to ') ||
      typeLower.startsWith('cancelled') ||
      typeLower.startsWith('failed') ||
      typeLower.startsWith('denied')
    ) {
      ignorableActivity = true;
    } else {
      switch (typeLower) {
        case 'authorization':
        case 'temporary hold':
          ignorableActivity = true;
          break;
      }
    }
  }

  if (!ignorableActivity) {
    const typeLower = payPalType.toLowerCase();
    if (typeLower.includes('payment sent')) {
      importedValues.transactionReason = TransactionReason.Purchase;
    } else if (typeLower.includes('donation sent')) {
      importedValues.transactionReason = TransactionReason.Purchase;
    } else if (typeLower.includes('refund')) {
      importedValues.transactionReason = TransactionReason.Return;
    } else if (typeLower.includes('charge from ') && typeLower.includes('card')) {
      importedValues.transactionReason = TransactionReason.InterAccountPayment;
    } else if (typeLower.includes('credit to ') && typeLower.includes('card')) {
      importedValues.transactionReason = TransactionReason.InterAccountTransfer;
    } else if (typeLower.includes('add funds from a bank account')) {
      importedValues.transactionReason = TransactionReason.InterAccountTransfer;
    } else {
      switch (typeLower) {
        case 'billpay':
          importedValues.transactionReason = TransactionReason.Purchase;
          break;
        case 'payment received':
          importedValues.transactionReason = TransactionReason.PaymentRecieved;
          break;
        default:
          throw new Error(`Cannot determine TransactionReason for PayPal Type '${payPalType}'`);
      }
    }
  } else {
    // Clear the reason so `validateImportedValues` (which checks
    // `transactionReason == null`) skips this row downstream.
    // ImportedValues.transactionReason is declared as `number` (required)
    // but the base class actually builds rows via `Partial<ImportedValues>`,
    // so removing the property at runtime is safe.
    Reflect.deleteProperty(importedValues, 'transactionReason');
  }
}
