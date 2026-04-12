/**
 * Per-account import configuration, ported from the C# `AccountConfig` class.
 *
 * @module
 */

import type { AccountInfo } from './account-info.js';

/**
 * Configuration for importing statement files for a specific account.
 *
 * Matches the JSON shape produced by the legacy C# serializer:
 * ```json
 * {
 *   "accountInfo": { ... },
 *   "fileFilters": ["*.csv"],
 *   "scanSubFolders": true
 * }
 * ```
 */
export interface AccountConfig {
  /** The account this configuration applies to. */
  readonly accountInfo: AccountInfo;

  /**
   * Glob patterns used to locate statement files (e.g. `["*.csv"]`).
   * Defaults to `["*.csv"]` in the legacy C# code.
   */
  readonly fileFilters: string[];

  /**
   * Whether to recurse into subdirectories when scanning for statement files.
   * Defaults to `true` in the legacy C# code.
   */
  readonly scanSubFolders: boolean;
}
