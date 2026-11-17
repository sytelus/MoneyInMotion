import { describe, expect, it } from 'vitest';
import {
  AccountType,
  ScopeType,
  Transaction,
  TransactionReason,
  Transactions,
  createAuditInfo,
  createScopeFilter,
  editValue,
} from '@moneyinmotion/core';
import {
  INCOME_DECISION_REASON,
  KEEP_SPENDING_DECISION_REASON,
  SPENDING_DECISION_REASON,
  cardPaymentsToReview,
  cashFlowClassifier,
  cashFlowTotals,
  linkRefunds,
} from '../../src/lib/cash-flow.js';
import { buildFinancialReport, financialReportCsv } from '../../src/lib/financial-reports.js';

const accounts = {
  checking: AccountType.BankChecking,
  savings: AccountType.BankSavings,
  card: AccountType.CreditCard,
  paypal: AccountType.EPayment,
} as const;

function fixture() {
  const collection = new Transactions('cash-flow');
  let sequence = 0;
  function add(
    amount: number,
    options: {
      account?: keyof typeof accounts;
      reason?: number;
      date?: string;
      name?: string;
      category?: string;
    } = {},
  ) {
    const account = options.account ?? 'checking';
    const name = options.name ?? `Merchant ${sequence++}`;
    const tx = Transaction.create('statement', account, false, {
      amount,
      transactionDate: options.date ?? '2024-03-15',
      entityName: name,
      entityNameNormalized: name,
      transactionReason: options.reason ?? TransactionReason.Purchase,
      providerCategoryName: options.category,
    });
    collection.addNew(
      tx,
      {
        id: account,
        instituteName: 'Generic',
        title: account,
        type: accounts[account],
        requiresParent: false,
      },
      { id: 'statement', portableAddress: `${account}/march.csv`, contentHash: 'path-id' },
      false,
    );
    return tx;
  }
  function setType(tx: Transaction, reason: number) {
    collection.apply({
      id: `decision-${tx.id}`,
      auditInfo: createAuditInfo('test'),
      scopeFilters: [createScopeFilter(ScopeType.TransactionId, [tx.id])],
      values: { transactionReason: editValue(reason) },
      sourceId: 'test',
    });
  }
  return { collection, add, setType };
}

describe('cash-flow classification', () => {
  it('separates income, spending net of refunds, transfers, and undecided credits', () => {
    const { collection, add } = fixture();
    const paycheck = add(3000, { reason: TransactionReason.OtherCredit, name: 'Employer' });
    const interest = add(5, { reason: TransactionReason.Interest, account: 'savings' });
    const purchase = add(-100, { account: 'card' });
    const refund = add(40, { reason: TransactionReason.Return, account: 'card' });
    const fee = add(-15, { reason: TransactionReason.Fee, account: 'card' });
    const statementCredit = add(25, { reason: TransactionReason.OtherCredit, account: 'card' });
    const paypal = add(60, { reason: TransactionReason.PaymentRecieved, account: 'paypal' });
    const points = add(30, { reason: TransactionReason.PointsCredit, account: 'card' });
    const transfer = add(-500, { reason: TransactionReason.InterAccountTransfer });
    const kindOf = cashFlowClassifier(collection);
    expect(
      [paycheck, interest, purchase, refund, fee, statementCredit, paypal, points, transfer].map(
        kindOf,
      ),
    ).toEqual([
      'income',
      'income',
      'spending',
      'spending',
      'spending',
      'undecided',
      'undecided',
      'undecided',
      'transfer',
    ]);
    const totals = cashFlowTotals(collection.topLevelTransactions, kindOf);
    expect(totals).toMatchObject({
      income: 3005,
      spending: 75,
      grossSpending: 115,
      offsets: 40,
      savings: 2930,
      undecidedCount: 3,
      undecidedAmount: 115,
    });
  });

  it('settles an undecided credit when the user sets its type, even to the same type', () => {
    const { collection, add, setType } = fixture();
    const kept = add(25, { reason: TransactionReason.OtherCredit, account: 'card' });
    const offset = add(30, { reason: TransactionReason.PointsCredit, account: 'card' });
    setType(kept, INCOME_DECISION_REASON);
    setType(offset, SPENDING_DECISION_REASON);
    const kindOf = cashFlowClassifier(collection);
    expect(kindOf(collection.getTransaction(kept.id)!)).toBe('income');
    expect(kindOf(collection.getTransaction(offset.id)!)).toBe('spending');
  });
});

describe('card payments that may be counted twice', () => {
  function cardFixture() {
    const collection = new Transactions('card-payments');
    const info = {
      checking: { type: AccountType.BankChecking, tags: [] as string[] },
      card: { type: AccountType.CreditCard, tags: ['chase'] },
    };
    function add(account: keyof typeof info, amount: number, date: string, name: string) {
      const tx = Transaction.create('statement', account, false, {
        amount,
        transactionDate: date,
        entityName: name,
        entityNameNormalized: name,
        transactionReason: TransactionReason.Purchase,
      });
      collection.addNew(
        tx,
        {
          id: account,
          instituteName: 'Generic',
          title: account,
          type: info[account].type,
          interAccountNameTags: info[account].tags,
          requiresParent: false,
        },
        { id: 'statement', portableAddress: `${account}/s.csv`, contentHash: 'path-id' },
        false,
      );
      return tx;
    }
    return { collection, add };
  }

  it('lists unmatched payments only when the card’s own purchases cover that time', () => {
    const { collection, add } = cardFixture();
    add('card', -120, '2024-03-10', 'Grocery');
    const covered = add('checking', -120, '2024-04-05', 'CHASE EPAY 123');
    // No card records in the 40 days before: the payment is the only record.
    const uncovered = add('checking', -300, '2023-06-05', 'CHASE AUTOPAY');
    // "Purchase" contains "chase", but not at the start of a word.
    add('checking', -40, '2024-04-06', 'POS PURCHASE STORE');
    const flagged = cardPaymentsToReview(collection, cashFlowClassifier(collection));
    expect([...flagged]).toEqual([[covered.id, 'card']]);
    expect(flagged.has(uncovered.id)).toBe(false);

    const report = buildFinancialReport(collection, { from: '', to: '', account: '' });
    expect(report.review.cardpayments).toBe(1);
  });

  it('drops a payment from the list once the user decides its type', () => {
    const { collection, add } = cardFixture();
    add('card', -120, '2024-03-10', 'Grocery');
    const payment = add('checking', -120, '2024-04-05', 'CHASE EPAY 123');
    collection.apply({
      id: 'keep',
      auditInfo: createAuditInfo('test'),
      scopeFilters: [createScopeFilter(ScopeType.TransactionId, [payment.id])],
      values: { transactionReason: editValue(KEEP_SPENDING_DECISION_REASON) },
      sourceId: 'test',
    });
    const kindOf = cashFlowClassifier(collection);
    expect(kindOf(collection.getTransaction(payment.id)!)).toBe('spending');
    expect(cardPaymentsToReview(collection, kindOf).size).toBe(0);
  });
});

describe('refund links', () => {
  it('links a refund to the closest earlier charge from the same merchant with enough amount', () => {
    const { collection, add } = fixture();
    const older = add(-50, { account: 'card', name: 'Shoe Store', date: '2024-01-10' });
    const exact = add(-30, { account: 'card', name: 'Shoe Store', date: '2024-01-05' });
    add(-30, { account: 'card', name: 'Other Store', date: '2024-02-01' });
    const refund = add(30, {
      account: 'card',
      name: 'Shoe Store',
      reason: TransactionReason.Return,
      date: '2024-02-15',
    });
    const tooLate = add(-30, { account: 'card', name: 'Shoe Store', date: '2024-03-01' });
    const kindOf = cashFlowClassifier(collection);
    const links = linkRefunds(collection.topLevelTransactions, kindOf);
    // An exact amount beats a closer date; a charge after the refund never matches.
    expect(links.chargeOf.get(refund.id)).toBe(exact.id);
    expect(links.refundsOf.get(exact.id)).toEqual([refund.id]);
    expect(links.refundsOf.has(older.id)).toBe(false);
    expect(links.refundsOf.has(tooLate.id)).toBe(false);
  });

  it('never links more refunds to a charge than its amount, and ignores old charges', () => {
    const { collection, add } = fixture();
    const charge = add(-50, { account: 'card', name: 'Store', date: '2024-01-01' });
    const first = add(30, {
      account: 'card',
      name: 'Store',
      reason: TransactionReason.Return,
      date: '2024-01-10',
    });
    const second = add(30, {
      account: 'card',
      name: 'Store',
      reason: TransactionReason.Return,
      date: '2024-01-12',
    });
    add(-10, { account: 'card', name: 'Gym', date: '2023-01-01' });
    const late = add(10, {
      account: 'card',
      name: 'Gym',
      reason: TransactionReason.Return,
      date: '2024-01-01',
    });
    const links = linkRefunds(collection.topLevelTransactions, cashFlowClassifier(collection));
    expect(links.chargeOf.get(first.id)).toBe(charge.id);
    expect(links.chargeOf.has(second.id)).toBe(false);
    expect(links.chargeOf.has(late.id)).toBe(false);
  });

  it('counts an uncategorized refund against the category of the charge it reverses', () => {
    const { collection, add } = fixture();
    add(-80, { account: 'card', name: 'Jacket Shop', category: 'Clothing', date: '2024-03-01' });
    add(30, {
      account: 'card',
      name: 'Jacket Shop',
      reason: TransactionReason.Return,
      date: '2024-03-20',
    });
    add(25, { account: 'card', reason: TransactionReason.OtherCredit, name: 'Statement credit' });
    const report = buildFinancialReport(collection, {
      from: '2024-03-01',
      to: '2024-03-31',
      account: '',
    });
    expect(report.categories).toEqual([
      expect.objectContaining({ label: 'Clothing', spending: 50, debits: 80, credits: 30 }),
    ]);
    expect(report.cashFlow).toMatchObject({ spending: 50, undecidedCount: 1 });
    expect(report.review.undecided).toBe(1);
    const csv = financialReportCsv(report);
    expect(csv).toContain('"Spending, net of refunds and discounts"');
    expect(csv).toContain('"Credits awaiting an income decision (not in the figures above)"');
  });
});
