import {
  isIncoming,
  isInterAccount,
  type Transaction,
  type Transactions,
  transactionReasonPluralTitleLookup,
} from '@moneyinmotion/core';

/** Same accounting grain as NetAggregator: completed children replace parents. */
export function reportingTransactions(transactions: Transactions): Transaction[] {
  const result: Transaction[] = [];
  const visit = (tx: Transaction) => {
    const children = Object.keys(tx.children ?? {});
    if (!children.length || tx.hasMissingChild) result.push(tx);
    else for (const id of children) visit(transactions.getTransaction(id)!);
  };
  for (const tx of transactions.topLevelTransactions) visit(tx);
  return result;
}
export function transactionCategory(tx: Transaction): string {
  return tx.categoryPath.join(' / ') || tx.toData().providerCategoryName || 'Uncategorized';
}
export function transactionBucket(tx: Transaction): string {
  if (tx.requiresParent && !tx.parentId) return 'Unmatched';
  if (isIncoming(tx.correctedTransactionReason)) return 'Income';
  if (isInterAccount(tx.correctedTransactionReason)) return 'Transfers';
  return 'Expenses';
}
export interface ExplorerGroup {
  id: string;
  label: string;
  count: number;
  sum: number;
  depth: number;
  children: ExplorerGroup[];
  transactions: Transaction[];
}
export type ExplorerRow = { group: ExplorerGroup } | { transaction: Transaction; depth: number };

export function explorerGroups(transactions: Transaction[]): ExplorerGroup[] {
  const build = (items: Transaction[], depth: number, path: string[]): ExplorerGroup[] => {
    const buckets = new Map<string, Transaction[]>();
    for (const tx of items) {
      const label =
        depth === 0
          ? transactionBucket(tx)
          : depth === 1
            ? (transactionReasonPluralTitleLookup[String(tx.correctedTransactionReason)] ??
              'Other types')
            : depth === 2
              ? transactionCategory(tx)
              : tx.displayEntityNameNormalized;
      const bucket = buckets.get(label) ?? [];
      bucket.push(tx);
      buckets.set(label, bucket);
    }
    return [...buckets]
      .map(([label, rows]) => ({
        id: JSON.stringify([...path, label]),
        label,
        depth,
        count: rows.length,
        sum: rows.reduce((sum, tx) => sum + tx.correctedAmount, 0),
        children: depth < 3 ? build(rows, depth + 1, [...path, label]) : [],
        transactions: depth === 3 ? rows : [],
      }))
      .sort((a, b) =>
        depth === 0
          ? ['Income', 'Expenses', 'Transfers', 'Unmatched'].indexOf(a.label) -
            ['Income', 'Expenses', 'Transfers', 'Unmatched'].indexOf(b.label)
          : Math.abs(b.sum) - Math.abs(a.sum) || a.label.localeCompare(b.label),
      );
  };
  return build(transactions, 0, []);
}
export function flattenExplorer(groups: ExplorerGroup[], expanded: Set<string>): ExplorerRow[] {
  const rows: ExplorerRow[] = [];
  const visit = (group: ExplorerGroup) => {
    // A one-transaction merchant group only repeats the transaction's name.
    if (group.depth === 3 && group.transactions.length === 1) {
      rows.push({ transaction: group.transactions[0]!, depth: group.depth });
      return;
    }
    rows.push({ group });
    if (!expanded.has(group.id)) return;
    group.children.forEach(visit);
    group.transactions.forEach((transaction) => rows.push({ transaction, depth: group.depth + 1 }));
  };
  groups.forEach(visit);
  return rows;
}

/** Quote cells and neutralize spreadsheet formula injection in user/source text. */
export function transactionsCsv(transactions: Transaction[]): string {
  const cell = (value: string | number) =>
    '"' +
    (typeof value === 'string' && /^[=+@\-\t\r]/.test(value)
      ? "'" + value
      : String(value)
    ).replaceAll('"', '""') +
    '"';
  return [
    [
      'Date',
      'Name',
      'Amount',
      'Account',
      'Category',
      'Note',
      'Marked for review',
      'Transaction ID',
    ],
    ...transactions.map((t) => [
      t.correctedTransactionDate.slice(0, 10),
      t.displayEntityNameNormalized,
      t.correctedAmount,
      t.accountId,
      transactionCategory(t),
      t.note ?? '',
      t.isUserFlagged ? 'Yes' : 'No',
      t.id,
    ]),
  ]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
}
