/**
 * Zustand store for client-side transaction state.
 *
 * Manages the loaded transaction collection, year/month filtering,
 * row selection, and group expansion state.
 *
 * @module
 */

import { create } from 'zustand';
import { Transactions, Transaction, type TransactionsData } from '@moneyinmotion/core';
import {
  reportingTransactions,
  transactionCategory,
  transactionBucket,
} from '../lib/transaction-explorer.js';

export interface TransactionFilters {
  search: string;
  account: string;
  reason: string;
  category: string;
  review: string;
  from: string;
  to: string;
  min: string;
  max: string;
}
export const emptyFilters: TransactionFilters = {
  search: '',
  account: '',
  reason: '',
  category: '',
  review: '',
  from: '',
  to: '',
  min: '',
  max: '',
};

/**
 * Shape of the transactions Zustand store.
 */
export interface TransactionsState {
  /** The deserialized transactions collection, or `null` before load. */
  transactions: Transactions | null;
  reporting: Transaction[];
  searchIndex: Map<string, string>;
  filters: TransactionFilters;
  setFilters(filters: Partial<TransactionFilters>): void;
  clearSelection(): void;
  selectTransactions(ids: string[]): void;

  /** Currently selected year filter (e.g. `"2024"`), or `null` for all. */
  selectedYear: string | null;
  /** Currently selected month filter (e.g. `"03"`), or `null` for all. */
  selectedMonth: string | null;

  /** Set of currently selected transaction IDs (for multi-select). */
  selectedTransactionIds: Set<string>;
  /** Set of group IDs whose children are currently expanded/visible. */
  expandedGroupIds: Set<string>;

  /** Replace the transaction data from a server response payload. */
  setTransactions(data: TransactionsData): void;
  /** Set the year/month filter. */
  selectYearMonth(year: string | null, month: string | null): void;
  /** Toggle selection state for a single transaction. */
  toggleTransactionSelection(id: string): void;
  /** Select exactly one transaction, clearing any prior selection. */
  selectTransaction(id: string): void;
  /** Toggle the expanded/collapsed state of a group. */
  toggleGroupExpand(groupId: string): void;
  /** Return transactions filtered by the current year/month selection. */
  getFilteredTransactions(): Transaction[];
}

/**
 * The main transactions store instance.
 *
 * Usage:
 * ```ts
 * const transactions = useTransactionsStore((s) => s.transactions);
 * const setTransactions = useTransactionsStore((s) => s.setTransactions);
 * ```
 */
export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: null,
  reporting: [],
  searchIndex: new Map(),
  filters: { ...emptyFilters },
  selectedYear: null,
  selectedMonth: null,
  selectedTransactionIds: new Set<string>(),
  expandedGroupIds: new Set<string>(),

  setTransactions(data: TransactionsData) {
    const transactions = Transactions.fromData(data);
    const reporting = reportingTransactions(transactions);
    const searchIndex = new Map(
      reporting.map((tx) => [
        tx.id,
        [
          tx.entityName,
          tx.displayEntityNameNormalized,
          tx.note,
          transactionCategory(tx),
          tx.accountId,
          transactions.getAccountInfo(tx.accountId).title,
          tx.id,
          ...Object.values(tx.providerAttributes ?? {}),
        ]
          .join(' ')
          .toLowerCase(),
      ]),
    );
    const latestDate = reporting.reduce(
      (latest, tx) => (tx.correctedTransactionDate > latest ? tx.correctedTransactionDate : latest),
      '',
    );
    const initialPeriod =
      (!get().transactions || get().reporting.length === 0) && latestDate
        ? {
            selectedYear: latestDate.slice(0, 4),
            selectedMonth: latestDate.slice(5, 7),
            filters: { ...emptyFilters },
          }
        : {};
    // Preserve the user's context across ordinary edit refetches while
    // dropping identities that disappeared in a rebuild. Group expansion is
    // recalculated because category/name edits can change the group tree.
    const selectedTransactionIds = new Set(
      [...get().selectedTransactionIds].filter((id) => transactions.getTransaction(id) != null),
    );
    set({
      transactions,
      reporting,
      searchIndex,
      ...initialPeriod,
      selectedTransactionIds,
      expandedGroupIds: new Set<string>(),
    });
  },

  selectYearMonth(year: string | null, month: string | null) {
    set({
      selectedYear: year,
      selectedMonth: month,
      filters: { ...get().filters, from: '', to: '' },
      selectedTransactionIds: new Set<string>(),
      expandedGroupIds: new Set<string>(),
    });
  },

  setFilters(filters) {
    set({
      filters: { ...get().filters, ...filters },
      selectedTransactionIds: new Set(),
      expandedGroupIds: new Set(),
      ...('from' in filters || 'to' in filters ? { selectedYear: null, selectedMonth: null } : {}),
    });
  },
  clearSelection() {
    set({ selectedTransactionIds: new Set() });
  },
  selectTransactions(ids) {
    set({ selectedTransactionIds: new Set(ids) });
  },

  toggleTransactionSelection(id: string) {
    const current = get().selectedTransactionIds;
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ selectedTransactionIds: next });
  },

  selectTransaction(id: string) {
    set({ selectedTransactionIds: new Set([id]) });
  },

  toggleGroupExpand(groupId: string) {
    const current = get().expandedGroupIds;
    const next = new Set(current);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    set({ expandedGroupIds: next });
  },

  getFilteredTransactions(): Transaction[] {
    const state = get();
    const { transactions, selectedYear, selectedMonth, filters, reporting, searchIndex } = state;
    if (!transactions) return [];

    const words = filters.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return reporting.filter((tx) => {
      // Transaction dates are stored as UTC ISO-8601 strings, and the
      // YearMonthNav also partitions by UTC. Using UTC methods here keeps
      // the two consistent regardless of the user's local timezone — a
      // transaction stored as 2024-03-01T02:00:00Z must show up under
      // March for every viewer, not February for users east of UTC.
      const date = new Date(tx.correctedTransactionDate);
      const txYear = date.getUTCFullYear().toString();
      const txMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = tx.correctedTransactionDate.slice(0, 10);
      return (
        (!selectedYear || txYear === selectedYear) &&
        (!selectedMonth || txMonth === selectedMonth) &&
        (!filters.from || day >= filters.from) &&
        (!filters.to || day <= filters.to) &&
        (!filters.account || tx.accountId === filters.account) &&
        (!filters.reason || String(tx.correctedTransactionReason) === filters.reason) &&
        (!filters.category || transactionCategory(tx) === filters.category) &&
        (!filters.review ||
          (filters.review === 'flagged'
            ? tx.isUserFlagged
            : filters.review === 'unmatched'
              ? transactionBucket(tx) === 'Unmatched'
              : !tx.categoryPath.length && !tx.toData().providerCategoryName)) &&
        (filters.min === '' || tx.correctedAmount >= Number(filters.min)) &&
        (filters.max === '' || tx.correctedAmount <= Number(filters.max)) &&
        words.every((word) => searchIndex.get(tx.id)?.includes(word))
      );
    });
  },
}));
