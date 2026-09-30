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

    // Only TRNS records enter the financial model; other section headers do
    // not need to be retained.
    let columns: string[] | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0) continue;

      const fields = trimmedLine.split('\t');
      const sectionTag = fields[0] ?? '';

      // Header definition lines start with "!"
      if (sectionTag.startsWith('!')) {
        if (sectionTag === '!TRNS') {
          columns = fields.slice(1).map((f) => f.toLowerCase().trim());
          const namedColumns = columns.filter(Boolean);
          if (new Set(namedColumns).size !== namedColumns.length) {
            throw new Error('IIF TRNS header contains duplicate column names.');
          }
        }
        continue;
      }

      // Only process TRNS data rows
      if (sectionTag !== 'TRNS') continue;

      if (!columns) {
        throw new Error('IIF TRNS data appeared before its !TRNS header.');
      }

      const dataFields = fields.slice(1);
      if (dataFields.length > columns.length) {
        throw new Error(
          `IIF TRNS row has ${dataFields.length} fields but its header has ${columns.length}.`,
        );
      }
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
