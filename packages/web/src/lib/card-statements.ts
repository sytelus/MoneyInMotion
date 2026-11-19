/**
 * Card statements: the level between a bank payment to a card and the card's
 * own line items. Derived on load, never persisted.
 *
 * Money that leaves a bank account to pay a card is the spending; the card's
 * line items for the billing period it paid are its details, and order
 * details (Amazon, Etsy) sit under those. Any level may be missing:
 *
 * - A payment whose period has no card lines counts as spending itself.
 * - When lines exist they count instead of the payment. If they don't add up
 *   to what was paid, an "Unexplained difference" record makes up the gap, so
 *   totals still equal what was paid, and the statement is flagged.
 * - Lines with no payment in the imported data count on their own.
 *
 * Statement periods are rebuilt from the data: each card has a closing day,
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

const DAY_MS = 24 * 60 * 60 * 1000;
const SLACK_DAYS = 5;
const PAY_WINDOW_DAYS = 50;
/** An unlinked bank payment and card payment of the same amount this close are one payment. */
const PAIR_DAYS = 7;

/** Import ID of the derived "Unexplained difference" records. */
export const DERIVED_IMPORT_ID = 'mim-statement-check';

export type CardStatementStatus =
  /** Lines add up to the payment. */
  | 'reconciled'
  /** Lines don't add up to the payment; a difference record makes up the gap. */
  | 'difference'
  /** A payment, but no lines imported for its period: the payment counts. */
  | 'no-lines'
  /** Lines between paid periods, but no payment found for them. */
  | 'missing-payment'
  /** Lines with no payment in the imported data (usually at the end of the data). */
  | 'unpaid';

export interface CardStatement {
  /** `<card account ID>:<closing date>` */
  id: string;
  accountId: string;
  /** Closing date of the period, YYYY-MM-DD. */
  closing: string;
  /** Card line items (top-level card records, not payments), oldest first. */
  itemIds: string[];
  /** Bank payments, or card-side payment records when the bank side isn't imported. */
  paymentIds: string[];
  /** Card-side payment records ("Payment, thank you"). */
  cardPaymentIds: string[];
  /** Owed for the period: charges minus credits, in dollars. */
  charges: number;
  paid: number;
  /** Paid minus charges; zero when the statement adds up. */
  difference: number;
  /** Amount of the derived difference record as spending (positive = more spent). */
  unexplained: number;
  status: CardStatementStatus;
  /** The derived "Unexplained difference" record, when there is one. */
  differenceId: string | null;
}

export interface CardStatementIndex {
  statements: CardStatement[];
  byId: Map<string, CardStatement>;
  /** Any record that belongs to a statement (line, payment, difference) → statement ID. */
  statementOf: Map<string, string>;
  /** Bank payments to a card with no card lines for their period: they count as spending. */
  standalonePayments: Set<string>;
  /** Bank and card payment records that pay a statement with lines: transfers. */
  statementPayments: Set<string>;
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

/** True for the derived "Unexplained difference" records, which can't be edited. */
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
  // Other payments pay the latest period that closed shortly before them.
  for (const unit of units) {
    if (used.has(unit.id)) continue;
    const period = [...periods]
      .reverse()
      .find(
        (candidate) =>
          !candidate.exact &&
          candidate.closing < unit.day &&
          unit.day <= candidate.closing + PAY_WINDOW_DAYS,
      );
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
    standalonePayments: new Set(),
    statementPayments: new Set(),
  };
  const cardIds = new Set<string>();
  const lines = new Map<string, Transaction[]>();
  for (const tx of transactions.topLevelTransactions) {
    if (transactions.getAccountInfo(tx.accountId).type !== AccountType.CreditCard) continue;
    cardIds.add(tx.accountId);
    if (isDerived(tx) || isCardPaymentRecord(tx)) continue;
    lines.set(tx.accountId, [...(lines.get(tx.accountId) ?? []), tx]);
  }
  const unitsByCard = paymentUnits(transactions, cardIds);
  for (const cardId of [...cardIds].sort()) {
    const units = unitsByCard.get(cardId) ?? [];
    const items = (lines.get(cardId) ?? [])
      .map((tx) => ({ tx, day: statementDay(tx), cents: -cents(tx.correctedAmount) }))
      .sort((a, b) => a.day - b.day || a.tx.id.localeCompare(b.tx.id));
    let periods: Period[] = [];
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
        }
      }
    }
    const placed = new Set(periods.flatMap((period) => period.units.map((unit) => unit.id)));
    for (const unit of units) {
      if (placed.has(unit.id)) continue;
      // No card lines anywhere near this payment: the payment is the spending.
      if (unit.bank) index.standalonePayments.add(unit.bank.id);
      else if (unit.card) index.statementPayments.add(unit.card.id);
    }
    const paidPeriods = periods
      .map((period, position) => ({ period, position }))
      .filter(({ period }) => period.units.length && period.end > period.start)
      .map(({ position }) => position);
    periods.forEach((period, position) => {
      const itemIds = items.slice(period.start, period.end).map((item) => item.tx.id);
      if (!itemIds.length && !period.units.length) return;
      const closing = isoDay(period.closing);
      const id = `${cardId}:${closing}`;
      const charges = items
        .slice(period.start, period.end)
        .reduce((sum, item) => sum + item.cents, 0);
      const paid = period.units.reduce((sum, unit) => sum + unit.cents, 0);
      let status: CardStatementStatus;
      let differenceCents = 0;
      if (!itemIds.length) {
        status = 'no-lines';
        for (const unit of period.units) {
          if (unit.bank) index.standalonePayments.add(unit.bank.id);
          else differenceCents += unit.cents;
        }
      } else if (!period.units.length) {
        status =
          paidPeriods.some((other) => other < position) &&
          paidPeriods.some((other) => other > position)
            ? 'missing-payment'
            : 'unpaid';
      } else {
        differenceCents = paid - charges;
        status = differenceCents === 0 ? 'reconciled' : 'difference';
      }
      if (itemIds.length)
        for (const unit of period.units) {
          if (unit.bank) index.statementPayments.add(unit.bank.id);
          if (unit.card) index.statementPayments.add(unit.card.id);
        }
      else
        for (const unit of period.units)
          if (unit.card && !unit.bank) index.statementPayments.add(unit.card.id);
      const statement: CardStatement = {
        id,
        accountId: cardId,
        closing,
        itemIds,
        paymentIds: period.units.map((unit) => unit.id),
        cardPaymentIds: period.units.flatMap((unit) => (unit.card ? [unit.card.id] : [])),
        charges: charges / 100,
        paid: paid / 100,
        difference: (paid - charges) / 100,
        unexplained: differenceCents / 100,
        status,
        differenceId: differenceCents ? differenceRecordId(id) : null,
      };
      index.statements.push(statement);
      index.byId.set(id, statement);
      for (const recordId of [
        ...itemIds,
        ...statement.paymentIds,
        ...statement.cardPaymentIds,
        ...(statement.differenceId ? [statement.differenceId] : []),
      ])
        index.statementOf.set(recordId, id);
    });
  }
  return index;
}

const differenceRecordId = (statementId: string) => `statement-difference:${statementId}`;

/** The derived "Unexplained difference" records for statements that don't add up. */
function differenceRecords(
  transactions: Transactions,
  index: CardStatementIndex,
): TransactionData[] {
  return index.statements.flatMap((statement) => {
    if (!statement.differenceId) return [];
    const amount = -statement.unexplained;
    const title = transactions.getAccountInfo(statement.accountId).title || statement.accountId;
    return [
      {
        id: statement.differenceId,
        transactionReason:
          amount < 0
            ? TransactionReason.MatchAdjustmentDebit
            : TransactionReason.MatchAdjustmentCredit,
        transactionDate: `${statement.closing}T00:00:00.000Z`,
        entityName: `Unexplained difference: ${title} statement closing ${statement.closing}`,
        entityNameNormalized: 'Unexplained card statement difference',
        providerCategoryName: 'Unexplained difference',
        amount,
        contentHash: statement.differenceId,
        accountId: statement.accountId,
        importId: DERIVED_IMPORT_ID,
        auditInfo: { createDate: `${statement.closing}T00:00:00.000Z`, createdBy: 'MoneyInMotion' },
      } satisfies TransactionData,
    ];
  });
}

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
 * Load a snapshot for the app: the imported records plus a derived
 * "Unexplained difference" record for each card statement that doesn't add
 * up. Use this instead of `Transactions.fromData` wherever totals are shown.
 */
export function loadTransactions(data: TransactionsData): Transactions {
  const base = Transactions.fromData(data);
  const index = buildCardStatements(base);
  const extra = differenceRecords(base, index);
  if (!extra.length) {
    indexCache.set(base, index);
    return base;
  }
  const full = Transactions.fromData({
    ...data,
    topItems: { ...data.topItems, ...Object.fromEntries(extra.map((tx) => [tx.id, tx])) },
    importInfos: {
      ...data.importInfos,
      [DERIVED_IMPORT_ID]: {
        id: DERIVED_IMPORT_ID,
        portableAddress: 'Card statement check (derived)',
        contentHash: DERIVED_IMPORT_ID,
        format: 'derived',
      },
    },
  });
  indexCache.set(full, index);
  return full;
}

/** What a statement's status means for the totals, in a sentence. */
export const statementStatusText: Record<CardStatementStatus, { label: string; help: string }> = {
  reconciled: {
    label: 'Adds up',
    help: 'The lines add up to the payment. The lines count as spending; the payment is a transfer.',
  },
  difference: {
    label: 'Doesn’t add up',
    help: 'The lines don’t add up to the payment. The lines count, and an “Unexplained difference” makes up the gap, so the total equals what was paid.',
  },
  'no-lines': {
    label: 'No lines imported',
    help: 'No card lines were imported for the period this paid, so the payment itself counts as spending.',
  },
  'missing-payment': {
    label: 'No payment found',
    help: 'Payments were found for the periods before and after, but not for this one. The lines count as spending.',
  },
  unpaid: {
    label: 'Not paid yet',
    help: 'No payment for these lines is in the imported data. The lines count as spending.',
  },
};
