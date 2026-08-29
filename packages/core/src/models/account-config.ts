/**
 * Per-account import configuration, ported from the C# `AccountConfig` class.
 *
 * @module
 */

import { AccountType, type AccountInfo } from './account-info.js';

/** Account kinds implemented by the current parser and matching pipeline. */
export const SUPPORTED_ACCOUNT_TYPES: readonly AccountType[] = [
  AccountType.CreditCard,
  AccountType.BankChecking,
  AccountType.BankSavings,
  AccountType.OrderHistory,
  AccountType.EPayment,
];

/** Narrow a persisted numeric value to an account type MiM can process. */
export function isSupportedAccountType(value: number): value is AccountType {
  return SUPPORTED_ACCOUNT_TYPES.includes(value as AccountType);
}

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

/** Return why a structurally valid account is unsupported, or `null`. */
export function validateAccountConfigSupport(config: AccountConfig): string | null {
  if (config.accountInfo.type !== AccountType.OrderHistory) return null;

  const institution = config.accountInfo.instituteName.replace(/[^a-z0-9]+/gi, '').toLowerCase();
  if (institution !== 'amazon' && institution !== 'etsy') {
    return 'Order History accounts currently support only Amazon and Etsy.';
  }
  if (!(config.accountInfo.interAccountNameTags ?? []).some((tag) => tag.trim().length > 0)) {
    return 'Order History accounts require at least one match tag for financial-charge matching.';
  }
  return null;
}
