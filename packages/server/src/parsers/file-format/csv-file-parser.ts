/**
 * CSV file-format parser, ported from C# CsvFileParser.
 *
 * Uses papaparse for CSV parsing and implements the same banner-line
 * detection and column-ignore behaviour as the original.
 *
 * @module
 */

import Papa from 'papaparse';
import type { FileFormatParser, ParsedRow, ParserSettings } from './types.js';

export class CsvFileParser implements FileFormatParser {
    /**
     * Parse CSV content into an array of row objects.
     *
     * @param content  - The raw CSV text.
     * @param settings - Optional parser settings.
     * @returns An array of parsed rows, each mapping column names to values.
     */
    parse(content: string, settings?: ParserSettings): ParsedRow[] {
        const hasBannerLines = settings?.hasBannerLines ?? false;
        const ignoreColumns = settings?.ignoreColumns;

        // Parse the entire CSV as an array of string arrays (no header mode).
        const parsed = Papa.parse<string[]>(content, {
            header: false,
            skipEmptyLines: true,
        });

        const rawRows = parsed.data;
        if (rawRows.length === 0) return [];

        let headerColumns: string[] | null = null;
        const results: ParsedRow[] = [];

        for (const columns of rawRows) {
            // Skip empty lines
            if (columns.length === 0 || (columns.length === 1 && columns[0]!.trim() === '')) {
                continue;
            }

            // If hasBannerLines, skip short rows before we have a header
            if (hasBannerLines && columns.length < 3 && headerColumns === null) {
                continue;
            }

            // Remove trailing blank columns when header is already set
            let trimmedColumns = columns;
            if (
                headerColumns !== null &&
                trimmedColumns.length > 1 &&
                trimmedColumns[trimmedColumns.length - 1] === '' &&
                headerColumns.length < trimmedColumns.length
            ) {
                trimmedColumns = trimmedColumns.slice(0, headerColumns.length);
            }

            // First qualifying row becomes the header
            if (headerColumns === null) {
                headerColumns = this.transformHeaderColumnNames(trimmedColumns, ignoreColumns);
                // The header row itself is not a data row
                continue;
            }

            // Build the row object from header + columns
            const row: ParsedRow = {};
            for (let i = 0; i < headerColumns.length && i < trimmedColumns.length; i++) {
                const key = headerColumns[i]!;
                if (key.trim().length > 0) {
                    row[key] = trimmedColumns[i]!;
                }
            }

            // Only include rows that have at least one value
            if (Object.keys(row).length > 0) {
                results.push(row);
            }
        }

        return results;
    }

    /**
     * Transform raw header column names to lower-case and apply ignore prefixes.
     * Can be overridden by subclasses (e.g. AmexParser) to provide fixed headers.
     */
    transformHeaderColumnNames(
        columns: string[],
        ignoreColumns?: Set<string>,
    ): string[] {
        return columns
            .map((c) => c.toLowerCase().trim())
            .map((c) =>
                ignoreColumns && ignoreColumns.has(c) ? `_${c}` : c,
            );
    }
}
