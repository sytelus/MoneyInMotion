/**
 * Read-only report projections. No financial object is changed by this module.
 *
 * Reports use the same grain as the transaction explorer: complete order
 * details replace their payment; incomplete payments are counted once. Credits
 * include refunds/discounts. Neither net activity nor account contributions are
 * account balances. Source accounts are not necessarily funding accounts.
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
  return [...groups].map(([key, rows]) => ({ key, label: label(key), ...activityTotals(rows) }));
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
  const outgoing = activity.filter((row) => row.correctedAmount < 0);
  const credits = activity.filter((row) => row.correctedAmount > 0);
  const accountTitle = (id: string) => transactions.getAccountInfo(id).title || id;
  const descending = (a: ReportBreakdown, b: ReportBreakdown) =>
    Math.max(b.credits, b.debits) - Math.max(a.credits, a.debits) || a.label.localeCompare(b.label);
  return {
    scope,
    rows,
    totals: activityTotals(activity),
    months: groupRows(activity, (row) => reportDay(row).slice(0, 7)).sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
    days: groupRows(activity, reportDay).sort((a, b) => a.key.localeCompare(b.key)),
    categories: groupRows(outgoing, transactionCategory).sort(descending),
    merchants: groupRows(outgoing, (row) => row.displayEntityNameNormalized).sort(descending),
    creditTypes: groupRows(
      credits,
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
    row('Summary', 'Recorded activity; excludes transfers and unmatched items', report.totals),
    ...report.months.map((item) => row('Month', item.key, item)),
    ...report.days.map((item) => row('Day', item.key, item)),
    ...report.categories.map((item) => row('Outgoing category', item.label, item)),
    ...report.merchants.map((item) => row('Outgoing merchant', item.label, item)),
    ...report.creditTypes.map((item) => row('Credit type', item.label, item)),
    ...report.accounts.map((item) => row('Source account activity', item.label, item)),
  ]
    .map((values) => values.map(escape).join(','))
    .join('\r\n');
}
