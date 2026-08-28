/**
 * American Express statement parser, ported from C# AmexParser.
 *
 * Amex CSV files have no header row -- the parser uses a fixed column
 * layout: [transaction date, amex reference, amount, description, other info].
 * Additional attributes (phone, category, reference number) are extracted
 * from the "other info" and "amex reference" columns.
 *
 * @module
 */

import Papa from 'papaparse';
import type { ImportedValues } from '@moneyinmotion/core';
import type { ParsedRow } from '../file-format/types.js';
import { StatementParserBase } from './statement-parser-base.js';

/** Fixed Amex column layout (no header row in the CSV). */
const AMEX_COLUMNS = ['transaction date', 'amex reference', 'amount', 'description', 'other info'];

export class AmexParser extends StatementParserBase {
    private parsedRows: ParsedRow[];

    constructor(content: string) {
        super();
        this.parsedRows = this.parseAmexCsv(content);
    }

    /**
     * Parse the Amex CSV using fixed column names since Amex files
     * have no header row -- the first row is data.
     */
    private parseAmexCsv(content: string): ParsedRow[] {
        const parsed = Papa.parse<string[]>(content, {
            header: false,
            skipEmptyLines: true,
        });

        const results: ParsedRow[] = [];

        for (const columns of parsed.data) {
            if (columns.length === 0 || (columns.length === 1 && columns[0]!.trim() === '')) {
                continue;
            }

            const row: ParsedRow = {};
            for (let i = 0; i < AMEX_COLUMNS.length && i < columns.length; i++) {
                row[AMEX_COLUMNS[i]!] = columns[i]!;
            }
            results.push(row);
        }

        return results;
    }

    protected getTransactionProperties(): ParsedRow[] {
        return this.parsedRows;
    }

    protected override setCalculatedAttributes(importedValues: ImportedValues): void {
        super.setCalculatedAttributes(importedValues);

        const otherInfo = importedValues.providerAttributes?.['other info'] ?? null;
        const { phoneNumber, categoryName } = extractOtherInfo(otherInfo);

        importedValues.phoneNumber = phoneNumber;
        importedValues.providerCategoryName = categoryName;
        importedValues.address = null; // ExtractAddress returns null in C#
        importedValues.instituteReference = extractReferenceNumber(
            importedValues.providerAttributes?.['amex reference'] ?? null,
        );
    }
}

/**
 * Extract phone number and category name from the "other info" column.
 * The field contains two-space separated parts. If the second part contains
 * letters it is a category; if it contains digits/dashes it is a phone number.
 */
function extractOtherInfo(
    columnValue: string | null,
): { phoneNumber: string | null; categoryName: string | null } {
    let phoneNumber: string | null = null;
    let categoryName: string | null = null;

    if (columnValue != null) {
        const parts = columnValue
            .split(/\s{2,}/)
            .filter((s) => s.trim().length > 0);

        if (parts.length === 2) {
            const secondPart = parts[1]!;
            if (/[a-zA-Z]/.test(secondPart)) {
                categoryName = secondPart;
            } else if (/[\d-]/.test(secondPart)) {
                phoneNumber = secondPart;
            }
        }
    }

    return { phoneNumber, categoryName };
}

/**
 * Extract the reference number from the "amex reference" column.
 * Expected format: "Reference: XXXXXXX"
 */
function extractReferenceNumber(columnValue: string | null): string | null {
    if (columnValue != null) {
        const parts = columnValue.split('Reference: ');
        if (parts.length === 2) {
            return parts[1]!;
        }
    }
    return null;
}
