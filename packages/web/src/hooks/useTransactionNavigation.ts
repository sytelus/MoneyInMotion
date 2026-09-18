import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TransactionsData } from '@moneyinmotion/core';
import { useTransactionsStore, type TransactionsState } from '../store/transactions-store.js';
import {
  parseTransactionScope,
  transactionsHref,
  type TransactionScope,
} from '../lib/transaction-navigation.js';

function scopeFromState(state: TransactionsState): TransactionScope {
  const { selectedYear: year, selectedMonth: month } = state;
  return {
    ...state.filters,
    flow: state.filters.flow as TransactionScope['flow'],
    ...(year
      ? {
          from: `${year}-${month || '01'}-01`,
          to: new Date(Date.UTC(Number(year), month ? Number(month) : 12, 0))
            .toISOString()
            .slice(0, 10),
        }
      : {}),
    basis: state.basis,
    view: state.view,
    ...(state.scopedIds ? { ids: [...state.scopedIds] } : {}),
  };
}

/**
 * Keep drill-downs and browser back/forward meaningful. Search changes replace
 * the current entry after a short debounce; navigation from other pages pushes
 * a new entry. Selection alone is not a filter and never rewrites the URL.
 */
export function useTransactionNavigation(data: TransactionsData | undefined): void {
  const { search } = useLocation();
  const navigate = useNavigate();
  const loaded = useRef<TransactionsData | undefined>(undefined);
  const written = useRef<string | null>(null);
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    if (loaded.current !== data) {
      useTransactionsStore.getState().setTransactions(data);
      loaded.current = data;
    }
    if (applied.current !== search) {
      if (written.current !== search) {
        if (search) useTransactionsStore.getState().applyScope(parseTransactionScope(search));
        else {
          const state = useTransactionsStore.getState();
          const latest = state.reporting.reduce(
            (date, tx) => (state.dateIndex.get(tx.id)! > date ? state.dateIndex.get(tx.id)! : date),
            '',
          );
          useTransactionsStore.getState().applyScope({ view: 'summary' });
          useTransactionsStore
            .getState()
            .selectYearMonth(latest.slice(0, 4) || null, latest.slice(5, 7) || null);
        }
      }
      // A self-authored navigation is skipped exactly once. Keeping it around
      // would incorrectly skip a later browser Back to the same URL.
      written.current = null;
      applied.current = search;
    }
    let previous = transactionsHref(scopeFromState(useTransactionsStore.getState()));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useTransactionsStore.subscribe((state) => {
      const href = transactionsHref(scopeFromState(state));
      if (href === previous) return;
      previous = href;
      clearTimeout(timer);
      timer = setTimeout(() => {
        written.current = href.includes('?') ? href.slice(href.indexOf('?')) : '';
        navigate(href, { replace: true });
      }, 250);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [data, search, navigate]);
}
