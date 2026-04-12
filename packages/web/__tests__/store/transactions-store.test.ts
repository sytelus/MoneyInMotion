/**
 * Unit tests for the transactions Zustand store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTransactionsStore } from '../../src/store/transactions-store.js';
import type { TransactionsData, TransactionData } from '@moneyinmotion/core';

/**
 * Helper to create a minimal valid TransactionData object.
 */
function makeTxData(overrides: Partial<TransactionData> & { id: string }): TransactionData {
  return {
    transactionReason: 1,
    transactionDate: '2024-03-15T00:00:00Z',
    entityName: 'Test Entity',
    amount: -42.5,
    contentHash: `hash-${overrides.id}`,
    accountId: 'acct-1',
    importId: 'import-1',
    auditInfo: { createDate: '2024-01-01T00:00:00Z', createdBy: 'test' },
    ...overrides,
  };
}

/**
 * Build a minimal TransactionsData payload with the given transactions.
 */
function makeTransactionsData(txs: TransactionData[]): TransactionsData {
  const topItems: Record<string, TransactionData> = {};
  for (const tx of txs) {
    topItems[tx.id] = tx;
  }
  return {
    name: 'test-collection',
    topItems,
    accountInfos: {
      'acct-1': {
        id: 'acct-1',
        instituteName: 'TestBank',
        type: 0, // Checking
        interAccountNameTags: [],
        requiresParent: false,
      } as any,
    },
    importInfos: {
      'import-1': {
        id: 'import-1',
        format: 'csv',
      } as any,
    },
    edits: [],
  };
}

describe('transactions-store', () => {
  beforeEach(() => {
    // Reset the store to its initial state before each test
    useTransactionsStore.setState({
      transactions: null,
      isLoading: false,
      error: null,
      selectedYear: null,
      selectedMonth: null,
      selectedTransactionIds: new Set<string>(),
      expandedGroupIds: new Set<string>(),
    });
  });

  describe('setTransactions', () => {
    it('populates the store with deserialized transaction data', () => {
      const data = makeTransactionsData([
        makeTxData({ id: 'tx-1', entityName: 'Amazon', amount: -25.0 }),
        makeTxData({ id: 'tx-2', entityName: 'Walmart', amount: -15.0 }),
      ]);

      useTransactionsStore.getState().setTransactions(data);

      const state = useTransactionsStore.getState();
      expect(state.transactions).not.toBeNull();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);

      const tx1 = state.transactions!.getTransaction('tx-1');
      expect(tx1).toBeDefined();
      expect(tx1!.entityName).toBe('Amazon');

      const tx2 = state.transactions!.getTransaction('tx-2');
      expect(tx2).toBeDefined();
      expect(tx2!.entityName).toBe('Walmart');
    });

    it('sets error when data is invalid', () => {
      // Pass null to cause fromData to throw
      useTransactionsStore.getState().setTransactions(null as any);

      const state = useTransactionsStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('selectYearMonth', () => {
    it('sets year and month filters and clears selection', () => {
      // Pre-set a selection
      useTransactionsStore.setState({
        selectedTransactionIds: new Set(['tx-1']),
      });

      useTransactionsStore.getState().selectYearMonth('2024', '03');

      const state = useTransactionsStore.getState();
      expect(state.selectedYear).toBe('2024');
      expect(state.selectedMonth).toBe('03');
      expect(state.selectedTransactionIds.size).toBe(0);
    });
  });

  describe('toggleTransactionSelection', () => {
    it('adds a transaction to the selection', () => {
      useTransactionsStore.getState().toggleTransactionSelection('tx-1');

      const state = useTransactionsStore.getState();
      expect(state.selectedTransactionIds.has('tx-1')).toBe(true);
      expect(state.selectedTransactionIds.size).toBe(1);
    });

    it('removes a transaction from the selection when toggled again', () => {
      useTransactionsStore.getState().toggleTransactionSelection('tx-1');
      useTransactionsStore.getState().toggleTransactionSelection('tx-1');

      const state = useTransactionsStore.getState();
      expect(state.selectedTransactionIds.has('tx-1')).toBe(false);
      expect(state.selectedTransactionIds.size).toBe(0);
    });

    it('supports multi-select', () => {
      useTransactionsStore.getState().toggleTransactionSelection('tx-1');
      useTransactionsStore.getState().toggleTransactionSelection('tx-2');

      const state = useTransactionsStore.getState();
      expect(state.selectedTransactionIds.has('tx-1')).toBe(true);
      expect(state.selectedTransactionIds.has('tx-2')).toBe(true);
      expect(state.selectedTransactionIds.size).toBe(2);
    });
  });

  describe('selectTransaction', () => {
    it('selects exactly one transaction, clearing prior selection', () => {
      // Pre-set multi-selection
      useTransactionsStore.setState({
        selectedTransactionIds: new Set(['tx-1', 'tx-2']),
      });

      useTransactionsStore.getState().selectTransaction('tx-3');

      const state = useTransactionsStore.getState();
      expect(state.selectedTransactionIds.size).toBe(1);
      expect(state.selectedTransactionIds.has('tx-3')).toBe(true);
      expect(state.selectedTransactionIds.has('tx-1')).toBe(false);
      expect(state.selectedTransactionIds.has('tx-2')).toBe(false);
    });
  });

  describe('toggleGroupExpand', () => {
    it('expands a group', () => {
      useTransactionsStore.getState().toggleGroupExpand('group-1');

      const state = useTransactionsStore.getState();
      expect(state.expandedGroupIds.has('group-1')).toBe(true);
    });

    it('collapses a group when toggled again', () => {
      useTransactionsStore.getState().toggleGroupExpand('group-1');
      useTransactionsStore.getState().toggleGroupExpand('group-1');

      const state = useTransactionsStore.getState();
      expect(state.expandedGroupIds.has('group-1')).toBe(false);
    });

    it('manages multiple groups independently', () => {
      useTransactionsStore.getState().toggleGroupExpand('group-1');
      useTransactionsStore.getState().toggleGroupExpand('group-2');
      useTransactionsStore.getState().toggleGroupExpand('group-1');

      const state = useTransactionsStore.getState();
      expect(state.expandedGroupIds.has('group-1')).toBe(false);
      expect(state.expandedGroupIds.has('group-2')).toBe(true);
    });
  });

  describe('getFilteredTransactions', () => {
    beforeEach(() => {
      const data = makeTransactionsData([
        makeTxData({ id: 'tx-march', entityName: 'March Purchase', transactionDate: '2024-03-15T00:00:00Z' }),
        makeTxData({ id: 'tx-april', entityName: 'April Purchase', transactionDate: '2024-04-10T00:00:00Z', contentHash: 'hash-april' }),
        makeTxData({ id: 'tx-jan', entityName: 'January Purchase', transactionDate: '2024-01-05T00:00:00Z', contentHash: 'hash-jan' }),
      ]);
      useTransactionsStore.getState().setTransactions(data);
    });

    it('returns all transactions when no year/month filter is set', () => {
      const result = useTransactionsStore.getState().getFilteredTransactions();
      expect(result.length).toBe(3);
    });

    it('returns only transactions matching the selected year and month', () => {
      useTransactionsStore.getState().selectYearMonth('2024', '03');
      const result = useTransactionsStore.getState().getFilteredTransactions();

      expect(result.length).toBe(1);
      expect(result[0]!.id).toBe('tx-march');
    });

    it('partitions by UTC date, not local date, so month edges are stable across timezones', () => {
      // A transaction stamped 2024-03-01T02:00:00Z is clearly in March (UTC),
      // but for a viewer in UTC-5 it would be February 29 22:00 local time.
      // Partitioning by local date would make this row vanish from the
      // "March 2024" view for anyone east of UTC-2. The implementation now
      // uses UTC accessors, so the row must be grouped under March for
      // everyone.
      const data = makeTransactionsData([
        makeTxData({
          id: 'tx-mar-edge',
          entityName: 'Edge',
          transactionDate: '2024-03-01T02:00:00Z',
        }),
      ]);
      useTransactionsStore.getState().setTransactions(data);
      useTransactionsStore.getState().selectYearMonth('2024', '03');

      const result = useTransactionsStore.getState().getFilteredTransactions();
      expect(result.map((r) => r.id)).toEqual(['tx-mar-edge']);
    });

    it('returns empty array when no transactions match the filter', () => {
      useTransactionsStore.getState().selectYearMonth('2025', '06');
      const result = useTransactionsStore.getState().getFilteredTransactions();

      expect(result.length).toBe(0);
    });

    it('returns empty array when transactions are not loaded', () => {
      useTransactionsStore.setState({ transactions: null });
      const result = useTransactionsStore.getState().getFilteredTransactions();

      expect(result.length).toBe(0);
    });
  });
});
