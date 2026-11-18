/**
 * Read-only report projections. No financial object is changed by this module.
 *
 * Reports use the same grain as the transaction explorer: complete order
 * details replace their payment; incomplete payments are counted once. The
 * headline measures are income, spending (net of refunds and discounts), and
 * savings; see `cash-flow.ts` for the classification. Recorded credits/debits
 * remain available for the export and account table. None of these are
 * account balances, and source accounts are not necessarily funding accounts.
 */
import {
  type Transaction,
  type Transactions,
  parseDate,
  transactionReasonTitleLookup,
} from '@moneyinmotion/core';
import {
  reportingTransactions,
  transactionBucket,
  transactionCategory,
} from './transaction-explorer.js';
import {
  cardPaymentsToReview,
  cashFlowClassifier,
  cashFlowTotals,
  linkRefunds,
  type CashFlowKind,
  type RefundLinks,
} from './cash-flow.js';

export interface ReportScope {
  from: string;
  to: string;
  account: string;
}
export interface ActivityTotals {
  count: number;
  credits: number;
  debits: number;
  net: number;
}
export interface ReportBreakdown extends ActivityTotals {
  key: string;
  label: string;
  /** Debits minus credits: spending net of refunds and discounts. */
  spending: number;
}
/** One chart period: income, net spending, and their difference. */
export interface CashFlowPeriod {
  key: string;
  count: number;
  income: number;
  spending: number;
  savings: number;
}
export interface TransferPair {
  id: string;
  left: Transaction;
  right: Transaction;
  fromAccount: string;
  toAccount: string;
  amount: number;
  inconsistent: boolean;
  outsidePeriod: boolean;
}

/** Calendar-day reporting is UTC, independent of the browser's local zone. */
export function reportDay(transaction: Transaction): string {
  return parseDate(transaction.correctedTransactionDate).toISOString().slice(0, 10);
}
function matchesReportScope(transaction: Transaction, scope: ReportScope): boolean {
  const day = reportDay(transaction);
  return (
    (!scope.from || day >= scope.from) &&
    (!scope.to || day <= scope.to) &&
    (!scope.account || transaction.accountId === scope.account)
  );
}
export function activityTotals(rows: readonly Transaction[]): ActivityTotals {
  let credits = 0;
  let debits = 0;
  for (const row of rows) {
    credits += Math.max(row.correctedAmount, 0);
    debits -= Math.min(row.correctedAmount, 0);
  }
  return { count: rows.length, credits, debits, net: credits - debits };
}
function groupRows(
  rows: readonly Transaction[],
  key: (transaction: Transaction) => string,
  label: (key: string) => string = (value) => value,
): ReportBreakdown[] {
  const groups = new Map<string, Transaction[]>();
  for (const row of rows) {
    const value = key(row);
    const group = groups.get(value) ?? [];
    group.push(row);
    groups.set(value, group);
  }
  return [...groups].map(([key, rows]) => {
    const totals = activityTotals(rows);
    return { key, label: label(key), ...totals, spending: totals.debits - totals.credits };
  });
}

/** Snapshot-wide derivations, cached per immutable Transactions object. */
const derivedCache = new WeakMap<
  Transactions,
  {
    kindOf: (tx: Transaction) => CashFlowKind;
    refunds: RefundLinks;
    /** Card payments that may be counted twice: payment ID → card account ID. */
    cardPayments: Map<string, string>;
  }
>();
export function cashFlowContext(transactions: Transactions) {
  let derived = derivedCache.get(transactions);
  if (!derived) {
    const kindOf = cashFlowClassifier(transactions);
    derived = {
      kindOf,
      refunds: linkRefunds(reportingTransactions(transactions), kindOf),
      cardPayments: cardPaymentsToReview(transactions, kindOf),
    };
    derivedCache.set(transactions, derived);
  }
  return derived;
}

/**
 * Category used for spending: the user's or statement's category, except that
 * an uncategorized refund inherits the category of the charge it reverses, so
 * a returned jacket reduces "Clothing" rather than "Uncategorized".
 */
export function spendingCategory(
  transactions: Transactions,
  tx: Transaction,
  refunds: RefundLinks = cashFlowContext(transactions).refunds,
) {
  const own = transactionCategory(tx);
  if (own !== 'Uncategorized') return own;
  const chargeId = refunds.chargeOf.get(tx.id);
  const charge = chargeId ? transactions.getTransaction(chargeId) : undefined;
  return charge ? transactionCategory(charge) : own;
}

function cashFlowPeriods(
  rows: readonly Transaction[],
  kindOf: (tx: Transaction) => CashFlowKind,
  key: (tx: Transaction) => string,
): CashFlowPeriod[] {
  const groups = new Map<string, Transaction[]>();
  for (const row of rows) {
    const kind = kindOf(row);
    if (kind !== 'income' && kind !== 'spending') continue;
    const group = groups.get(key(row)) ?? [];
    group.push(row);
    groups.set(key(row), group);
  }
  return [...groups]
    .map(([period, items]) => {
      const totals = cashFlowTotals(items, kindOf);
      return {
        key: period,
        count: items.length,
        income: totals.income,
        spending: totals.spending,
        savings: totals.savings,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
export function reportCoverage(transactions: Transactions) {
  const rows = reportingTransactions(transactions);
  const days = rows.map(reportDay).sort();
  return {
    from: days[0] ?? '',
    to: days.at(-1) ?? '',
    months: [...new Set(days.map((day) => day.slice(0, 7)))].reverse(),
    count: rows.length,
  };
}
export function monthBounds(month: string): { from: string; to: string } {
  const [year, value] = month.split('-').map(Number);
  return {
    from: `${month}-01`,
    to: new Date(Date.UTC(year!, value!, 0)).toISOString().slice(0, 10),
  };
}

/**
 * Only persisted transfer links are shown: never guess a new relationship.
 * A pair is included when either endpoint is in scope, deduplicated once.
 * Counterpart dates and edited-amount discrepancies remain visible.
 */
function transferPairs(transactions: Transactions, scope: ReportScope): TransferPair[] {
  const seen = new Set<string>();
  const pairs: TransferPair[] = [];
  for (const row of transactions.allParentChildTransactions) {
    if (!row.relatedTransferId || !matchesReportScope(row, scope)) continue;
    const other = transactions.getTransaction(row.relatedTransferId);
    if (!other) continue;
    const id = [row.id, other.id].sort().join(':');
    if (seen.has(id)) continue;
    seen.add(id);
    const [left, right] =
      row.correctedAmount <= other.correctedAmount ? [row, other] : [other, row];
    const dateScope = { ...scope, account: '' };
    pairs.push({
      id,
      left,
      right,
      fromAccount: left.accountId,
      toAccount: right.accountId,
      amount: Math.abs(left.correctedAmount),
      inconsistent:
        left.correctedAmount >= 0 ||
        right.correctedAmount <= 0 ||
        Math.abs(left.correctedAmount + right.correctedAmount) >= 0.005 ||
        other.relatedTransferId !== row.id,
      outsidePeriod: !matchesReportScope(left, dateScope) || !matchesReportScope(right, dateScope),
    });
  }
  return pairs.sort(
    (a, b) => reportDay(b.left).localeCompare(reportDay(a.left)) || a.id.localeCompare(b.id),
  );
}

/** Compute each panel from one immutable filtered reporting population. */
export function buildFinancialReport(transactions: Transactions, scope: ReportScope) {
  const rows = reportingTransactions(transactions).filter((row) => matchesReportScope(row, scope));
  const records = [...transactions.allParentChildTransactions].filter((row) =>
    matchesReportScope(row, scope),
  );
  const activity = rows.filter(
    (row) => !['Transfers', 'Unmatched'].includes(transactionBucket(row)),
  );
  const { kindOf, refunds, cardPayments } = cashFlowContext(transactions);
  const spendingRows = rows.filter((row) => kindOf(row) === 'spending');
  const incomeRows = rows.filter((row) => kindOf(row) === 'income');
  const accountTitle = (id: string) => transactions.getAccountInfo(id).title || id;
  const descending = (a: ReportBreakdown, b: ReportBreakdown) =>
    Math.max(b.credits, b.debits) - Math.max(a.credits, a.debits) || a.label.localeCompare(b.label);
  const bySpending = (a: ReportBreakdown, b: ReportBreakdown) =>
    b.spending - a.spending || a.label.localeCompare(b.label);
  return {
    scope,
    rows,
    totals: activityTotals(activity),
    cashFlow: cashFlowTotals(rows, kindOf),
    months: cashFlowPeriods(rows, kindOf, (row) => reportDay(row).slice(0, 7)),
    days: cashFlowPeriods(rows, kindOf, reportDay),
    categories: groupRows(spendingRows, (row) => spendingCategory(transactions, row, refunds))
      .filter((row) => row.spending > 0.004)
      .sort(bySpending),
    merchants: groupRows(spendingRows, (row) => row.displayEntityNameNormalized)
      .filter((row) => row.spending > 0.004)
      .sort(bySpending),
    incomeSources: groupRows(incomeRows, (row) => row.displayEntityNameNormalized).sort(descending),
    creditTypes: groupRows(
      activity.filter((row) => row.correctedAmount > 0),
      (row) => String(row.correctedTransactionReason),
      (key) => transactionReasonTitleLookup[key] ?? 'Other type',
    ).sort(descending),
    accounts: groupRows(activity, (row) => row.accountId, accountTitle).sort(descending),
    excluded: {
      transfers: rows.filter((row) => transactionBucket(row) === 'Transfers').length,
      unmatched: rows.filter((row) => transactionBucket(row) === 'Unmatched').length,
    },
    review: {
      // Inspect the full graph: flags on replaced parent payments still matter.
      flagged: records.filter((row) => row.isUserFlagged).length,
      incomplete: records.filter(
        (row) => row.hasMissingChild && Object.keys(row.children ?? {}).length > 0,
      ).length,
      unmatched: records.filter((row) => transactionBucket(row) === 'Unmatched').length,
      uncategorized: rows.filter((row) => !row.categoryPath.length && !row.providerCategoryName)
        .length,
      undecided: rows.filter((row) => kindOf(row) === 'undecided').length,
      cardpayments: rows.filter((row) => cardPayments.has(row.id)).length,
    },
    transfers: transferPairs(transactions, scope),
  };
}
export type FinancialReport = ReturnType<typeof buildFinancialReport>;

/** Exact report tables with formula-safe labels, not a second transaction export. */
export function financialReportCsv(report: FinancialReport): string {
  const escape = (value: string | number) => {
    const text =
      typeof value === 'number' ? String(value) : /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const { from, to, account } = report.scope;
  const row = (section: string, label: string, totals: ActivityTotals) => [
    section,
    from,
    to,
    account || 'All source accounts',
    label,
    totals.count,
    Number(totals.credits.toFixed(2)),
    Number(totals.debits.toFixed(2)),
    Number(totals.net.toFixed(2)),
  ];
  const cash = report.cashFlow;
  const cashRow = (label: string, count: number, credits: number, debits: number) =>
    row('Cash flow', label, { count, credits, debits, net: credits - debits });
  return [
    [
      'Section',
      'From (UTC)',
      'Through (UTC)',
      'Source account',
      'Item',
      'Reporting items',
      'Credits (USD display)',
      'Debits (USD display)',
      'Net activity (USD display)',
    ],
    cashRow('Income', cash.incomeCount, cash.income, 0),
    cashRow(
      'Spending, net of refunds and discounts',
      cash.spendingCount,
      cash.offsets,
      cash.grossSpending,
    ),
    cashRow(
      'Savings (income minus spending)',
      cash.incomeCount + cash.spendingCount,
      cash.income,
      cash.spending,
    ),
    cashRow(
      'Credits awaiting an income decision (not in the figures above)',
      cash.undecidedCount,
      cash.undecidedAmount,
      0,
    ),
    cashRow(
      'Investment transfers: in from and out to investments (not in the figures above)',
      cash.investmentCount,
      cash.fromInvestments,
      cash.toInvestments,
    ),
    row('Summary', 'Recorded activity; excludes transfers and unmatched items', report.totals),
    ...report.months.map((item) =>
      cashRow(`Month ${item.key}`, item.count, item.income, item.spending),
    ),
    ...report.days.map((item) =>
      cashRow(`Day ${item.key}`, item.count, item.income, item.spending),
    ),
    ...report.categories.map((item) => row('Spending category', item.label, item)),
    ...report.merchants.map((item) => row('Spending merchant', item.label, item)),
    ...report.incomeSources.map((item) => row('Income source', item.label, item)),
    ...report.creditTypes.map((item) => row('Credit type', item.label, item)),
    ...report.accounts.map((item) => row('Source account activity', item.label, item)),
  ]
    .map((values) => values.map(escape).join(','))
    .join('\r\n');
}
