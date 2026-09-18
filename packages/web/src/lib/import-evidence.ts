/** Derived evidence only: this module never interprets file dates as import events. */
import type { ImportInfo, Transactions } from '@moneyinmotion/core';

export interface SourceInventoryItem {
  source: ImportInfo;
  accountIds: string[];
  recordCount: number;
  from: string | null;
  to: string | null;
}

/** Include every graph record for provenance; these counts are not financial totals. */
export function sourceInventory(transactions: Transactions): SourceInventoryItem[] {
  const items = new Map<string, SourceInventoryItem>();
  for (const transaction of transactions.allParentChildTransactions) {
    let item = items.get(transaction.importId);
    if (!item) {
      item = {
        source: transactions.getImportInfo(transaction.importId),
        accountIds: [],
        recordCount: 0,
        from: null,
        to: null,
      };
      items.set(transaction.importId, item);
    }
    item.recordCount += 1;
    if (!item.accountIds.includes(transaction.accountId))
      item.accountIds.push(transaction.accountId);
    const date = transaction.correctedTransactionDate.slice(0, 10);
    if (item.from == null || date < item.from) item.from = date;
    if (item.to == null || date > item.to) item.to = date;
  }
  return [...items.values()].sort((a, b) =>
    a.source.portableAddress.localeCompare(b.source.portableAddress),
  );
}

export function formatEvidenceDate(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : date
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, ' UTC');
}
