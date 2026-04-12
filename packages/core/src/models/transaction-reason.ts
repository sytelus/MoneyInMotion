/**
 * Transaction reason flags enum, ported from C# TransactionReason.
 *
 * TypeScript does not support flags enums, so we use a const object with
 * numeric bit-flag values. Combine values with bitwise OR and test with
 * bitwise AND (or use the helper functions below).
 *
 * @remarks
 * Several member names preserve the original typo ("Recieved" instead of
 * "Received") for backward compatibility with the JSON wire format produced
 * by the C# application.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Primitive flags
// ---------------------------------------------------------------------------

/** Const object whose values are the numeric bit-flags for transaction reasons. */
export const TransactionReason = {
  /** Standard purchase (value 0 -- the default / absence of any flag). */
  Purchase: 0,
  /** Debit-side adjustment. */
  ExpenseAdjustment: 1 << 0, // 1
  /** Bank or card fee. */
  Fee: 1 << 1, // 2
  /** Payment between accounts (e.g. credit-card payment from checking). */
  InterAccountPayment: 1 << 2, // 4
  /** Returned merchandise credit. */
  Return: 1 << 3, // 8
  /** Transfer between accounts. */
  InterAccountTransfer: 1 << 4, // 16
  /** Rewards / points credit. */
  PointsCredit: 1 << 5, // 32
  /** Miscellaneous credit. */
  OtherCredit: 1 << 6, // 64
  /** Outgoing check payment. */
  CheckPayment: 1 << 7, // 128
  /** Incoming check deposit (typo preserved for compat). */
  CheckRecieved: 1 << 8, // 256
  /** ATM cash withdrawal. */
  AtmWithdrawal: 1 << 9, // 512
  /** Interest earned. */
  Interest: 1 << 10, // 1024
  /** Loan payment. */
  LoanPayment: 1 << 11, // 2048
  /** Discount received (typo preserved for compat). */
  DiscountRecieved: 1 << 12, // 4096
  /** Credit-side adjustment. */
  IncomeAdjustment: 1 << 13, // 8192
  /** Match-adjustment credit (expense side). */
  MatchAdjustmentCredit: 1 << 14, // 16384
  /** Match-adjustment debit (expense side). */
  MatchAdjustmentDebit: 1 << 15, // 32768
  /** Payment received (typo preserved for compat). */
  PaymentRecieved: 1 << 16, // 65536
  /** Cash advance. */
  CashAdvance: 1 << 17, // 131072
} as const;

/** The numeric type produced by any single TransactionReason value. */
export type TransactionReasonValue =
  (typeof TransactionReason)[keyof typeof TransactionReason];

// ---------------------------------------------------------------------------
// Compound groups (bit masks)
// ---------------------------------------------------------------------------

/**
 * Temporary placeholder when the sign of an adjustment is not yet known.
 * Must never appear on a persisted transaction.
 */
export const UnknownAdjustment: number =
  TransactionReason.ExpenseAdjustment | TransactionReason.IncomeAdjustment;

/** Mask covering all reasons that represent money leaving an account. */
export const NetOutgoing: number =
  TransactionReason.Purchase |
  TransactionReason.Fee |
  TransactionReason.CheckPayment |
  TransactionReason.AtmWithdrawal |
  TransactionReason.LoanPayment |
  TransactionReason.ExpenseAdjustment |
  TransactionReason.MatchAdjustmentDebit |
  TransactionReason.CashAdvance;

/** Mask covering all reasons that represent money entering an account. */
export const NetIncoming: number =
  TransactionReason.Return |
  TransactionReason.PointsCredit |
  TransactionReason.OtherCredit |
  TransactionReason.CheckRecieved |
  TransactionReason.Interest |
  TransactionReason.DiscountRecieved |
  TransactionReason.IncomeAdjustment |
  TransactionReason.MatchAdjustmentCredit |
  TransactionReason.PaymentRecieved;

/** Mask covering inter-account movements. */
export const NetInterAccount: number =
  TransactionReason.InterAccountPayment |
  TransactionReason.InterAccountTransfer;

// ---------------------------------------------------------------------------
// Bitwise helpers
// ---------------------------------------------------------------------------

/**
 * Test whether {@link value} has any bits in common with {@link mask}.
 *
 * This is the TypeScript equivalent of the C# `Enum.HasFlag` / custom
 * `Intersects` extension used throughout the legacy codebase.
 *
 * @param value - The transaction-reason value to test.
 * @param mask  - The bit mask to test against.
 * @returns `true` when `(value & mask) !== 0`.
 */
export function intersects(value: number, mask: number): boolean {
  return (value & mask) !== 0;
}

/**
 * Check whether a transaction reason represents money leaving the account.
 *
 * @remarks
 * `Purchase` (value 0) is outgoing by convention but cannot be detected with
 * a simple bitwise AND because its numeric value is zero. We therefore
 * special-case it: a value of exactly `0` is outgoing.
 *
 * @param reason - The numeric transaction-reason value.
 */
export function isOutgoing(reason: number): boolean {
  return reason === TransactionReason.Purchase || intersects(reason, NetOutgoing);
}

/**
 * Check whether a transaction reason represents money entering the account.
 *
 * @param reason - The numeric transaction-reason value.
 */
export function isIncoming(reason: number): boolean {
  return intersects(reason, NetIncoming);
}

/**
 * Check whether a transaction reason represents an inter-account movement.
 *
 * @param reason - The numeric transaction-reason value.
 */
export function isInterAccount(reason: number): boolean {
  return intersects(reason, NetInterAccount);
}

// ---------------------------------------------------------------------------
// Title / category lookup tables
// ---------------------------------------------------------------------------

/**
 * Metadata for a single TransactionReason value, mirroring the JS
 * `transactionReasonInfo` array from the legacy web client.
 */
export interface TransactionReasonInfo {
  /** The enum member name (e.g. `"Purchase"`). */
  readonly key: string;
  /** The numeric bit-flag value. */
  readonly value: number;
  /** Human-readable singular title. */
  readonly title: string;
  /** Human-readable plural title. */
  readonly pluralTitle: string;
  /** High-level category: `"Expense"`, `"Income"`, or `"InterAccount"`. */
  readonly category: 'Expense' | 'Income' | 'InterAccount';
}

/** Ordered metadata for every primitive TransactionReason value. */
export const transactionReasonInfo: readonly TransactionReasonInfo[] = [
  { key: 'Purchase', value: TransactionReason.Purchase, title: 'Purchase', pluralTitle: 'Purchases', category: 'Expense' },
  { key: 'ExpenseAdjustment', value: TransactionReason.ExpenseAdjustment, title: 'Adjustment (Debit)', pluralTitle: 'Adjustments (Debit)', category: 'Expense' },
  { key: 'Fee', value: TransactionReason.Fee, title: 'Fee', pluralTitle: 'Fees', category: 'Expense' },
  { key: 'InterAccountPayment', value: TransactionReason.InterAccountPayment, title: 'Account Payment', pluralTitle: 'Account Payments', category: 'InterAccount' },
  { key: 'Return', value: TransactionReason.Return, title: 'Return', pluralTitle: 'Returns', category: 'Expense' },
  { key: 'InterAccountTransfer', value: TransactionReason.InterAccountTransfer, title: 'Transfer', pluralTitle: 'Transfers', category: 'InterAccount' },
  { key: 'PointsCredit', value: TransactionReason.PointsCredit, title: 'Points', pluralTitle: 'Points', category: 'Income' },
  { key: 'OtherCredit', value: TransactionReason.OtherCredit, title: 'Other (Credit)', pluralTitle: 'Others (Credit)', category: 'Income' },
  { key: 'CheckPayment', value: TransactionReason.CheckPayment, title: 'Check', pluralTitle: 'Checks', category: 'Expense' },
  { key: 'CheckRecieved', value: TransactionReason.CheckRecieved, title: 'Check (Recieved)', pluralTitle: 'Checks (Recieved)', category: 'Income' },
  { key: 'AtmWithdrawal', value: TransactionReason.AtmWithdrawal, title: 'ATM', pluralTitle: 'ATM', category: 'Expense' },
  { key: 'Interest', value: TransactionReason.Interest, title: 'Interest', pluralTitle: 'Interest', category: 'Income' },
  { key: 'LoanPayment', value: TransactionReason.LoanPayment, title: 'Loan', pluralTitle: 'Loans', category: 'Expense' },
  { key: 'DiscountRecieved', value: TransactionReason.DiscountRecieved, title: 'Discount', pluralTitle: 'Discounts', category: 'Expense' },
  { key: 'IncomeAdjustment', value: TransactionReason.IncomeAdjustment, title: 'Adjustment (Credit)', pluralTitle: 'Adjustments (Credit)', category: 'Income' },
  { key: 'MatchAdjustmentCredit', value: TransactionReason.MatchAdjustmentCredit, title: 'Match Adjustment (Credit)', pluralTitle: 'Match Adjustments (Credit)', category: 'Expense' },
  { key: 'MatchAdjustmentDebit', value: TransactionReason.MatchAdjustmentDebit, title: 'Match Adjustment (Debit)', pluralTitle: 'Match Adjustments (Debit)', category: 'Expense' },
  { key: 'PaymentRecieved', value: TransactionReason.PaymentRecieved, title: 'Payment Recieved', pluralTitle: 'Payments Recieved', category: 'Income' },
  { key: 'CashAdvance', value: TransactionReason.CashAdvance, title: 'Cash Advance', pluralTitle: 'Cash Advances', category: 'Expense' },
] as const;

/**
 * Map from numeric TransactionReason value (as string key) to its singular
 * human-readable title.
 *
 * @example
 * ```ts
 * transactionReasonTitleLookup[String(TransactionReason.Fee)] // "Fee"
 * ```
 */
export const transactionReasonTitleLookup: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(
      transactionReasonInfo.map((i) => [String(i.value), i.title]),
    ),
  );

/**
 * Map from numeric TransactionReason value (as string key) to its plural
 * human-readable title.
 */
export const transactionReasonPluralTitleLookup: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(
      transactionReasonInfo.map((i) => [String(i.value), i.pluralTitle]),
    ),
  );

/**
 * Map from numeric TransactionReason value (as string key) to its high-level
 * category (`"Expense"`, `"Income"`, or `"InterAccount"`).
 */
export const transactionReasonCategoryLookup: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(
      transactionReasonInfo.map((i) => [String(i.value), i.category]),
    ),
  );
