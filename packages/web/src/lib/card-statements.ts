/**
 * Card statements: the level between a bank payment to a card and the card's
 * own lines. Derived on load, never persisted.
 *
 * Lines give the timing and the categories; payments check that the lines are
 * complete. Spending is counted from the lines on their own dates whenever
 * they exist, and a payment to a card is a transfer. Where lines are missing,
 * the missing amount is spread evenly over the billing period as daily
 * "estimated" records, so any period, from a few days to years, shows a
 * reasonable figure, and importing the lines later replaces the estimate.
 *
 * Statements are reconciled with a running balance, as the issuer does it
 * (see `classify`), so refunds that reduce an autopay, lines posted a day
 * later than a hand-made file says, and early payments show as timing rather
 * than as errors. Only differences that persist are flagged for review.
 *
 * Billing periods are rebuilt from the data: each card has a closing day,
 * learned as the day of month that lets the most payments equal their
 * period's lines exactly. A closing may move up to {@link SLACK_DAYS} days to
 * make a period add up, and a payment pays the latest period that closed in
 * the {@link PAY_WINDOW_DAYS} days before it.
 */
import {
  AccountType,
  TransactionReason,
  containsWordStart,
  isInterAccount,
  type Transaction,
  type TransactionData,
  Transactions,
  type TransactionsData,
} from '@moneyinmotion/core';
import { duplicateRowsOf, rememberDuplicateRows } from './duplicates.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SLACK_DAYS = 5;
const PAY_WINDOW_DAYS = 50;
/** A payment pays a statement that closed at least this many days before it. */
const MIN_PAY_LAG_DAYS = 14;
/** For a card with no imported lines at all: its statement closed this long before the payment. */
const ASSUMED_PAY_LAG_DAYS = 25;
/** An unlinked bank payment and card payment of the same amount this close are one payment. */
const PAIR_DAYS = 7;

/** Import ID of the derived records (daily estimates). */
export const DERIVED_IMPORT_ID = 'mim-statement-check';

export type CardStatementStatus =
  'reconciled' | 'timing' | 'shortfall' | 'excess' | 'missing-payment' | 'no-lines' | 'unpaid';

export interface CardStatement {
  /** `<card account ID>:<closing date>` */
  id: string;
  accountId: string;
  /** First and last day of the billing period, YYYY-MM-DD. */
  opening: string;
  closing: string;
  /** Card lines (top-level card records, not payments or duplicate rows), oldest first. */
  itemIds: string[];
  /** Bank payments, or card-side payment records when the bank side isn't imported. */
  paymentIds: string[];
  /** Card-side payment records ("Payment, thank you"). */
  cardPaymentIds: string[];
  /** Owed for the period: charges minus credits, in dollars. */
  charges: number;
  paid: number;
  /** Refunds posted after the closing but before the payment; autopay collects that much less. */
  creditsBeforePayment: number;
  /** For `shortfall` and `excess`: paid minus lines that the next statements don't make up for. */
  unresolved: number;
  /** Estimated spending added where lines are missing (dollars, positive). */
  estimated: number;
  estimateIds: string[];
  status: CardStatementStatus;
}

export interface CardStatementIndex {
  statements: CardStatement[];
  byId: Map<string, CardStatement>;
  /** Any record that belongs to a statement (line, payment, estimate) → statement ID. */
  statementOf: Map<string, string>;
  /** Bank and card payment records to cards: transfers, explained by lines or estimates. */
  statementPayments: Set<string>;
  /** Derived daily estimates, added to the snapshot on load. */
  estimates: TransactionData[];
}

interface PaymentUnit {
  /** The bank record when imported, else the card-side record. */
  id: string;
  bank: Transaction | null;
  card: Transaction | null;
  cents: number;
  /** Card-side day when known (cycles are on the card's dates), else the bank day. */
  day: number;
}

const cents = (amount: number) => Math.round(amount * 100);
const dayOf = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10)) / DAY_MS);
const isoDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const statementDay = (tx: Transaction) => dayOf(tx.postedDate || tx.correctedTransactionDate);
const isDerived = (tx: Transaction) => tx.importId === DERIVED_IMPORT_ID;

/** The same day of the month, a month earlier. */
function monthBefore(day: number): number {
  const date = new Date(day * DAY_MS);
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, date.getUTCDate()) / DAY_MS,
  );
}

/** The latest closing on `closingDay` of a month, on or before `day`. */
function latestClosingBefore(closingDay: number, day: number): number {
  const date = new Date(day * DAY_MS);
  const thisMonth = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), closingDay) / DAY_MS,
  );
  return thisMonth <= day
    ? thisMonth
    : Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, closingDay) / DAY_MS);
}

/** True for derived records (daily estimates), which can't be edited. */
export function isDerivedRecord(tx: Transaction): boolean {
  return isDerived(tx);
}

function isCardPaymentRecord(tx: Transaction) {
  return tx.correctedAmount > 0 && isInterAccount(tx.correctedTransactionReason);
}

/** Bank payments and card-side payment records, grouped per card into payment units. */
function paymentUnits(transactions: Transactions, cardIds: Set<string>) {
  const tags = [...cardIds].map((id) => ({
    id,
    tags: transactions.getAccountInfo(id).interAccountNameTags ?? [],
  }));
  const units = new Map<string, PaymentUnit[]>([...cardIds].map((id) => [id, []]));
  const pairedCardIds = new Set<string>();
  const unlinkedBank = new Map<string, Transaction[]>();
  for (const tx of transactions.topLevelTransactions) {
    const type = transactions.getAccountInfo(tx.accountId).type;
    if (type !== AccountType.BankChecking && type !== AccountType.BankSavings) continue;
    if (tx.correctedAmount >= 0) continue;
    if (tx.correctedTransactionReason & TransactionReason.InvestmentTransfer) continue;
    const linked = tx.relatedTransferId ? transactions.getTransaction(tx.relatedTransferId) : null;
    if (linked) {
      if (!cardIds.has(linked.accountId)) continue;
      pairedCardIds.add(linked.id);
      units.get(linked.accountId)!.push({
        id: tx.id,
        bank: tx,
        card: linked,
        cents: -cents(tx.correctedAmount),
        day: statementDay(linked),
      });
      continue;
    }
    const card = tags.find(({ tags: names }) =>
      names.some((tag) => containsWordStart(tx.entityName, tag)),
    );
    if (!card) continue;
    unlinkedBank.set(card.id, [...(unlinkedBank.get(card.id) ?? []), tx]);
  }
  for (const cardId of cardIds) {
    const bank = unlinkedBank.get(cardId) ?? [];
    const used = new Set<string>();
    for (const tx of transactions.topLevelTransactions) {
      if (tx.accountId !== cardId || !isCardPaymentRecord(tx) || pairedCardIds.has(tx.id)) continue;
      const linkedBank = tx.relatedTransferId
        ? transactions.getTransaction(tx.relatedTransferId)
        : null;
      // Linked to a non-bank record (or one that isn't a card payment): not a payment unit.
      if (linkedBank) continue;
      const amount = cents(tx.correctedAmount);
      const day = statementDay(tx);
      const match = bank
        .filter(
          (candidate) =>
            !used.has(candidate.id) &&
            -cents(candidate.correctedAmount) === amount &&
            Math.abs(dayOf(candidate.correctedTransactionDate) - day) <= PAIR_DAYS,
        )
        .sort(
          (a, b) =>
            Math.abs(dayOf(a.correctedTransactionDate) - day) -
              Math.abs(dayOf(b.correctedTransactionDate) - day) || a.id.localeCompare(b.id),
        )[0];
      if (match) used.add(match.id);
      units
        .get(cardId)!
        .push({ id: match?.id ?? tx.id, bank: match ?? null, card: tx, cents: amount, day });
    }
    for (const tx of bank)
      if (!used.has(tx.id))
        units.get(cardId)!.push({
          id: tx.id,
          bank: tx,
          card: null,
          cents: -cents(tx.correctedAmount),
          day: dayOf(tx.correctedTransactionDate),
        });
  }
  for (const list of units.values()) list.sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
  return units;
}

interface Period {
  closing: number;
  start: number;
  end: number;
  units: PaymentUnit[];
  exact: boolean;
}

/** Monthly closings on `day`, covering a month before the first line and after the last. */
function closings(day: number, first: number, last: number): number[] {
  const result: number[] = [];
  const start = new Date(first * DAY_MS);
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth() - 1;
  for (;;) {
    const closing = Math.floor(Date.UTC(year, month, day) / DAY_MS);
    if (closing > last + 31) break;
    result.push(closing);
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return result;
}

/** Split a card's lines into periods closing on `day` and pair each with its payment. */
function periodsFor(
  closingDay: number,
  days: readonly number[],
  prefix: readonly number[],
  units: readonly PaymentUnit[],
): Period[] {
  const byAmount = new Map<number, PaymentUnit[]>();
  for (const unit of units) byAmount.set(unit.cents, [...(byAmount.get(unit.cents) ?? []), unit]);
  const firstAfter = (day: number) => {
    let low = 0;
    let high = days.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (days[middle]! <= day) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const used = new Set<string>();
  const periods: Period[] = [];
  let start = 0;
  for (const closing of closings(closingDay, days[0]!, days.at(-1)!)) {
    // Candidate cuts: the gap between the period's last line and the next
    // line overlaps the closing, give or take SLACK_DAYS.
    const low = Math.max(start + 1, firstAfter(closing - SLACK_DAYS - 1));
    const high = firstAfter(closing + SLACK_DAYS);
    let best: { distance: number; end: number; unit: PaymentUnit } | null = null;
    for (let end = low; end <= high; end++) {
      const last = days[end - 1]!;
      const next = end < days.length ? days[end]! : Infinity;
      // The closing as close to the nominal one as this cut allows.
      const close = Math.min(Math.max(closing, last), next - 1);
      const distance = Math.abs(close - closing);
      for (const unit of byAmount.get(prefix[end]! - prefix[start]!) ?? []) {
        if (used.has(unit.id) || unit.day <= close || unit.day > close + PAY_WINDOW_DAYS) continue;
        if (!best || distance < best.distance) best = { distance, end, unit };
      }
    }
    if (best) {
      used.add(best.unit.id);
      periods.push({ closing, start, end: best.end, units: [best.unit], exact: true });
      start = best.end;
    } else {
      const end = Math.max(start, firstAfter(closing));
      periods.push({ closing, start, end, units: [], exact: false });
      start = end;
    }
  }
  // Other payments pay the latest period that closed shortly before them,
  // preferring one that isn't paid exactly yet (an extra payment still goes
  // to a paid one; the running balance then shows it as timing).
  for (const unit of units) {
    if (used.has(unit.id)) continue;
    const near = [...periods]
      .reverse()
      .filter(
        (candidate) =>
          candidate.closing < unit.day && unit.day <= candidate.closing + PAY_WINDOW_DAYS,
      );
    const period =
      near.find((candidate) => !candidate.exact) ??
      near.find((candidate) => candidate.end > candidate.start);
    if (period) {
      period.units.push(unit);
      used.add(unit.id);
    }
  }
  // Two neighbouring periods that are off by opposite amounts usually have a
  // line on the wrong side of the closing: move the cut if that fixes both.
  const paid = (period: Period) => period.units.reduce((sum, unit) => sum + unit.cents, 0);
  for (let position = 0; position + 1 < periods.length; position++) {
    const first = periods[position]!;
    const second = periods[position + 1]!;
    if (first.exact || second.exact || !first.units.length || !second.units.length) continue;
    if (prefix[second.end]! - prefix[first.start]! !== paid(first) + paid(second)) continue;
    for (let cut = first.start + 1; cut < second.end; cut++) {
      if (prefix[cut]! - prefix[first.start]! !== paid(first)) continue;
      first.end = cut;
      second.start = cut;
      first.exact = second.exact = true;
      break;
    }
  }
  return periods;
}

/** Rebuild every card's statements from a snapshot. */
export function buildCardStatements(transactions: Transactions): CardStatementIndex {
  const index: CardStatementIndex = {
    statements: [],
    byId: new Map(),
    statementOf: new Map(),
    statementPayments: new Set(),
    estimates: [],
  };
  const duplicates = duplicateRowsOf(transactions).duplicateOf;
  const cardIds = new Set<string>();
  const lines = new Map<string, Transaction[]>();
  const lastDay = new Map<string, number>();
  for (const tx of transactions.topLevelTransactions) {
    if (isDerived(tx)) continue;
    const day = dayOf(tx.correctedTransactionDate);
    lastDay.set(tx.accountId, Math.max(lastDay.get(tx.accountId) ?? day, day));
    if (transactions.getAccountInfo(tx.accountId).type !== AccountType.CreditCard) continue;
    cardIds.add(tx.accountId);
    if (isCardPaymentRecord(tx) || duplicates.has(tx.id)) continue;
    lines.set(tx.accountId, [...(lines.get(tx.accountId) ?? []), tx]);
  }
  const unitsByCard = paymentUnits(transactions, cardIds);
  for (const cardId of [...cardIds].sort()) {
    const title = transactions.getAccountInfo(cardId).title || cardId;
    const units = unitsByCard.get(cardId) ?? [];
    const items = (lines.get(cardId) ?? [])
      .map((tx) => ({ tx, day: statementDay(tx), cents: -cents(tx.correctedAmount) }))
      .sort((a, b) => a.day - b.day || a.tx.id.localeCompare(b.tx.id));
    let periods: Period[] = [];
    let closingDay = 0;
    if (items.length) {
      const days = items.map((item) => item.day);
      const prefix = [0];
      for (const item of items) prefix.push(prefix.at(-1)! + item.cents);
      let bestScore = -1;
      for (let day = 1; day <= 28; day++) {
        const candidate = periodsFor(day, days, prefix, units);
        const score = candidate.filter((period) => period.exact).length;
        if (score > bestScore) {
          bestScore = score;
          periods = candidate;
          closingDay = day;
        }
      }
    }
    // The bank data that pays this card ends here: later statements aren't "missing" a payment.
    const bankEnd = Math.max(
      -Infinity,
      ...units.flatMap((unit) =>
        unit.bank ? [lastDay.get(unit.bank.accountId) ?? -Infinity] : [],
      ),
    );
    const drafts: Draft[] = [];
    periods.forEach((period, position) => {
      const periodItems = items.slice(period.start, period.end);
      if (!periodItems.length && !period.units.length) return;
      const previous = position > 0 ? periods[position - 1]!.closing : monthBefore(period.closing);
      drafts.push({
        closing: period.closing,
        opening: previous + 1,
        items: periodItems,
        units: period.units,
        nextItems: items.slice(period.end),
      });
    });
    // Bank payments with no card lines anywhere near: a statement of their own, with no lines.
    const placed = new Set(periods.flatMap((period) => period.units.map((unit) => unit.id)));
    for (const unit of units) {
      if (placed.has(unit.id)) continue;
      if (!unit.bank) {
        if (unit.card) index.statementPayments.add(unit.card.id);
        continue;
      }
      const closing = closingDay
        ? latestClosingBefore(closingDay, unit.day - MIN_PAY_LAG_DAYS)
        : unit.day - ASSUMED_PAY_LAG_DAYS;
      const existing = drafts.find((draft) => draft.closing === closing && !draft.items.length);
      if (existing) existing.units.push(unit);
      else
        drafts.push({
          closing,
          opening: monthBefore(closing) + 1,
          items: [],
          units: [unit],
          nextItems: [],
        });
    }
    drafts.sort((a, b) => a.closing - b.closing);
    const statements = drafts.map((draft) => toStatement(cardId, draft, bankEnd));
    classify(statements, drafts);
    statements.forEach((statement, position) => {
      const draft = drafts[position]!;
      const missingCents =
        statement.status === 'no-lines'
          ? Math.round(statement.paid * 100)
          : statement.status === 'shortfall'
            ? Math.round(statement.unresolved * 100)
            : 0;
      if (missingCents > 0) {
        const records = estimateRecords(
          statement,
          title,
          draft.opening,
          draft.closing,
          missingCents,
        );
        statement.estimateIds = records.map((record) => record.id);
        statement.estimated = missingCents / 100;
        index.estimates.push(...records);
      }
      for (const unit of draft.units) {
        if (unit.bank) index.statementPayments.add(unit.bank.id);
        if (unit.card) index.statementPayments.add(unit.card.id);
      }
      index.statements.push(statement);
      index.byId.set(statement.id, statement);
      for (const recordId of [
        ...statement.itemIds,
        ...statement.paymentIds,
        ...statement.cardPaymentIds,
        ...statement.estimateIds,
      ])
        index.statementOf.set(recordId, statement.id);
    });
  }
  return index;
}

interface Draft {
  closing: number;
  opening: number;
  items: { tx: Transaction; day: number; cents: number }[];
  units: PaymentUnit[];
  /** Lines after this period, to find refunds posted before this statement's payment. */
  nextItems: { tx: Transaction; day: number; cents: number }[];
}

/** Statements with both lines and payments, plus unpaid ones the bank data should cover. */
function toStatement(cardId: string, draft: Draft, bankEnd: number): CardStatement {
  const charges = draft.items.reduce((sum, item) => sum + item.cents, 0);
  const paid = draft.units.reduce((sum, unit) => sum + unit.cents, 0);
  const lastPayment = Math.max(-Infinity, ...draft.units.map((unit) => unit.day));
  const credits = draft.nextItems
    .filter((item) => item.cents < 0 && item.day <= lastPayment)
    .reduce((sum, item) => sum + item.cents, 0);
  const closing = isoDay(draft.closing);
  return {
    id: `${cardId}:${closing}`,
    accountId: cardId,
    opening: isoDay(draft.opening),
    closing,
    itemIds: draft.items.map((item) => item.tx.id),
    paymentIds: draft.units.map((unit) => unit.id),
    cardPaymentIds: draft.units.flatMap((unit) => (unit.card ? [unit.card.id] : [])),
    charges: charges / 100,
    paid: paid / 100,
    creditsBeforePayment: -credits / 100,
    unresolved: 0,
    estimated: 0,
    estimateIds: [],
    status: !draft.items.length
      ? 'no-lines'
      : draft.units.length || draft.closing + PAY_WINDOW_DAYS <= bankEnd
        ? 'reconciled'
        : 'unpaid',
  };
}

/**
 * Reconcile a card's statements the way the issuer does: a running balance.
 * After the payment for statement k, everything paid so far should equal all
 * lines up to its closing, less refunds posted after the closing but before
 * the payment (autopay collects the balance less those). The gap ("residual")
 * stays constant when everything is consistent. When it moves and comes back
 * within two statements, a line or payment only landed in a neighbouring
 * period ("timing"). When it moves for good, something is missing: more paid
 * than the lines show (lines missing: "shortfall") or the reverse ("excess",
 * or "missing-payment" when the statement has no payment).
 */
function classify(statements: CardStatement[], drafts: Draft[]) {
  const sequence = statements
    .map((statement, position) => ({ statement, draft: drafts[position]! }))
    .filter(({ statement }) => statement.status === 'reconciled');
  let paid = 0;
  let owed = 0;
  const residuals = sequence.map(({ statement }) => {
    paid += Math.round(statement.paid * 100);
    owed += Math.round(statement.charges * 100);
    return paid - owed + Math.round(statement.creditsBeforePayment * 100);
  });
  let level = 0;
  let k = 0;
  while (k < sequence.length) {
    if (residuals[k] === level) {
      k++;
      continue;
    }
    let back = -1;
    for (let j = k + 1; j <= Math.min(k + 2, sequence.length - 1); j++)
      if (residuals[j] === level) {
        back = j;
        break;
      }
    if (back >= 0) {
      for (let j = k; j < back; j++) sequence[j]!.statement.status = 'timing';
      k = back;
      continue;
    }
    const end = Math.min(k + 2, sequence.length - 1);
    const persistent = residuals[end]! - level;
    const first = sequence[k]!.statement;
    first.unresolved = persistent / 100;
    first.status =
      persistent > 0 ? 'shortfall' : first.paymentIds.length ? 'excess' : 'missing-payment';
    for (let j = k + 1; j <= end; j++)
      if (residuals[j] !== residuals[end]) sequence[j]!.statement.status = 'timing';
    level = residuals[end]!;
    k = end + 1;
  }
}

/** Spread missing spending evenly over a billing period, one record per day. */
function estimateRecords(
  statement: CardStatement,
  title: string,
  opening: number,
  closing: number,
  totalCents: number,
): TransactionData[] {
  const days = Math.max(1, closing - opening + 1);
  const base = Math.floor(totalCents / days);
  const remainder = totalCents - base * days;
  const reason =
    statement.status === 'no-lines'
      ? `No ${title} lines are imported for the statement this payment paid.`
      : `${title} lines for this statement add up to less than was paid.`;
  return Array.from({ length: days }, (_, offset) => {
    const day = isoDay(opening + offset);
    const id = `estimate:${statement.id}:${day}`;
    return {
      id,
      transactionReason: TransactionReason.Purchase,
      transactionDate: `${day}T00:00:00.000Z`,
      entityName: `Estimated ${title} spending`,
      entityNameNormalized: 'Estimated card spending',
      providerCategoryName: ESTIMATED_CATEGORY,
      providerAttributes: { Estimate: reason },
      amount: -(base + (offset < remainder ? 1 : 0)) / 100,
      contentHash: id,
      accountId: statement.accountId,
      importId: DERIVED_IMPORT_ID,
      auditInfo: { createDate: `${statement.closing}T00:00:00.000Z`, createdBy: 'MoneyInMotion' },
    } satisfies TransactionData;
  });
}

/** Category of estimated card spending. */
export const ESTIMATED_CATEGORY = 'Card spending (estimated)';

const indexCache = new WeakMap<Transactions, CardStatementIndex>();

/** Statements for a snapshot; computed once per Transactions object. */
export function cardStatementsOf(transactions: Transactions): CardStatementIndex {
  let index = indexCache.get(transactions);
  if (!index) {
    index = buildCardStatements(transactions);
    indexCache.set(transactions, index);
  }
  return index;
}

/**
 * Load a snapshot for the app: the imported records plus derived daily
 * estimates where card lines are missing. Use this instead of
 * `Transactions.fromData` wherever totals are shown.
 */
export function loadTransactions(data: TransactionsData): Transactions {
  const base = Transactions.fromData(data);
  const index = buildCardStatements(base);
  if (!index.estimates.length) {
    indexCache.set(base, index);
    return base;
  }
  const full = Transactions.fromData({
    ...data,
    topItems: {
      ...data.topItems,
      ...Object.fromEntries(index.estimates.map((tx) => [tx.id, tx])),
    },
    importInfos: {
      ...data.importInfos,
      [DERIVED_IMPORT_ID]: {
        id: DERIVED_IMPORT_ID,
        portableAddress: 'Estimated card spending (derived)',
        contentHash: DERIVED_IMPORT_ID,
        format: 'derived',
      },
    },
  });
  indexCache.set(full, index);
  rememberDuplicateRows(full, duplicateRowsOf(base));
  return full;
}

/** What a statement's status means for the totals, in a sentence. */
export const statementStatusText: Record<CardStatementStatus, { label: string; help: string }> = {
  reconciled: {
    label: 'Adds up',
    help: 'The lines add up to the payment, allowing for refunds that arrived before it. The lines count as spending; the payment is a transfer.',
  },
  timing: {
    label: 'Adds up with the next statement',
    help: 'A line or payment landed in a neighbouring period; the two statements add up together. The lines count as spending.',
  },
  shortfall: {
    label: 'Lines missing',
    help: 'More was paid than the lines show, and the next statements don’t make up for it. The lines count, and the rest is estimated spending spread over the period.',
  },
  excess: {
    label: 'More lines than paid',
    help: 'The lines add up to more than was paid, and the next statements don’t make up for it. Look for a duplicate line or a payment that isn’t imported. The lines count.',
  },
  'missing-payment': {
    label: 'No payment found',
    help: 'Your bank data covers this time, but no payment for these lines was found, and the next payments don’t cover it. The lines count as spending.',
  },
  'no-lines': {
    label: 'No lines imported',
    help: 'A payment for this period, but no card lines. The payment is spread evenly over the period as estimated spending, until the lines are imported.',
  },
  unpaid: {
    label: 'Payment not imported',
    help: 'The payment for these lines would be after your imported bank data ends. The lines count as spending.',
  },
};
