/**
 * Income / spending / savings classification. Read-only: nothing here changes
 * a transaction; a user's decision is an ordinary saved type correction.
 *
 * - Spending: every expense-type record (purchases, fees, ATM, checks, loan
 *   payments...). Refunds, returns, and discounts are expense types with a
 *   positive amount, so they reduce spending instead of looking like income.
 * - Income: interest, plus deposits (other credit, check or payment received,
 *   credit adjustment) into a bank checking or savings account.
 * - Undecided: other income-type credits, such as statement credits on a card,
 *   PayPal receipts, or reward points. MiM can't tell whether they are earnings
 *   or offsets, so the user decides by setting the type explicitly.
 * - Investment transfers: money the user moved between these accounts and an
 *   investment or other account that isn't imported. Neither income nor
 *   spending; shown on its own, in and out.
 * - Transfers and unmatched order details stay outside all of these.
 * - A bank payment to a card with no matching card record stays spending. When
 *   the card's own purchases for that time are imported it is listed for
 *   review (`cardPaymentsToReview`), since it is then likely counted twice.
 */
import {
  AccountType,
  TransactionReason,
  containsWordStart,
  isInterAccount,
  parseDate,
  transactionReasonCategoryLookup,
  type Transaction,
  type Transactions,
} from '@moneyinmotion/core';

export type CashFlowKind =
  'income' | 'spending' | 'undecided' | 'investment' | 'transfer' | 'unmatched';

/** Type set when the user says "count as income" or "count against spending". */
export const INCOME_DECISION_REASON = TransactionReason.OtherCredit;
export const SPENDING_DECISION_REASON = TransactionReason.Return;
/** Types set when the user says a card payment is a payment, or real spending. */
export const CARD_PAYMENT_DECISION_REASON = TransactionReason.InterAccountPayment;
export const KEEP_SPENDING_DECISION_REASON = TransactionReason.Purchase;
/** Type set when the user says money came from (or went to) their investments. */
export const INVESTMENT_DECISION_REASON = TransactionReason.InvestmentTransfer;

const BANK_DEPOSIT_REASONS = new Set<number>([
  TransactionReason.OtherCredit,
  TransactionReason.CheckRecieved,
  TransactionReason.PaymentRecieved,
  TransactionReason.IncomeAdjustment,
]);

/** True when a saved correction explicitly sets the type (the user's decision). */
export function hasUserSetType(tx: Transaction): boolean {
  const edited = tx.mergedEdit?.transactionReason;
  return edited != null && !edited.isVoided;
}

export function cashFlowKind(tx: Transaction, accountType: AccountType | null): CashFlowKind {
  if (tx.requiresParent && !tx.parentId) return 'unmatched';
  const reason = tx.correctedTransactionReason;
  if (reason & TransactionReason.InvestmentTransfer) return 'investment';
  if (isInterAccount(reason)) return 'transfer';
  const category = transactionReasonCategoryLookup[String(reason)];
  if (category === 'Expense') return 'spending';
  // Income-type records, plus any combined flags the lookup doesn't name.
  if (tx.correctedAmount <= 0) return 'income';
  if (hasUserSetType(tx) || reason === TransactionReason.Interest) return 'income';
  const bank = accountType === AccountType.BankChecking || accountType === AccountType.BankSavings;
  return bank && BANK_DEPOSIT_REASONS.has(reason) ? 'income' : 'undecided';
}

/** Classifier bound to a snapshot, so callers don't repeat account lookups. */
export function cashFlowClassifier(transactions: Transactions): (tx: Transaction) => CashFlowKind {
  const types = new Map<string, AccountType | null>();
  return (tx) => {
    if (!types.has(tx.accountId)) {
      types.set(tx.accountId, transactions.getAccountInfo(tx.accountId)?.type ?? null);
    }
    return cashFlowKind(tx, types.get(tx.accountId)!);
  };
}

export interface CashFlowTotals {
  income: number;
  /** Purchases and fees minus refunds, returns, and discounts. */
  spending: number;
  /** Gross outgoing amounts before refunds. */
  grossSpending: number;
  /** Refunds, returns, and discounts that reduced spending. */
  offsets: number;
  savings: number;
  incomeCount: number;
  spendingCount: number;
  undecidedCount: number;
  undecidedAmount: number;
  /** Money moved in from, and out to, investments: neither income nor spending. */
  fromInvestments: number;
  toInvestments: number;
  investmentCount: number;
}

export function cashFlowTotals(
  rows: readonly Transaction[],
  kindOf: (tx: Transaction) => CashFlowKind,
): CashFlowTotals {
  const totals: CashFlowTotals = {
    income: 0,
    spending: 0,
    grossSpending: 0,
    offsets: 0,
    savings: 0,
    incomeCount: 0,
    spendingCount: 0,
    undecidedCount: 0,
    undecidedAmount: 0,
    fromInvestments: 0,
    toInvestments: 0,
    investmentCount: 0,
  };
  for (const tx of rows) {
    const amount = tx.correctedAmount;
    switch (kindOf(tx)) {
      case 'income':
        totals.income += amount;
        totals.incomeCount++;
        break;
      case 'spending':
        totals.spending -= amount;
        if (amount < 0) totals.grossSpending -= amount;
        else totals.offsets += amount;
        totals.spendingCount++;
        break;
      case 'undecided':
        totals.undecidedAmount += amount;
        totals.undecidedCount++;
        break;
      case 'investment':
        if (amount > 0) totals.fromInvestments += amount;
        else totals.toInvestments -= amount;
        totals.investmentCount++;
        break;
      default:
        break;
    }
  }
  totals.savings = totals.income - totals.spending;
  return totals;
}

// ---------------------------------------------------------------------------
// Card payments that may be counted twice (derived, never persisted)

const DAY_MS = 24 * 60 * 60 * 1000;
/** A card's records in this many days before a payment mean its purchases are imported. */
const CARD_COVERAGE_DAYS = 40;

/**
 * Bank payments to a card that still count as spending although the card's
 * own purchases for that time are imported, so the money is likely counted
 * twice. Returns payment ID → card account ID.
 *
 * A candidate is a checking or savings debit classified as spending, with no
 * type decision by the user, whose imported name contains one of a credit
 * card account's name tags at the start of a word (matched payments are
 * already transfers). It is listed only when that card has records in the
 * 40 days up to the payment. A payment outside the card's records is the only
 * record of those purchases, so it rightly counts as spending and isn't listed.
 */
export function cardPaymentsToReview(
  transactions: Transactions,
  kindOf: (tx: Transaction) => CashFlowKind,
): Map<string, string> {
  const result = new Map<string, string>();
  const accountIds = new Set<string>();
  for (const tx of transactions.topLevelTransactions) accountIds.add(tx.accountId);
  const cards = [...accountIds].flatMap((id) => {
    const info = transactions.getAccountInfo(id);
    const tags = info?.type === AccountType.CreditCard ? (info.interAccountNameTags ?? []) : [];
    return tags.length ? [{ id, tags, times: [] as number[] }] : [];
  });
  if (!cards.length) return result;
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const time = (tx: Transaction) => parseDate(tx.correctedTransactionDate).getTime();
  for (const tx of transactions.topLevelTransactions)
    cardById.get(tx.accountId)?.times.push(time(tx));
  for (const card of cards) card.times.sort((a, b) => a - b);

  for (const tx of transactions.topLevelTransactions) {
    const type = transactions.getAccountInfo(tx.accountId)?.type;
    if (type !== AccountType.BankChecking && type !== AccountType.BankSavings) continue;
    if (tx.correctedAmount >= 0 || tx.relatedTransferId || hasUserSetType(tx)) continue;
    if (kindOf(tx) !== 'spending') continue;
    const card = cards.find((candidate) =>
      candidate.tags.some((tag) => containsWordStart(tx.entityName, tag)),
    );
    if (!card) continue;
    const paidAt = time(tx);
    if (hasTimeBetween(card.times, paidAt - CARD_COVERAGE_DAYS * DAY_MS, paidAt)) {
      result.set(tx.id, card.id);
    }
  }
  return result;
}

/** True when the sorted `times` has a value in [from, to]. */
function hasTimeBetween(times: readonly number[], from: number, to: number): boolean {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (times[middle]! < from) low = middle + 1;
    else high = middle;
  }
  return low < times.length && times[low]! <= to;
}

// ---------------------------------------------------------------------------
// Refund links (derived, never persisted)

/** Refunds older than this are not linked to a charge. */
const REFUND_WINDOW_DAYS = 180;

export interface RefundLinks {
  /** Refund (or return/discount credit) ID → original charge ID. */
  chargeOf: Map<string, string>;
  /** Charge ID → linked refund IDs. */
  refundsOf: Map<string, string[]>;
}

function merchantKey(tx: Transaction): string {
  return tx.displayEntityNameNormalized.trim().toLowerCase();
}

/**
 * Link each spending credit (refund, return, discount) to the charge it most
 * likely reverses: same merchant, on or before the refund date, within 180
 * days, with enough remaining amount. Exact amounts win, then the nearest
 * date, then ID, so results are deterministic. Several partial refunds can
 * link to one charge, but never more than the charge's amount in total.
 * Order details that already sit under a payment are skipped.
 */
export function linkRefunds(
  rows: readonly Transaction[],
  kindOf: (tx: Transaction) => CashFlowKind,
): RefundLinks {
  const charges = new Map<string, Transaction[]>();
  const refunds: Transaction[] = [];
  for (const tx of rows) {
    if (kindOf(tx) !== 'spending' || tx.parentId) continue;
    if (tx.correctedAmount < 0) {
      const list = charges.get(merchantKey(tx)) ?? [];
      list.push(tx);
      charges.set(merchantKey(tx), list);
    } else if (tx.correctedAmount > 0) {
      refunds.push(tx);
    }
  }
  const time = (tx: Transaction) => Date.parse(tx.correctedTransactionDate);
  refunds.sort((a, b) => time(a) - time(b) || a.id.localeCompare(b.id));
  const remaining = new Map<string, number>();
  const links: RefundLinks = { chargeOf: new Map(), refundsOf: new Map() };
  for (const refund of refunds) {
    const refundTime = time(refund);
    const amount = refund.correctedAmount;
    let best: Transaction | null = null;
    let bestScore: [number, number, string] | null = null;
    for (const charge of charges.get(merchantKey(refund)) ?? []) {
      const age = refundTime - time(charge);
      if (age < 0 || age > REFUND_WINDOW_DAYS * DAY_MS) continue;
      const left = remaining.get(charge.id) ?? -charge.correctedAmount;
      if (left + 0.005 < amount) continue;
      const score: [number, number, string] = [
        Math.abs(-charge.correctedAmount - amount) < 0.005 ? 0 : 1,
        age,
        charge.id,
      ];
      if (!bestScore || compareScore(score, bestScore) < 0) {
        best = charge;
        bestScore = score;
      }
    }
    if (!best) continue;
    remaining.set(best.id, (remaining.get(best.id) ?? -best.correctedAmount) - amount);
    links.chargeOf.set(refund.id, best.id);
    links.refundsOf.set(best.id, [...(links.refundsOf.get(best.id) ?? []), refund.id]);
  }
  return links;
}

function compareScore(a: [number, number, string], b: [number, number, string]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]);
}
