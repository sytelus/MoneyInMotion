import { describe, it, expect } from 'vitest';
import {
  TransactionReason,
  UnknownAdjustment,
  NetOutgoing,
  NetIncoming,
  NetInterAccount,
  intersects,
  isOutgoing,
  isIncoming,
  isInterAccount,
  transactionReasonTitleLookup,
  transactionReasonPluralTitleLookup,
  transactionReasonCategoryLookup,
  transactionReasonInfo,
} from '../../src/models/transaction-reason.js';

// ---------------------------------------------------------------------------
// Numeric values
// ---------------------------------------------------------------------------

describe('TransactionReason numeric values', () => {
  it('should have the correct value for every member', () => {
    expect(TransactionReason.Purchase).toBe(0);
    expect(TransactionReason.ExpenseAdjustment).toBe(1);
    expect(TransactionReason.Fee).toBe(2);
    expect(TransactionReason.InterAccountPayment).toBe(4);
    expect(TransactionReason.Return).toBe(8);
    expect(TransactionReason.InterAccountTransfer).toBe(16);
    expect(TransactionReason.PointsCredit).toBe(32);
    expect(TransactionReason.OtherCredit).toBe(64);
    expect(TransactionReason.CheckPayment).toBe(128);
    expect(TransactionReason.CheckRecieved).toBe(256);
    expect(TransactionReason.AtmWithdrawal).toBe(512);
    expect(TransactionReason.Interest).toBe(1024);
    expect(TransactionReason.LoanPayment).toBe(2048);
    expect(TransactionReason.DiscountRecieved).toBe(4096);
    expect(TransactionReason.IncomeAdjustment).toBe(8192);
    expect(TransactionReason.MatchAdjustmentCredit).toBe(16384);
    expect(TransactionReason.MatchAdjustmentDebit).toBe(32768);
    expect(TransactionReason.PaymentRecieved).toBe(65536);
    expect(TransactionReason.CashAdvance).toBe(131072);
  });

  it('should have exactly 19 primitive members', () => {
    expect(Object.keys(TransactionReason)).toHaveLength(19);
  });
});

// ---------------------------------------------------------------------------
// Compound groups
// ---------------------------------------------------------------------------

describe('compound groups', () => {
  it('UnknownAdjustment should be ExpenseAdjustment | IncomeAdjustment', () => {
    expect(UnknownAdjustment).toBe(
      TransactionReason.ExpenseAdjustment | TransactionReason.IncomeAdjustment,
    );
    expect(UnknownAdjustment).toBe(1 | 8192);
  });

  it('NetOutgoing should combine the correct flags', () => {
    const expected =
      TransactionReason.Purchase |
      TransactionReason.Fee |
      TransactionReason.CheckPayment |
      TransactionReason.AtmWithdrawal |
      TransactionReason.LoanPayment |
      TransactionReason.ExpenseAdjustment |
      TransactionReason.MatchAdjustmentDebit |
      TransactionReason.CashAdvance;
    expect(NetOutgoing).toBe(expected);
  });

  it('NetIncoming should combine the correct flags', () => {
    const expected =
      TransactionReason.Return |
      TransactionReason.PointsCredit |
      TransactionReason.OtherCredit |
      TransactionReason.CheckRecieved |
      TransactionReason.Interest |
      TransactionReason.DiscountRecieved |
      TransactionReason.IncomeAdjustment |
      TransactionReason.MatchAdjustmentCredit |
      TransactionReason.PaymentRecieved;
    expect(NetIncoming).toBe(expected);
  });

  it('NetInterAccount should combine InterAccountPayment | InterAccountTransfer', () => {
    expect(NetInterAccount).toBe(
      TransactionReason.InterAccountPayment | TransactionReason.InterAccountTransfer,
    );
    expect(NetInterAccount).toBe(4 | 16);
  });
});

// ---------------------------------------------------------------------------
// intersects
// ---------------------------------------------------------------------------

describe('intersects', () => {
  it('should return true when bits overlap', () => {
    expect(intersects(TransactionReason.Fee, NetOutgoing)).toBe(true);
  });

  it('should return false when bits do not overlap', () => {
    expect(intersects(TransactionReason.Return, NetOutgoing)).toBe(false);
  });

  it('should return false for Purchase (0) against any mask', () => {
    // Purchase is 0 -- no bits set, so bitwise AND is always 0.
    expect(intersects(TransactionReason.Purchase, NetOutgoing)).toBe(false);
  });

  it('should detect compound masks', () => {
    const combined = TransactionReason.Fee | TransactionReason.Return;
    expect(intersects(combined, NetOutgoing)).toBe(true);
    expect(intersects(combined, NetIncoming)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isOutgoing / isIncoming / isInterAccount
// ---------------------------------------------------------------------------

describe('isOutgoing', () => {
  it('should be true for Purchase (value 0)', () => {
    expect(isOutgoing(TransactionReason.Purchase)).toBe(true);
  });

  it('should be true for Fee', () => {
    expect(isOutgoing(TransactionReason.Fee)).toBe(true);
  });

  it('should be true for CashAdvance', () => {
    expect(isOutgoing(TransactionReason.CashAdvance)).toBe(true);
  });

  it('should be false for Return', () => {
    expect(isOutgoing(TransactionReason.Return)).toBe(false);
  });

  it('should be false for InterAccountPayment', () => {
    expect(isOutgoing(TransactionReason.InterAccountPayment)).toBe(false);
  });
});

describe('isIncoming', () => {
  it('should be true for Return', () => {
    expect(isIncoming(TransactionReason.Return)).toBe(true);
  });

  it('should be true for Interest', () => {
    expect(isIncoming(TransactionReason.Interest)).toBe(true);
  });

  it('should be true for PaymentRecieved', () => {
    expect(isIncoming(TransactionReason.PaymentRecieved)).toBe(true);
  });

  it('should be false for Purchase', () => {
    expect(isIncoming(TransactionReason.Purchase)).toBe(false);
  });

  it('should be false for Fee', () => {
    expect(isIncoming(TransactionReason.Fee)).toBe(false);
  });
});

describe('isInterAccount', () => {
  it('should be true for InterAccountPayment', () => {
    expect(isInterAccount(TransactionReason.InterAccountPayment)).toBe(true);
  });

  it('should be true for InterAccountTransfer', () => {
    expect(isInterAccount(TransactionReason.InterAccountTransfer)).toBe(true);
  });

  it('should be false for Purchase', () => {
    expect(isInterAccount(TransactionReason.Purchase)).toBe(false);
  });

  it('should be false for Fee', () => {
    expect(isInterAccount(TransactionReason.Fee)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

describe('lookup tables', () => {
  it('transactionReasonTitleLookup maps every value to the correct title', () => {
    expect(transactionReasonTitleLookup[String(TransactionReason.Purchase)]).toBe('Purchase');
    expect(transactionReasonTitleLookup[String(TransactionReason.Fee)]).toBe('Fee');
    expect(transactionReasonTitleLookup[String(TransactionReason.CheckRecieved)]).toBe('Check (Recieved)');
    expect(transactionReasonTitleLookup[String(TransactionReason.CashAdvance)]).toBe('Cash Advance');
  });

  it('transactionReasonPluralTitleLookup maps to plural titles', () => {
    expect(transactionReasonPluralTitleLookup[String(TransactionReason.Fee)]).toBe('Fees');
    expect(transactionReasonPluralTitleLookup[String(TransactionReason.CashAdvance)]).toBe('Cash Advances');
  });

  it('transactionReasonCategoryLookup maps to categories', () => {
    expect(transactionReasonCategoryLookup[String(TransactionReason.Purchase)]).toBe('Expense');
    expect(transactionReasonCategoryLookup[String(TransactionReason.Return)]).toBe('Expense');
    expect(transactionReasonCategoryLookup[String(TransactionReason.Interest)]).toBe('Income');
    expect(transactionReasonCategoryLookup[String(TransactionReason.InterAccountPayment)]).toBe('InterAccount');
  });

  it('transactionReasonInfo has an entry for every TransactionReason member', () => {
    expect(transactionReasonInfo).toHaveLength(Object.keys(TransactionReason).length);
  });
});
