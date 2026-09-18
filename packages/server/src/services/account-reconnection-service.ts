/** Resolve preserved account identity from existing snapshot provenance, never folder guesses. */
import type { AccountInfo, Transactions } from '@moneyinmotion/core';

export interface DisconnectedAccountFolder {
  relativeDirectory: string;
  originalAccount: AccountInfo | null;
  identityStatus: 'known' | 'unknown' | 'ambiguous';
}

/** Folder names need only be a safe single path segment, not an account ID. */
export function isSafeAccountFolder(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 255 &&
    value !== '.' &&
    value !== '..' &&
    !/[/\\\0]/.test(value)
  );
}

export function accountIdentitiesByFolder(transactions: Transactions): Map<string, AccountInfo[]> {
  const result = new Map<string, AccountInfo[]>();
  for (const transaction of transactions.allParentChildTransactions) {
    const source = transactions
      .getImportInfo(transaction.importId)
      .portableAddress.replaceAll('\\', '/')
      .replace(/^\.\//, '');
    const parts = source.split('/');
    // Current imports are Statements-relative; some legacy sources retain the prefix.
    if (parts[0]?.toLowerCase() === 'statements') parts.shift();
    const folder = parts[0];
    if (!folder || parts.length < 2 || !isSafeAccountFolder(folder)) continue;
    const key = folder.toLowerCase();
    const accounts = result.get(key) ?? [];
    if (!accounts.some((account) => account.id === transaction.accountId)) {
      accounts.push(transactions.getAccountInfo(transaction.accountId));
    }
    result.set(key, accounts);
  }
  return result;
}

export function disconnectedAccountFolder(
  relativeDirectory: string,
  accounts: AccountInfo[] = [],
): DisconnectedAccountFolder {
  return {
    relativeDirectory,
    originalAccount: accounts.length === 1 ? accounts[0]! : null,
    identityStatus:
      accounts.length === 1 ? 'known' : accounts.length === 0 ? 'unknown' : 'ambiguous',
  };
}
