import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { AccountType, TransactionReason, type TransactionsData } from '@moneyinmotion/core';
import { parseTransactionScope, transactionsHref } from '../../src/lib/transaction-navigation.js';
import { useTransactionsStore } from '../../src/store/transactions-store.js';
import { useTransactionNavigation } from '../../src/hooks/useTransactionNavigation.js';
import { transactionsCsv } from '../../src/lib/transaction-explorer.js';

function fixture(): TransactionsData {
  const record = (id: string, amount: number, date = '2024-03-15T00:00:00Z') => ({
    id,
    amount,
    entityName: id,
    entityNameNormalized: id,
    transactionDate: date,
    transactionReason: amount > 0 ? TransactionReason.Return : TransactionReason.Purchase,
    contentHash: id,
    accountId: 'bank',
    importId: 'file',
    auditInfo: { createdBy: 'test', createDate: '2024-06-01T00:00:00Z' },
  });
  return {
    name: 'navigation',
    topItems: {
      payment: {
        ...record('payment', -10),
        hasMissingChild: false,
        children: { detail: { ...record('detail', -10), parentId: 'payment' } },
        appliedEditIdsDescending: ['rule'],
      },
      refund: record('refund', 5),
      earlier: record('earlier', -20, '2023-01-10T00:00:00Z'),
    },
    accountInfos: {
      bank: {
        id: 'bank',
        title: 'Bank',
        type: AccountType.BankChecking,
        requiresParent: false,
        instituteName: 'Test',
      },
    },
    importInfos: {
      file: {
        id: 'file',
        contentHash: 'not-a-content-checksum',
        format: 'csv',
        portableAddress: '=unsafe-source.csv',
      },
    },
    edits: [],
  };
}

beforeEach(() =>
  useTransactionsStore.setState({
    transactions: null,
    reporting: [],
    records: [],
    selectedTransactionIds: new Set(),
  }),
);

describe('transaction drill-down contract', () => {
  it('round trips special characters and linked identities without comma splitting', () => {
    const scope = {
      account: 'Bank & Card',
      category: 'Home / Food',
      ids: ['a,b', 'x/y'],
      basis: 'records' as const,
      view: 'list' as const,
    };
    const href = transactionsHref(scope);
    expect(href.startsWith('/transactions?')).toBe(true);
    expect(parseTransactionScope(href.split('?')[1]!)).toEqual(scope);
  });
  it('rejects invalid dates/numbers/options and preserves valid inclusive dates', () => {
    expect(
      parseTransactionScope(
        '?from=2024-02-30&to=2024-02-29&min=oops&max=12&basis=bad&flow=debits&review=incomplete',
      ),
    ).toEqual({ to: '2024-02-29', max: '12', flow: 'debits', review: 'incomplete' });
  });
  it('reveals parent records hidden from reports when following a source, rule, or ID', () => {
    const state = useTransactionsStore.getState();
    state.setTransactions(fixture());
    expect(useTransactionsStore.getState().reporting.map((t) => t.id)).not.toContain('payment');
    state.applyScope({ transaction: 'payment' });
    expect(state.getFilteredTransactions().map((t) => t.id)).toEqual(['payment']);
    expect([...useTransactionsStore.getState().selectedTransactionIds]).toEqual(['payment']);
    state.applyScope({ rule: 'rule' });
    expect(state.getFilteredTransactions().map((t) => t.id)).toEqual(['payment']);
    state.applyScope({ source: 'file' });
    expect(state.getFilteredTransactions()).toHaveLength(4);
  });
  it('matches report credit/debit and exact merchant drill-downs', () => {
    const state = useTransactionsStore.getState();
    state.setTransactions(fixture());
    state.applyScope({ from: '2024-03-01', to: '2024-03-31', flow: 'debits', basis: 'reporting' });
    expect(state.getFilteredTransactions().map((t) => t.id)).toEqual(['detail']);
    state.applyScope({ merchant: 'refund', flow: 'credits' });
    expect(state.getFilteredTransactions().map((t) => t.id)).toEqual(['refund']);
  });
  it('uses the same UTC day for offsets, filters, export, and default latest period', () => {
    const data = fixture();
    data.topItems = {
      offset: {
        ...data.topItems['refund']!,
        id: 'offset',
        transactionDate: '2024-03-01T00:30:00+02:00',
      },
    };
    useTransactionsStore.getState().setTransactions(data);
    expect(useTransactionsStore.getState().selectedMonth).toBe('02');
    useTransactionsStore.getState().applyScope({ from: '2024-02-29', to: '2024-02-29' });
    expect(useTransactionsStore.getState().getFilteredTransactions()).toHaveLength(1);
    expect(transactionsCsv(useTransactionsStore.getState().getFilteredTransactions())).toContain(
      '2024-02-29',
    );
  });
  it('preserves unavailable linked identities as an empty result, not unrelated records', () => {
    const state = useTransactionsStore.getState();
    state.setTransactions(fixture());
    state.applyScope({ ids: ['removed'] });
    expect(state.getFilteredTransactions()).toHaveLength(0);
    expect(useTransactionsStore.getState().scopedIds?.has('removed')).toBe(true);
  });
  it('exports honest record grain and original/source fields with formula-safe paths', () => {
    useTransactionsStore.getState().setTransactions(fixture());
    const collection = useTransactionsStore.getState().transactions!;
    const csv = transactionsCsv([collection.getTransaction('payment')!], {
      collection,
      provenance: true,
      basis: 'records',
    });
    expect(csv).toContain('Source records (not additive)');
    expect(csv).toContain('Original amount');
    expect(csv).toContain('"\'=unsafe-source.csv"');
    expect(csv).not.toContain('not-a-content-checksum');
  });
});

function Harness({ data }: { data: TransactionsData }) {
  useTransactionNavigation(data);
  const location = useLocation();
  const navigate = useNavigate();
  const state = useTransactionsStore();
  return (
    <>
      <output aria-label="URL">
        {location.pathname}
        {location.search}
      </output>
      <output aria-label="IDs">
        {state
          .getFilteredTransactions()
          .map((t) => t.id)
          .join(',')}
      </output>
      <Link to={transactionsHref({ transaction: 'earlier' })}>Earlier record</Link>
      <button onClick={() => navigate(-1)}>Back</button>
    </>
  );
}

describe('browser view-state integration', () => {
  it('loads a cross-period link, then follows another link without stale period or selection', async () => {
    render(
      <MemoryRouter initialEntries={[transactionsHref({ transaction: 'payment' })]}>
        <Harness data={fixture()} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('IDs')).toHaveTextContent(/^payment$/);
    fireEvent.click(screen.getByRole('link', { name: 'Earlier record' }));
    expect(screen.getByLabelText('IDs')).toHaveTextContent(/^earlier$/);
    expect([...useTransactionsStore.getState().selectedTransactionIds]).toEqual(['earlier']);
  });
  it('updates filter URLs but does not turn ordinary checkbox selection into a filter', async () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <Harness data={fixture()} />
      </MemoryRouter>,
    );
    act(() => useTransactionsStore.getState().setFilters({ search: 'refund' }));
    await waitFor(() => expect(screen.getByLabelText('URL')).toHaveTextContent('search=refund'));
    const before = screen.getByLabelText('URL').textContent;
    act(() => useTransactionsStore.getState().selectTransaction('refund'));
    expect(screen.getByLabelText('URL').textContent).toBe(before);
    expect(screen.getByLabelText('IDs')).toHaveTextContent(/^refund$/);
    fireEvent.click(screen.getByRole('link', { name: 'Earlier record' }));
    expect(screen.getByLabelText('IDs')).toHaveTextContent(/^earlier$/);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('IDs')).toHaveTextContent(/^refund$/);
  });
});
