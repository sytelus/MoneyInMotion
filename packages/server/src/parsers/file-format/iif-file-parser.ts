/**
 * QuickBooks IIF file-format parser, ported from C# IifFileParser.
 *
 * IIF is a tab-separated format where lines starting with "!" define column
 * headers for a section, and subsequent lines with matching section names
 * (e.g. "TRNS") contain data.
 *
 * @module
 */

import type { FileFormatParser, ParsedRow, ParserSettings } from './types.js';

export class IifFileParser implements FileFormatParser {
    /**
     * Parse IIF content into an array of row objects.
     *
     * Focuses on the TRNS (transaction) section, which is the primary
     * data section in QuickBooks IIF exports.
     *
     * @param content  - The raw IIF text.
     * @param settings - Optional parser settings (currently unused for IIF).
     * @returns An array of parsed rows from the TRNS section.
     */
    parse(content: string, _settings?: ParserSettings): ParsedRow[] {
        const lines = content.split(/\r?\n/);
        const results: ParsedRow[] = [];

        // Map from section name to column headers
        const sectionHeaders: Record<string, string[]> = {};

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.length === 0) continue;

            const fields = trimmedLine.split('\t');
            const sectionTag = fields[0] ?? '';

            // Header definition lines start with "!"
            if (sectionTag.startsWith('!')) {
                const sectionName = sectionTag.substring(1);
                sectionHeaders[sectionName] = fields.slice(1).map((f) => f.toLowerCase().trim());
                continue;
            }

            // Only process TRNS data rows
            if (sectionTag !== 'TRNS') continue;

            const columns = sectionHeaders['TRNS'];
            if (!columns) continue;

            const dataFields = fields.slice(1);
            const row: ParsedRow = {};

            for (let i = 0; i < columns.length && i < dataFields.length; i++) {
                const columnName = columns[i]!;
                if (columnName.trim().length > 0) {
                    row[columnName] = cleanValue(dataFields[i]!);
                }
            }

            if (Object.keys(row).length > 0) {
                results.push(row);
            }
        }

        return results;
    }
}

/**
 * Remove surrounding double quotes from a value string.
 */
function cleanValue(value: string): string {
    if (value.length > 2 && value.startsWith('"') && value.endsWith('"')) {
        return value.substring(1, value.length - 1);
    }
    return value;
}
