/**
 * The same row exported in two overlapping statement files with different
 * text, such as "SHELL OIL 57443276605" in a bank download and "SHELL OIL
 * 57443276605 SNOQUALMIE WA" in a hand-made file. The core already merges
 * rows whose content is identical; these differ only in text, so they are
 * found here, on load, and one copy is left out of every total. Nothing is
 * stored, and the statement files are never changed.
 *
 * Two rows are one purchase when they are in the same account but in
 * different files, have the same transaction date and amount, and one name
 * starts with the other (ignoring case, spacing, and punctuation). Each row pairs with at
 * most one other, so two real purchases on one day stay two whenever both
 * files list both. The counted copy is the one with a real post date (one
 * that differs from its transaction date), else the one with details below
 * it, else the earlier-imported one.
 */
import type { Transaction, Transactions } from '@moneyinmotion/core';

export interface DuplicateRows {
  /** Left-out copy ID → the counted copy's ID. */
  duplicateOf: Map<string, string>;
}

const nameKey = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
const cents = (amount: number) => Math.round(amount * 100);
const hasPostDate = (tx: Transaction) =>
  !!tx.postedDate && tx.postedDate.slice(0, 10) !== tx.transactionDate.slice(0, 10);
const hasChildren = (tx: Transaction) => Object.keys(tx.children ?? {}).length > 0;

function sameName(a: string, b: string) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

/** Which copy to count: real post date, then details, then the earlier import. */
function preferred(a: Transaction, b: Transaction): [keep: Transaction, drop: Transaction] {
  if (hasPostDate(a) !== hasPostDate(b)) return hasPostDate(a) ? [a, b] : [b, a];
  if (hasChildren(a) !== hasChildren(b)) return hasChildren(a) ? [a, b] : [b, a];
  return a.importId <= b.importId ? [a, b] : [b, a];
}

export function findDuplicateRows(transactions: Transactions): DuplicateRows {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions.topLevelTransactions) {
    const key = `${tx.accountId}\u0001${tx.transactionDate.slice(0, 10)}\u0001${cents(tx.amount)}`;
    const group = groups.get(key);
    if (group) group.push(tx);
    else groups.set(key, [tx]);
  }
  const duplicateOf = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.importId.localeCompare(b.importId) || a.id.localeCompare(b.id));
    const paired = new Set<string>();
    for (let i = 0; i < group.length; i++) {
      const a = group[i]!;
      if (paired.has(a.id)) continue;
      for (let j = i + 1; j < group.length; j++) {
        const b = group[j]!;
        if (paired.has(b.id) || a.importId === b.importId) continue;
        if (!sameName(nameKey(a.entityName), nameKey(b.entityName))) continue;
        // Both copies carry order details: they aren't simply the same row.
        if (hasChildren(a) && hasChildren(b)) continue;
        const [keep, drop] = preferred(a, b);
        duplicateOf.set(drop.id, keep.id);
        paired.add(a.id);
        paired.add(b.id);
        break;
      }
    }
  }
  return { duplicateOf };
}

const cache = new WeakMap<Transactions, DuplicateRows>();

/** Duplicate rows of a snapshot; computed once per Transactions object. */
export function duplicateRowsOf(transactions: Transactions): DuplicateRows {
  let result = cache.get(transactions);
  if (!result) {
    result = findDuplicateRows(transactions);
    cache.set(transactions, result);
  }
  return result;
}

/** Reuse duplicate rows found on another load of the same snapshot. */
export function rememberDuplicateRows(transactions: Transactions, rows: DuplicateRows): void {
  cache.set(transactions, rows);
}
