/**
 * Zustand store for client-side transaction state.
 *
 * Manages the loaded transaction collection, year/month filtering,
 * row selection, and group expansion state.
 *
 * @module
 */

import { create } from 'zustand';
import {
  Transactions,
  Transaction,
  type TransactionsData,
} from '@moneyinmotion/core';

/**
 * Shape of the transactions Zustand store.
 */
export interface TransactionsState {
  /** The deserialized transactions collection, or `null` before load. */
  transactions: Transactions | null;
  /** Whether the store is currently loading data. */
  isLoading: boolean;
  /** The most recent error message, or `null`. */
  error: string | null;

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
  selectYearMonth(year: string, month: string): void;
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
  isLoading: false,
  error: null,
  selectedYear: null,
  selectedMonth: null,
  selectedTransactionIds: new Set<string>(),
  expandedGroupIds: new Set<string>(),

  setTransactions(data: TransactionsData) {
    try {
      const txns = Transactions.fromData(data);
      set({ transactions: txns, isLoading: false, error: null });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load transactions',
        isLoading: false,
      });
    }
  },

  selectYearMonth(year: string, month: string) {
    set({
      selectedYear: year,
      selectedMonth: month,
      selectedTransactionIds: new Set<string>(),
    });
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
    const { transactions, selectedYear, selectedMonth } = state;
    if (!transactions) return [];

    const all = [...transactions.topLevelTransactions];

    if (!selectedYear || !selectedMonth) {
      return all;
    }

    return all.filter((tx) => {
      // Transaction dates are stored as UTC ISO-8601 strings, and the
      // YearMonthNav also partitions by UTC. Using UTC methods here keeps
      // the two consistent regardless of the user's local timezone — a
      // transaction stored as 2024-03-01T02:00:00Z must show up under
      // March for every viewer, not February for users east of UTC.
      const date = new Date(tx.correctedTransactionDate);
      const txYear = date.getUTCFullYear().toString();
      const txMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
      return txYear === selectedYear && txMonth === selectedMonth;
    });
  },
}));
