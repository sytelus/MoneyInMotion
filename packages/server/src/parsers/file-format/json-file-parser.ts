/**
 * JSON file-format parser, ported from C# JsonFileParser.
 *
 * Parses a JSON array of objects into parsed row records.
 *
 * @module
 */

import type { FileFormatParser, ParsedRow, ParserSettings } from './types.js';

export class JsonFileParser implements FileFormatParser {
    /**
     * Parse JSON content into an array of row objects.
     *
     * @param content  - The raw JSON text (must be a JSON array of objects).
     * @param settings - Optional parser settings.
     * @returns An array of parsed rows.
     */
    parse(content: string, settings?: ParserSettings): ParsedRow[] {
        const ignoreColumns = settings?.ignoreColumns;
        let items: unknown[];
        try {
            items = JSON.parse(content) as unknown[];
        } catch (err) {
            throw new Error(
                `Failed to parse JSON content: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
        const results: ParsedRow[] = [];

        for (const item of items) {
            if (item != null && typeof item === 'object' && !Array.isArray(item)) {
                const row: ParsedRow = {};
                for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
                    let propertyName = key;
                    if (ignoreColumns && ignoreColumns.has(propertyName)) {
                        propertyName = `_${propertyName}`;
                    }
                    row[propertyName] = this.transformPropertyValue(propertyName, value);
                }
                results.push(row);
            }
        }

        return results;
    }

    /**
     * Transform a property value to string. Can be overridden by subclasses.
     */
    protected transformPropertyValue(_propertyName: string, value: unknown): string {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        return String(value);
    }
}
