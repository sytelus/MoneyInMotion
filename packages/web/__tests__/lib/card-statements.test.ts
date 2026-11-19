import { describe, expect, it } from 'vitest';
import { AccountType, Transaction, TransactionReason, Transactions } from '@moneyinmotion/core';
import {
  DERIVED_IMPORT_ID,
  cardStatementsOf,
  isDerivedRecord,
  loadTransactions,
} from '../../src/lib/card-statements.js';
import { cashFlowClassifier } from '../../src/lib/cash-flow.js';
import { buildFinancialReport, spendingCategory } from '../../src/lib/financial-reports.js';
import { sourceInventory } from '../../src/lib/import-evidence.js';

function cardFixture() {
  const collection = new Transactions('card-statements');
  const info = {
    checking: { type: AccountType.BankChecking, tags: [] as string[] },
    card: { type: AccountType.CreditCard, tags: ['chase'] },
  };
  function add(
    account: keyof typeof info,
    amount: number,
    date: string,
    name: string,
    reason: number = TransactionReason.Purchase,
  ) {
    const tx = Transaction.create('statement', account, false, {
      amount,
      transactionDate: date,
      entityName: name,
      entityNameNormalized: name,
      transactionReason: reason,
    });
    collection.addNew(
      tx,
      {
        id: account,
        instituteName: 'Generic',
        title: account === 'card' ? 'Chase card' : 'Checking',
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

/** February lines add up to their payment; March lines are $5 more than was paid. */
function scenario() {
  const { collection, add } = cardFixture();
  const lines = [
    add('card', -100, '2024-02-03', 'Grocery'),
    add('card', -50, '2024-02-20', 'Books'),
    add('card', -70, '2024-03-05', 'Grocery'),
    add('card', -30, '2024-03-25', 'Fuel'),
  ];
  const paid = add('checking', -150, '2024-03-08', 'CHASE EPAY 123');
  const cardSide = add(
    'card',
    150,
    '2024-03-10',
    'Payment Thank You',
    TransactionReason.InterAccountPayment,
  );
  const short = add('checking', -95, '2024-04-10', 'CHASE AUTOPAY 456');
  // No card lines anywhere near: the payment is the only record of that spending.
  const alone = add('checking', -300, '2023-06-05', 'CHASE AUTOPAY 789');
  // "Purchase" contains "chase", but not at the start of a word.
  const pos = add('checking', -40, '2024-04-06', 'POS PURCHASE STORE');
  return { collection, lines, paid, cardSide, short, alone, pos };
}

describe('card statements', () => {
  it('pairs each payment with the lines of the billing period it paid', () => {
    const { collection, lines, paid, cardSide, short, alone, pos } = scenario();
    const index = cardStatementsOf(collection);
    expect(index.statements.map((s) => [s.status, s.itemIds.length, s.charges, s.paid])).toEqual([
      ['reconciled', 2, 150, 150],
      ['difference', 2, 100, 95],
    ]);
    const [february, march] = index.statements;
    expect(february!.itemIds).toEqual([lines[0]!.id, lines[1]!.id]);
    expect(february!.paymentIds).toEqual([paid.id]);
    expect(february!.cardPaymentIds).toEqual([cardSide.id]);
    expect(march!.paymentIds).toEqual([short.id]);
    expect(march!.unexplained).toBe(-5);
    expect([...index.standalonePayments]).toEqual([alone.id]);
    expect(index.statementOf.has(pos.id)).toBe(false);

    const kindOf = cashFlowClassifier(collection);
    expect(kindOf(paid)).toBe('transfer');
    expect(kindOf(cardSide)).toBe('transfer');
    expect(kindOf(short)).toBe('transfer');
    expect(kindOf(alone)).toBe('spending');
    expect(spendingCategory(collection, alone)).toBe('Card payment (no statement lines)');
  });

  it('adds an unexplained difference so spending equals what was paid, and flags it', () => {
    const { collection } = scenario();
    const loaded = loadTransactions(collection.serialize());
    const difference = [...loaded.topLevelTransactions].find(isDerivedRecord)!;
    expect(difference).toMatchObject({
      accountId: 'card',
      importId: DERIVED_IMPORT_ID,
      correctedAmount: 5,
      correctedTransactionReason: TransactionReason.MatchAdjustmentCredit,
    });
    expect(cardStatementsOf(loaded).statementOf.get(difference.id)).toBe(
      cardStatementsOf(loaded).statements[1]!.id,
    );
    const report = buildFinancialReport(loaded, { from: '', to: '', account: '' });
    // Lines 150 + 100, less the 5 the lines overstate, plus the lone payment and the store.
    expect(report.cashFlow.spending).toBeCloseTo(150 + 95 + 300 + 40);
    expect(report.review.statements).toBe(1);
    expect(sourceInventory(loaded).some((item) => item.source.id === DERIVED_IMPORT_ID)).toBe(
      false,
    );
  });

  it('counts lines on their own when no payment for them is imported', () => {
    const { collection, add } = cardFixture();
    add('card', -20, '2024-02-03', 'Grocery');
    const index = cardStatementsOf(collection);
    expect(index.statements.map((s) => s.status)).toEqual(['unpaid']);
    const report = buildFinancialReport(loadTransactions(collection.serialize()), {
      from: '',
      to: '',
      account: '',
    });
    expect(report.cashFlow.spending).toBe(20);
    expect(report.review.statements).toBe(0);
  });
});
