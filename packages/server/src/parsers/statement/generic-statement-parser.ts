/**
 * Generic statement parser, ported from C# GenericStatementParser.
 *
 * Combines a file-format parser with the column-mapping engine from
 * StatementParserBase. Works with CSV, JSON, and IIF formats.
 *
 * @module
 */

import type { ParsedRow, ParserSettings } from '../file-format/types.js';
import { ContentType, createFileFormatParser } from '../file-format/index.js';
import { StatementParserBase } from './statement-parser-base.js';

export class GenericStatementParser extends StatementParserBase {
    private parsedRows: ParsedRow[];

    /**
     * @param content             - The raw file content to parse.
     * @param contentType         - The content type (csv, json, iif).
     * @param allowedContentTypes - Optional list of allowed content types.
     * @param parserSettings      - Optional file-format parser settings.
     */
    constructor(
        content: string,
        contentType: ContentType,
        allowedContentTypes?: ContentType[] | null,
        parserSettings?: ParserSettings,
    ) {
        super();

        if (allowedContentTypes && !allowedContentTypes.includes(contentType)) {
            throw new Error(`Content type "${contentType}" is not supported. Allowed: ${allowedContentTypes.join(', ')}`);
        }

        const parser = createFileFormatParser(contentType);
        this.parsedRows = parser.parse(content, parserSettings);
    }

    protected getTransactionProperties(): ParsedRow[] {
        return this.parsedRows;
    }
}
