import { describe, expect, it } from 'vitest';
import { AccountType, Transaction, TransactionReason, Transactions } from '@moneyinmotion/core';
import {
  DERIVED_IMPORT_ID,
  ESTIMATED_CATEGORY,
  cardStatementsOf,
  isDerivedRecord,
  loadTransactions,
} from '../../src/lib/card-statements.js';
import { cashFlowClassifier } from '../../src/lib/cash-flow.js';
import { duplicateRowsOf } from '../../src/lib/duplicates.js';
import { statementCheckChange } from '../../src/lib/statement-checks.js';
import {
  buildFinancialReport,
  spendingCategory,
  statementsToReview,
} from '../../src/lib/financial-reports.js';
import { reportingTransactions } from '../../src/lib/transaction-explorer.js';
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
    options: { reason?: number; posted?: string; file?: string } = {},
  ) {
    const file = options.file ?? `${account}/s.csv`;
    const tx = Transaction.create(file, account, false, {
      amount,
      transactionDate: date,
      postedDate: options.posted ?? null,
      entityName: name,
      entityNameNormalized: name,
      transactionReason: options.reason ?? TransactionReason.Purchase,
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
      { id: file, portableAddress: file, contentHash: file },
      false,
    );
    return tx;
  }
  const pay = (amount: number, date: string, name = 'CHASE EPAY') =>
    add('checking', -amount, date, name);
  return { collection, add, pay };
}

const statuses = (collection: Transactions) =>
  cardStatementsOf(collection).statements.map((s) => [s.closing, s.status]);
const spending = (collection: Transactions, from = '', to = '') =>
  buildFinancialReport(loadTransactions(collection.serialize()), { from, to, account: '' }).cashFlow
    .spending;

describe('card statements', () => {
  it('counts lines, treats payments as transfers, and allows for refunds that reduce an autopay', () => {
    const { collection, add, pay } = cardFixture();
    add('card', -100, '2024-02-03', 'Grocery');
    add('card', -50, '2024-02-20', 'Books');
    const paid = pay(150, '2024-03-08');
    const cardSide = add('card', 150, '2024-03-10', 'Payment Thank You', {
      reason: TransactionReason.InterAccountPayment,
    });
    add('card', -70, '2024-03-05', 'Grocery');
    add('card', -30, '2024-03-25', 'Fuel');
    // A refund after the closing but before the autopay: the bank collects $5 less,
    // and the refund shows on the next statement.
    add('card', -7, '2024-04-14', 'Cafe');
    add('card', 5, '2024-04-15', 'Fuel', { reason: TransactionReason.Return });
    pay(95, '2024-04-25');
    add('card', -40, '2024-04-28', 'Grocery');
    pay(47, '2024-05-25');
    // "Purchase" contains "chase", but not at the start of a word.
    const pos = add('checking', -40, '2024-04-06', 'POS PURCHASE STORE');

    const index = cardStatementsOf(collection);
    expect(index.statements.map((s) => [s.status, s.charges, s.paid])).toEqual([
      ['reconciled', 150, 150],
      ['reconciled', 100, 95],
      ['reconciled', 42, 47],
    ]);
    expect(index.statements[1]!.creditsBeforePayment).toBe(5);
    const kindOf = cashFlowClassifier(collection);
    expect(kindOf(paid)).toBe('transfer');
    expect(kindOf(cardSide)).toBe('transfer');
    expect(index.statementOf.has(pos.id)).toBe(false);
    expect(spending(collection)).toBeCloseTo(150 + 100 + 42 + 40);
  });

  it('spreads a payment with no lines evenly over its billing period as estimates', () => {
    const { collection, add, pay } = cardFixture();
    add('card', -10, '2024-02-03', 'Grocery');
    pay(10, '2024-03-08');
    // Long before the card's first line: the payment is the only record.
    const alone = pay(300, '2023-06-05', 'CHASE AUTOPAY');
    const loaded = loadTransactions(collection.serialize());
    const statement = cardStatementsOf(loaded).statements.find((s) => s.status === 'no-lines')!;
    expect(statement).toMatchObject({ estimated: 300, paymentIds: [alone.id] });
    const estimates = [...loaded.topLevelTransactions].filter(isDerivedRecord);
    expect(estimates).toHaveLength(statement.estimateIds.length);
    expect(estimates.length).toBeGreaterThanOrEqual(28);
    expect(estimates.reduce((sum, tx) => sum - tx.correctedAmount, 0)).toBeCloseTo(300);
    expect(new Set(estimates.map((tx) => tx.correctedTransactionDate)).size).toBe(estimates.length);
    expect(estimates[0]).toMatchObject({ importId: DERIVED_IMPORT_ID, accountId: 'card' });
    expect(spendingCategory(loaded, estimates[0]!)).toBe(ESTIMATED_CATEGORY);
    expect(cashFlowClassifier(loaded)(loaded.getTransaction(alone.id)!)).toBe('transfer');
    // A week in the middle of the period gets about a week's share, not the whole payment.
    const week = spending(
      collection,
      statement.opening.slice(0, 8) + '10',
      statement.opening.slice(0, 8) + '16',
    );
    expect(week).toBeGreaterThan(60);
    expect(week).toBeLessThan(80);
    expect(sourceInventory(loaded).some((item) => item.source.id === DERIVED_IMPORT_ID)).toBe(
      false,
    );
  });

  it('flags lines that stay missing, and estimates the missing amount', () => {
    const { collection, add, pay } = cardFixture();
    add('card', -150, '2024-02-03', 'Grocery');
    pay(150, '2024-03-08');
    add('card', -100, '2024-03-05', 'Grocery');
    pay(130, '2024-04-10');
    add('card', -40, '2024-04-20', 'Grocery');
    pay(40, '2024-05-10');
    add('card', -60, '2024-05-20', 'Grocery');
    pay(60, '2024-06-10');
    const index = cardStatementsOf(collection);
    expect(index.statements.map((s) => s.status)).toEqual([
      'reconciled',
      'shortfall',
      'reconciled',
      'reconciled',
    ]);
    expect(index.statements[1]).toMatchObject({ unresolved: 30, estimated: 30 });
    expect(spending(collection)).toBeCloseTo(150 + 100 + 30 + 40 + 60);
    const report = buildFinancialReport(loadTransactions(collection.serialize()), {
      from: '',
      to: '',
      account: '',
    });
    expect(report.review.statements).toBe(1);
  });

  it('treats an extra payment that the next one makes up for as timing, not an error', () => {
    const { collection, add, pay } = cardFixture();
    add('card', -150, '2024-02-03', 'Grocery');
    pay(150, '2024-03-08');
    add('card', -100, '2024-03-05', 'Grocery');
    pay(110, '2024-04-10');
    add('card', -40, '2024-04-20', 'Grocery');
    pay(30, '2024-05-10');
    expect(statuses(collection).map(([, status]) => status)).toEqual([
      'reconciled',
      'timing',
      'reconciled',
    ]);
    expect(spending(collection)).toBeCloseTo(290);
  });

  it('counts refunds that reduced the autopay of a statement with no lines', () => {
    const { collection, add, pay } = cardFixture();
    // Lines on Feb 3 and Feb 29 and on May 3 pin the closing day to the 1st or 2nd.
    add('card', -100, '2024-02-03', 'Grocery');
    add('card', -50, '2024-02-29', 'Grocery');
    pay(150, '2024-03-08');
    // No lines for the next statement ($210 owed); its autopay was $10 less because of a
    // refund that shows on the statement after it, so that one collects the $10.
    pay(200, '2024-04-25');
    add('card', 10, '2024-04-15', 'Fuel', { reason: TransactionReason.Return });
    add('card', -70, '2024-04-20', 'Grocery');
    pay(70, '2024-05-25');
    add('card', -40, '2024-05-03', 'Grocery');
    pay(40, '2024-06-25');
    const index = cardStatementsOf(collection);
    expect(index.statements.map((s) => s.status)).toEqual([
      'reconciled',
      'no-lines',
      'reconciled',
      'reconciled',
    ]);
    expect(index.statements[1]).toMatchObject({ creditsBeforePayment: 10, estimated: 210 });
    expect(spending(collection)).toBeCloseTo(150 + 210 + 60 + 40);
    expect(statementsToReview(loadTransactions(collection.serialize()))).toEqual([]);
  });

  it('flags each statement of a difference that grows over two statements', () => {
    const { collection, add, pay } = cardFixture();
    add('card', -150, '2024-02-03', 'Grocery');
    pay(150, '2024-03-08');
    add('card', -100, '2024-03-05', 'Grocery');
    pay(75, '2024-04-10');
    add('card', -40, '2024-04-20', 'Grocery');
    pay(15, '2024-05-10');
    expect(cardStatementsOf(collection).statements.map((s) => [s.status, s.unresolved])).toEqual([
      ['reconciled', 0],
      ['excess', -25],
      ['excess', -25],
    ]);
  });

  it('takes a checked statement off the review list while its difference is unchanged', () => {
    const { collection, add, pay } = cardFixture();
    add('card', -150, '2024-02-03', 'Grocery');
    pay(150, '2024-03-08');
    add('card', -100, '2024-03-05', 'Grocery');
    pay(75, '2024-04-10');
    add('card', -40, '2024-04-20', 'Grocery');
    pay(40, '2024-05-10');
    const flagged = cardStatementsOf(collection).statements[1]!;
    expect(flagged).toMatchObject({ status: 'excess', unresolved: -25, check: null });

    const change = statementCheckChange(collection, flagged, ' A credit missing from the export ')!;
    expect(change.previous).toBeNull();
    const edits = collection.getClonedEdits();
    edits.add(change.next!);
    const checked = collection.withReplayedEdits(edits);
    const statement = cardStatementsOf(checked).statements[1]!;
    expect(statement.check).toEqual({
      lineId: flagged.itemIds.at(-1),
      difference: -25,
      note: 'A credit missing from the export',
      current: true,
    });
    expect(statementsToReview(checked)).toEqual([]);
    expect(buildFinancialReport(checked, { from: '', to: '', account: '' }).review.statements).toBe(
      0,
    );

    // Changing the note replaces the same rule; undoing removes it.
    const renote = statementCheckChange(checked, statement, 'Found it')!;
    expect(renote.previous?.id).toBe(change.next!.id);
    expect(renote.next?.id).toBe(change.next!.id);
    expect(statementCheckChange(checked, statement, null)).toEqual({
      previous: renote.previous,
      next: null,
    });

    // A later import changes the difference: the statement needs another look.
    add('card', -5, '2024-03-20', 'Cafe');
    const changed = collection.withReplayedEdits(edits);
    expect(cardStatementsOf(changed).statements[1]!.check?.current).toBe(false);
    expect(statementsToReview(changed)).toHaveLength(1);
  });

  it('counts a row exported in two overlapping files once', () => {
    const { collection, add, pay } = cardFixture();
    const kept = add('card', -36.5, '2024-02-13', 'SHELL OIL 576', {
      posted: '2024-02-15',
      file: 'card/download.csv',
    });
    const copy = add('card', -36.5, '2024-02-13', 'SHELL OIL 576 SNOQUALMIE WA', {
      file: 'card/hand-made.csv',
    });
    // Two purchases on one day with similar names in one file: both count.
    add('card', -5, '2024-02-14', 'Cafe', { file: 'card/download.csv' });
    add('card', -5, '2024-02-14', 'Cafe Downtown', { file: 'card/download.csv' });
    pay(46.5, '2024-03-08');
    expect([...duplicateRowsOf(collection).duplicateOf]).toEqual([[copy.id, kept.id]]);
    expect(reportingTransactions(collection).some((tx) => tx.id === copy.id)).toBe(false);
    expect(cashFlowClassifier(collection)(copy)).toBe('duplicate');
    expect(statuses(collection).map(([, status]) => status)).toEqual(['reconciled']);
    expect(spending(collection)).toBeCloseTo(46.5);
  });
});
