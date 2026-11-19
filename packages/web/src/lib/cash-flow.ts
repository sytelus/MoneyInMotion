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
 * - Card payments follow the card statements (`card-statements.ts`): a bank
 *   payment whose billing period has card lines is a transfer, and the lines
 *   count; one with no card lines for its period is spending itself.
 */
import {
  AccountType,
  TransactionReason,
  isInterAccount,
  transactionReasonCategoryLookup,
  type Transaction,
  type Transactions,
} from '@moneyinmotion/core';
import { cardStatementsOf } from './card-statements.js';

export type CashFlowKind =
  'income' | 'spending' | 'undecided' | 'investment' | 'transfer' | 'unmatched';

/** Type set when the user says "count as income" or "count against spending". */
export const INCOME_DECISION_REASON = TransactionReason.OtherCredit;
export const SPENDING_DECISION_REASON = TransactionReason.Return;
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

/**
 * Classifier bound to a snapshot, so callers don't repeat account lookups.
 * Card payments follow the card statements rather than their type.
 */
export function cashFlowClassifier(transactions: Transactions): (tx: Transaction) => CashFlowKind {
  const types = new Map<string, AccountType | null>();
  const statements = cardStatementsOf(transactions);
  return (tx) => {
    if (statements.standalonePayments.has(tx.id)) return 'spending';
    if (statements.statementPayments.has(tx.id)) return 'transfer';
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
// Refund links (derived, never persisted)

const DAY_MS = 24 * 60 * 60 * 1000;
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
