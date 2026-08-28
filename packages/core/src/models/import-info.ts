/**
 * Metadata describing a single import (statement file) that was ingested.
 *
 * Ported from the C# `ImportInfo` class. The JSON wire format uses camelCase
 * property names and ISO-8601 date strings.
 *
 * @module
 */

/**
 * Describes an imported statement file and its provenance.
 *
 * Matches the JSON shape produced by the legacy C# serializer:
 * ```json
 * {
 *   "id": "abc123",
 *   "portableAddress": "statements/amex/2024-01.csv",
 *   "updateDate": "2024-02-01T10:00:00.000Z",
 *   "createDate": "2024-01-15T08:30:00.000Z",
 *   "contentHash": "d41d8cd98f00b204e9800998ecf8427e",
 *   "format": "csv"
 * }
 * ```
 */
export interface ImportInfo {
  /** Unique identifier for this import. */
  readonly id: string;

  /** Portable (relative) file path or URI of the source file. */
  readonly portableAddress: string;

  /** ISO-8601 timestamp of the last update, or `null` if never updated. */
  readonly updateDate?: string | null;

  /** ISO-8601 timestamp of creation, or `null` if unknown. */
  readonly createDate?: string | null;

  /** Hash of the file content, used for deduplication. */
  readonly contentHash: string;

  /** File format identifier (e.g. `"csv"`, `"iif"`), or `null` if unspecified. */
  readonly format?: string | null;
}
