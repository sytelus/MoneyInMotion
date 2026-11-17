/**
 * Zustand store for client-side transaction state.
 *
 * Manages the loaded transaction collection, year/month filtering,
 * row selection, and group expansion state.
 *
 * @module
 */

import { create } from 'zustand';
import { Transactions, Transaction, parseDate, type TransactionsData } from '@moneyinmotion/core';
import {
  reportingTransactions,
  transactionCategory,
  transactionBucket,
} from '../lib/transaction-explorer.js';
import type { TransactionScope } from '../lib/transaction-navigation.js';
import { cashFlowContext, spendingCategory } from '../lib/financial-reports.js';
import type { CashFlowKind } from '../lib/cash-flow.js';

/** Same populations as the Overview cards and chart, so drill-down counts agree. */
function matchesFlow(tx: Transaction, flow: string, kindOf: (tx: Transaction) => CashFlowKind) {
  const kind = kindOf(tx);
  switch (flow) {
    case 'income':
    case 'spending':
    case 'undecided':
      return kind === flow;
    case 'cashflow':
      return kind === 'income' || kind === 'spending';
    default:
      // Recorded credits/debits/activity: everything except transfers and unmatched.
      return (
        !['Transfers', 'Unmatched'].includes(transactionBucket(tx)) &&
        (flow === 'activity' ||
          (flow === 'credits' ? tx.correctedAmount > 0 : tx.correctedAmount < 0))
      );
  }
}

/**
 * The navigation period a date range covers exactly: a whole month or a whole
 * year. The URL stores periods as `from`/`to`, so this restores the selected
 * month in the sidebar after a reload or Back.
 */
export function periodFromRange(
  from: string,
  to: string,
): { year: string; month: string | null } | null {
  const match = /^(\d{4})-(\d{2})-01$/.exec(from);
  if (!match) return null;
  const year = match[1]!;
  const month = match[2]!;
  const lastDay = (m: number) => new Date(Date.UTC(Number(year), m, 0)).toISOString().slice(0, 10);
  if (month === '01' && to === `${year}-12-31`) return { year, month: null };
  if (to === lastDay(Number(month))) return { year, month };
  return null;
}

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
  merchant: string;
  source: string;
  rule: string;
  flow: string;
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
  merchant: '',
  source: '',
  rule: '',
  flow: '',
};

/**
 * Shape of the transactions Zustand store.
 */
export interface TransactionsState {
  /** The deserialized transactions collection, or `null` before load. */
  transactions: Transactions | null;
  reporting: Transaction[];
  records: Transaction[];
  basis: 'reporting' | 'records';
  view: 'summary' | 'list';
  scopedIds: Set<string> | null;
  applyScope(scope: TransactionScope): void;
  searchIndex: Map<string, string>;
  dateIndex: Map<string, string>;
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
 * The last filter result and the state it came from. Selecting a row or
 * expanding a group changes the store without changing the filter inputs, so
 * the list is not re-filtered (which matters with tens of thousands of rows).
 */
let filterCache: { inputs: unknown[]; result: Transaction[] } | null = null;

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
  records: [],
  basis: 'reporting',
  view: 'summary',
  scopedIds: null,
  searchIndex: new Map(),
  dateIndex: new Map(),
  filters: { ...emptyFilters },
  selectedYear: null,
  selectedMonth: null,
  selectedTransactionIds: new Set<string>(),
  expandedGroupIds: new Set<string>(),

  setTransactions(data: TransactionsData) {
    const transactions = Transactions.fromData(data);
    const reporting = reportingTransactions(transactions);
    const records = [...transactions.allParentChildTransactions];
    // Normalize once per snapshot. This also handles date-only values
    // and offset timestamps without doing date parsing on every search keystroke.
    const dateIndex = new Map(
      records.map((tx) => [tx.id, parseDate(tx.correctedTransactionDate).toISOString()]),
    );
    const searchIndex = new Map(
      records.map((tx) => [
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
      (latest, tx) => (dateIndex.get(tx.id)! > latest ? dateIndex.get(tx.id)! : latest),
      '',
    );
    const initialPeriod =
      (!get().transactions || get().reporting.length === 0) && latestDate
        ? {
            selectedYear: latestDate.slice(0, 4),
            selectedMonth: latestDate.slice(5, 7),
            filters: { ...emptyFilters },
            basis: 'reporting' as const,
            view: 'summary' as const,
            scopedIds: null,
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
      records,
      searchIndex,
      dateIndex,
      ...initialPeriod,
      selectedTransactionIds,
      expandedGroupIds: new Set<string>(),
    });
  },

  applyScope(scope) {
    const filters = { ...emptyFilters };
    for (const key of Object.keys(filters) as (keyof TransactionFilters)[]) {
      filters[key] = scope[key] ?? '';
    }
    const period = periodFromRange(filters.from, filters.to);
    if (period) {
      filters.from = '';
      filters.to = '';
    }
    const basis =
      scope.basis ??
      (scope.source || scope.rule || scope.transaction || scope.ids?.length
        ? 'records'
        : 'reporting');
    set({
      filters,
      basis,
      view: basis === 'records' ? 'list' : (scope.view ?? 'list'),
      scopedIds: scope.ids?.length
        ? new Set(scope.ids)
        : scope.transaction
          ? new Set([scope.transaction])
          : null,
      selectedTransactionIds: new Set(scope.transaction ? [scope.transaction] : []),
      selectedYear: period?.year ?? null,
      selectedMonth: period?.month ?? null,
      expandedGroupIds: new Set(),
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
      ...(filters.search?.trim() && filters.search !== get().filters.search
        ? { view: 'list' as const }
        : {}),
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
    const {
      transactions,
      selectedYear,
      selectedMonth,
      filters,
      reporting,
      records,
      basis,
      scopedIds,
      searchIndex,
      dateIndex,
    } = state;
    if (!transactions) return [];
    const inputs = [
      transactions,
      selectedYear,
      selectedMonth,
      filters,
      basis,
      scopedIds,
      reporting,
    ];
    if (filterCache?.inputs.every((value, index) => value === inputs[index])) {
      return filterCache.result;
    }

    const words = filters.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const { kindOf, cardPayments } = cashFlowContext(transactions);
    // Spending drill-downs use the report's category, where an uncategorized
    // refund takes the category of the charge it reverses.
    const categoryOf =
      filters.flow === 'spending'
        ? (tx: Transaction) => spendingCategory(transactions, tx)
        : transactionCategory;
    const result = (basis === 'records' ? records : reporting).filter((tx) => {
      // Transaction dates are stored as UTC ISO-8601 strings, and the
      // YearMonthNav also partitions by UTC. Using UTC methods here keeps
      // the two consistent regardless of the user's local timezone — a
      // transaction stored as 2024-03-01T02:00:00Z must show up under
      // March for every viewer, not February for users east of UTC.
      const date = dateIndex.get(tx.id)!;
      const txYear = date.slice(0, 4);
      const txMonth = date.slice(5, 7);
      const day = date.slice(0, 10);
      return (
        (!scopedIds || scopedIds.has(tx.id)) &&
        (!selectedYear || txYear === selectedYear) &&
        (!selectedMonth || txMonth === selectedMonth) &&
        (!filters.from || day >= filters.from) &&
        (!filters.to || day <= filters.to) &&
        (!filters.account || tx.accountId === filters.account) &&
        (!filters.reason || String(tx.correctedTransactionReason) === filters.reason) &&
        (!filters.category || categoryOf(tx) === filters.category) &&
        (!filters.merchant || tx.displayEntityNameNormalized === filters.merchant) &&
        (!filters.source || tx.importId === filters.source) &&
        (!filters.rule || tx.appliedEditIdsDescending?.includes(filters.rule)) &&
        (!filters.flow || matchesFlow(tx, filters.flow, kindOf)) &&
        (!filters.review ||
          (filters.review === 'flagged'
            ? tx.isUserFlagged
            : filters.review === 'unmatched'
              ? transactionBucket(tx) === 'Unmatched'
              : filters.review === 'incomplete'
                ? tx.hasMissingChild && Object.keys(tx.children ?? {}).length > 0
                : filters.review === 'cardpayments'
                  ? cardPayments.has(tx.id)
                  : !tx.categoryPath.length && !tx.providerCategoryName)) &&
        (filters.min === '' || tx.correctedAmount >= Number(filters.min)) &&
        (filters.max === '' || tx.correctedAmount <= Number(filters.max)) &&
        words.every((word) => searchIndex.get(tx.id)?.includes(word))
      );
    });
    filterCache = { inputs, result };
    return result;
  },
}));
