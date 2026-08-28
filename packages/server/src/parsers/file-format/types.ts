/**
 * Types for file format parsers, ported from the C# IFileFormatParser
 * and Settings classes.
 *
 * @module
 */

/** A single parsed row represented as column-name to value pairs. */
export type ParsedRow = Record<string, string>;

/** Interface that all file-format parsers implement. */
export interface FileFormatParser {
    parse(content: string, settings?: ParserSettings): ParsedRow[];
}

/** Configuration options for file-format parsers. */
export interface ParserSettings {
    /** When true, skip banner/header lines before the real header row. */
    hasBannerLines?: boolean;
    /** Column names to mark as ignored (prefixed with "_"). */
    ignoreColumns?: Set<string>;
}

/**
 * Content type discriminator, matching the C# ContentType enum.
 */
export enum ContentType {
    Csv = 'csv',
    Json = 'json',
    QuickBooksIif = 'iif',
    None = 'none',
}
