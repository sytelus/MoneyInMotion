/**
 * File format parsers barrel export and factory.
 *
 * @module
 */

export { ContentType } from './types.js';
export type { FileFormatParser, ParsedRow, ParserSettings } from './types.js';
export { CsvFileParser } from './csv-file-parser.js';
export { JsonFileParser } from './json-file-parser.js';
export { IifFileParser } from './iif-file-parser.js';

import { ContentType } from './types.js';
import type { FileFormatParser } from './types.js';
import { CsvFileParser } from './csv-file-parser.js';
import { JsonFileParser } from './json-file-parser.js';
import { IifFileParser } from './iif-file-parser.js';

/**
 * Factory function to create a file-format parser based on content type.
 *
 * @param contentType - The content type to create a parser for.
 * @returns A parser instance.
 */
export function createFileFormatParser(contentType: ContentType): FileFormatParser {
    switch (contentType) {
        case ContentType.Csv:
            return new CsvFileParser();
        case ContentType.Json:
            return new JsonFileParser();
        case ContentType.QuickBooksIif:
            return new IifFileParser();
        default:
            throw new Error(`Unsupported content type: ${contentType}`);
    }
}
