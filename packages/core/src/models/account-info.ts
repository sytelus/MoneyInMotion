/**
 * Financial account metadata, ported from the C# `AccountInfo` class.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// AccountType enum
// ---------------------------------------------------------------------------

/**
 * The type of financial account.
 *
 * Numeric values match the legacy C# enum and JSON wire format.
 *
 * | Member         | Value | Description               |
 * |----------------|------:|---------------------------|
 * | `CreditCard`   |     1 | Credit card account       |
 * | `BankChecking` |     2 | Bank checking / current   |
 * | `BankSavings`  |     4 | Bank savings account      |
 * | `OrderHistory` |     5 | Order history (e.g. Amazon)|
 * | `EPayment`     |     6 | Electronic payment (e.g. PayPal)|
 */
export enum AccountType {
  CreditCard = 1,
  BankChecking = 2,
  BankSavings = 4,
  OrderHistory = 5,
  EPayment = 6,
}

// ---------------------------------------------------------------------------
// AccountInfo interface
// ---------------------------------------------------------------------------

/**
 * Describes a financial account that transactions belong to.
 *
 * Matches the JSON shape produced by the legacy C# serializer:
 * ```json
 * {
 *   "id": "amex-plat",
 *   "instituteName": "American Express",
 *   "title": "Platinum Card",
 *   "type": 1,
 *   "requiresParent": false,
 *   "interAccountNameTags": ["AMEX", "AMERICAN EXPRESS"]
 * }
 * ```
 */
export interface AccountInfo {
  /** Unique account identifier. */
  readonly id: string;

  /** Name of the financial institution (e.g. `"Chase"`, `"American Express"`). */
  readonly instituteName: string;

  /** Optional human-readable title for the account. */
  readonly title?: string | null;

  /** The kind of account. */
  readonly type: AccountType;

  /**
   * When `true`, transactions from this account are child line-items that
   * need to be matched to a parent transaction from another account.
   */
  readonly requiresParent: boolean;

  /**
   * Strings that, when found in another account's entity names, suggest an
   * inter-account transfer to/from this account.
   */
  readonly interAccountNameTags?: string[] | null;
}
