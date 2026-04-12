/**
 * Base class for statement parsers, ported from C# StatementParserBase.
 *
 * Provides the column-mapping engine that converts parsed rows into
 * ImportedValues objects, with transaction reason inference from amount
 * sign and entity name keywords.
 *
 * @module
 */

import type { ImportedValues } from '@moneyinmotion/core';
import { TransactionReason, UnknownAdjustment, isNullOrWhitespace } from '@moneyinmotion/core';
import type { ParsedRow } from '../file-format/types.js';

// ---------------------------------------------------------------------------
// StatementColumnType enum
// ---------------------------------------------------------------------------

export enum StatementColumnType {
    TransactionDate,
    PostedDate,
    EntityName,
    TransactionReason,
    Amount,
    Ignore,
    InstituteReference,
    ProviderCategoryName,
    PhoneNumber,
    Address,
    SubAccountName,
    AccountNumber,
    CheckReference,
    DebitAmount,
    CreditAmount,
    ProviderAttribute,
}

// ---------------------------------------------------------------------------
// StatementParserBase
// ---------------------------------------------------------------------------

export abstract class StatementParserBase {
    /**
     * Get parsed rows from the underlying file-format parser.
     * Must be implemented by subclasses.
     */
    protected abstract getTransactionProperties(): ParsedRow[];

    /**
     * Parse rows into ImportedValues array.
     */
    getTransactionImportedValues(): ImportedValues[] {
        const results: ImportedValues[] = [];
        let lineNumber = 0;

        for (const row of this.getTransactionProperties()) {
            const importedValues: Partial<ImportedValues> & {
                providerAttributes?: Record<string, string> | null;
                transactionReason?: number;
                lineNumber?: number | null;
            } = {
                lineNumber: ++lineNumber,
            };

            for (const [originalKey, originalValue] of Object.entries(row)) {
                const [key, value] = this.mapKeyValuePair(originalKey, originalValue);
                const columnType = this.getColumnType(key);
                this.setImportedValueProperty(importedValues, columnType, key, value);
            }

            // If transaction reason is not set by any column then make a generic call to enable inferences
            importedValues.transactionReason = this.inferTransactionReason(importedValues as ImportedValues);

            this.setCalculatedAttributes(importedValues as ImportedValues);

            if (this.validateImportedValues(importedValues as ImportedValues)) {
                results.push(importedValues as ImportedValues);
            }
        }

        return results;
    }

    // -----------------------------------------------------------------------
    // Overridable hooks for subclasses
    // -----------------------------------------------------------------------

    /**
     * Transform a key-value pair before processing. Override for custom mapping.
     */
    protected mapKeyValuePair(key: string, value: string): [string, string] {
        return [key, value];
    }

    /**
     * Validate imported values. Return false to skip this row.
     */
    protected validateImportedValues(_importedValues: ImportedValues): boolean {
        return true;
    }

    /**
     * Set calculated attributes after all columns have been processed.
     */
    protected setCalculatedAttributes(_importedValues: ImportedValues): void {
        // No-op by default
    }

    /**
     * Infer the transaction reason from amount sign and entity name keywords.
     * Port of C# StatementParserBase.InferTransactionReason.
     */
    protected inferTransactionReason(importedValues: ImportedValues): number {
        const amount = importedValues.amount ?? 0;
        const entityName = importedValues.entityName;
        const isCheck = !isNullOrWhitespace(importedValues.checkReference);

        if (importedValues.transactionReason === UnknownAdjustment) {
            importedValues.transactionReason = amount >= 0
                ? TransactionReason.IncomeAdjustment
                : TransactionReason.ExpenseAdjustment;
        }

        if (
            importedValues.transactionReason == null ||
            importedValues.transactionReason === TransactionReason.Purchase
        ) {
            if (amount < 0 && entityName != null && entityName.toUpperCase().includes('FEE')) {
                return TransactionReason.Fee;
            } else if (amount < 0 && entityName != null && entityName.toUpperCase().includes('ATM')) {
                return TransactionReason.AtmWithdrawal;
            } else if (amount < 0 && entityName != null && entityName.toUpperCase().includes('LOAN')) {
                return TransactionReason.LoanPayment;
            } else if (amount < 0 && isCheck) {
                return TransactionReason.CheckPayment;
            } else if (amount < 0) {
                return TransactionReason.Purchase;
            }
        }

        if (
            importedValues.transactionReason == null ||
            importedValues.transactionReason === TransactionReason.OtherCredit
        ) {
            if (amount > 0 && entityName != null && entityName.toUpperCase().includes('INTEREST')) {
                return TransactionReason.Interest;
            } else if (amount > 0 && entityName != null && entityName.toUpperCase().includes('POINTS CREDIT')) {
                return TransactionReason.PointsCredit;
            } else if (
                amount > 0 &&
                entityName != null &&
                (entityName.toUpperCase().includes('REFUND') || entityName.toUpperCase().includes('RETURN'))
            ) {
                return TransactionReason.Return;
            } else if (amount > 0 && isCheck) {
                return TransactionReason.CheckRecieved;
            } else if (amount >= 0) {
                return TransactionReason.OtherCredit;
            }
        }

        return importedValues.transactionReason ?? TransactionReason.Purchase;
    }

    // -----------------------------------------------------------------------
    // Column type mapping
    // -----------------------------------------------------------------------

    /**
     * Map a column name to a StatementColumnType.
     * Matches the C# default switch-based mapping.
     */
    protected getColumnType(columnName: string): StatementColumnType {
        switch (columnName) {
            case 'type':
                return StatementColumnType.TransactionReason;
            case 'trans date':
            case 'transaction date':
            case 'date':
                return StatementColumnType.TransactionDate;
            case 'post date':
                return StatementColumnType.PostedDate;
            case 'description':
            case 'title':
            case 'payee':
                return StatementColumnType.EntityName;
            case 'amount':
                return StatementColumnType.Amount;
            case 'account':
                return StatementColumnType.AccountNumber;
            case 'chkref':
                return StatementColumnType.CheckReference;
            case 'category':
                return StatementColumnType.ProviderCategoryName;
            case 'debit':
                return StatementColumnType.DebitAmount;
            case 'credit':
                return StatementColumnType.CreditAmount;
            case 'reference':
                return StatementColumnType.InstituteReference;
            case '': // ending comma
            case 'balance':
                return StatementColumnType.Ignore;
            default:
                return StatementColumnType.ProviderAttribute;
        }
    }

    // -----------------------------------------------------------------------
    // Setting individual imported value properties
    // -----------------------------------------------------------------------

    private setImportedValueProperty(
        importedValues: Partial<ImportedValues>,
        columnType: StatementColumnType,
        columnName: string,
        columnValue: string,
    ): void {
        switch (columnType) {
            case StatementColumnType.Amount:
                importedValues.amount = this.parseAmount(columnValue);
                break;
            case StatementColumnType.EntityName:
                importedValues.entityName = this.setImportedValueText(
                    importedValues.entityName, columnValue, columnType,
                ) ?? '';
                break;
            case StatementColumnType.PostedDate:
                importedValues.postedDate = this.parseDateValue(columnValue);
                break;
            case StatementColumnType.TransactionDate:
                importedValues.transactionDate = this.parseDateValue(columnValue);
                break;
            case StatementColumnType.TransactionReason:
                importedValues.transactionReason = this.parseTransactionReason(columnValue);
                break;
            case StatementColumnType.InstituteReference:
                importedValues.instituteReference = this.setImportedValueText(
                    importedValues.instituteReference, columnValue, columnType,
                );
                break;
            case StatementColumnType.ProviderCategoryName:
                importedValues.providerCategoryName = this.setImportedValueText(
                    importedValues.providerCategoryName, columnValue, columnType,
                );
                break;
            case StatementColumnType.PhoneNumber:
                importedValues.phoneNumber = this.setImportedValueText(
                    importedValues.phoneNumber, columnValue, columnType,
                );
                break;
            case StatementColumnType.Address:
                importedValues.address = this.setImportedValueText(
                    importedValues.address, columnValue, columnType,
                );
                break;
            case StatementColumnType.SubAccountName:
                importedValues.subAccountName = this.setImportedValueText(
                    importedValues.subAccountName, columnValue, columnType,
                );
                break;
            case StatementColumnType.AccountNumber:
                importedValues.accountNumber = this.setImportedValueText(
                    importedValues.accountNumber, columnValue, columnType,
                );
                break;
            case StatementColumnType.CheckReference:
                importedValues.checkReference = this.setImportedValueText(
                    importedValues.checkReference, columnValue, columnType,
                );
                break;
            case StatementColumnType.DebitAmount:
                if (!isNullOrWhitespace(columnValue)) {
                    importedValues.amount = -1 * this.parseAmount(columnValue);
                }
                break;
            case StatementColumnType.CreditAmount:
                if (!isNullOrWhitespace(columnValue)) {
                    importedValues.amount = this.parseAmount(columnValue);
                }
                break;
            case StatementColumnType.Ignore:
                break;
            case StatementColumnType.ProviderAttribute:
                if (importedValues.providerAttributes == null) {
                    importedValues.providerAttributes = {};
                }
                importedValues.providerAttributes[columnName] = columnValue;
                break;
            default:
                throw new Error(
                    `Header column type '${columnType}' for '${columnName}' with value '${columnValue}' is not recognized`,
                );
        }
    }

    // -----------------------------------------------------------------------
    // Individual column parsing
    // -----------------------------------------------------------------------

    /**
     * Set a text value, preferring non-empty new values over old ones.
     */
    protected setImportedValueText(
        oldValue: string | null | undefined,
        newValue: string,
        _columnType: StatementColumnType,
    ): string | null {
        if (isNullOrWhitespace(newValue)) {
            return !isNullOrWhitespace(oldValue) ? oldValue! : null;
        }
        return newValue;
    }

    /**
     * Parse a currency amount string into a number.
     * Handles currency symbols, commas, and parenthesized negatives.
     */
    protected parseAmount(columnValue: string): number {
        // Remove currency symbols, commas, spaces
        let cleaned = columnValue.replace(/[$,\s]/g, '');
        // Handle parenthesized negatives: ($12.34) -> -12.34
        if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
            cleaned = '-' + cleaned.substring(1, cleaned.length - 1);
        }
        const value = parseFloat(cleaned);
        if (isNaN(value)) {
            throw new Error(`Cannot parse amount: "${columnValue}"`);
        }
        return value;
    }

    /**
     * Parse a date value and return it as an ISO string.
     */
    protected parseDateValue(columnValue: string): string {
        const date = new Date(columnValue);
        if (isNaN(date.getTime())) {
            throw new Error(`Cannot parse date: "${columnValue}"`);
        }
        return date.toISOString();
    }

    /**
     * Parse a transaction reason string to a numeric TransactionReason value.
     */
    protected parseTransactionReason(columnValue: string): number {
        if (columnValue == null) {
            throw new Error('TransactionReason columnValue null is not supported');
        }

        const asInt = parseInt(columnValue, 10);
        if (!isNaN(asInt)) {
            return asInt;
        }

        switch (columnValue.toUpperCase()) {
            case 'SALE':
                return TransactionReason.Purchase;
            case 'PAYMENT':
                return TransactionReason.InterAccountPayment;
            case 'ADJUSTMENT':
                return UnknownAdjustment;
            case 'RETURN':
                return TransactionReason.Return;
            case 'FEE':
                return TransactionReason.Fee;
            case 'CASH ADVANCE':
                return TransactionReason.CashAdvance;
            default:
                throw new Error(`Raw TransactionType "${columnValue}" is not known`);
        }
    }
}
