import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AccountType, Transaction, Transactions, TransactionReason } from '@moneyinmotion/core';
import { ReportsPage } from '../../src/pages/ReportsPage.js';

const useTransactionsMock = vi.fn();
vi.mock('../../src/api/hooks.js', () => ({ useTransactions: () => useTransactionsMock() }));
vi.mock('../../src/components/layout/Header.js', () => ({
  Header: () => <header>Navigation</header>,
}));

function fixture() {
  const collection = new Transactions('report');
  for (const [name, amount, date, reason] of [
    ['Market', -100, '2024-03-15', TransactionReason.Purchase],
    ['Discount', 10, '2024-03-15', TransactionReason.DiscountRecieved],
    ['Old transaction', -200, '2023-01-01', TransactionReason.Purchase],
  ] as const) {
    collection.addNew(
      Transaction.create('source', 'bank', false, {
        entityName: name,
        entityNameNormalized: name,
        amount,
        transactionDate: date,
        transactionReason: reason,
        providerCategoryName: 'Shopping',
      }),
      {
        id: 'bank',
        instituteName: 'Generic',
        title: 'Checking',
        type: AccountType.BankChecking,
        requiresParent: false,
      },
      { id: 'source', portableAddress: 'Statements/bank.csv', contentHash: 'path' },
      false,
    );
  }
  return collection.serialize();
}
function renderPage() {
  return render(
    <MemoryRouter>
      <ReportsPage />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  useTransactionsMock.mockReturnValue({
    data: fixture(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe('Reports overview', () => {
  it('opens with the latest available period, meaningful credits and exact drill-down scopes', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByTestId('report-scope')).toHaveTextContent('Mar 1, 2024 – Mar 31, 2024');
    const totals = screen.getByRole('region', { name: 'Activity totals' });
    expect(within(totals).getByText('$100.00')).toBeInTheDocument();
    expect(within(totals).getByText('$10.00')).toBeInTheDocument();
    expect(within(totals).getByText('-$90.00')).toBeInTheDocument();
    const merchant = within(screen.getByRole('region', { name: 'Top merchants' })).getByRole(
      'link',
      { name: /Market/ },
    );
    expect(merchant.getAttribute('href')).toContain('merchant=Market');
    expect(merchant.getAttribute('href')).toContain('flow=debits');
    const flagged = within(screen.getByRole('region', { name: 'Your review queue' })).getByRole(
      'link',
      { name: /Marked for review/ },
    );
    expect(flagged.getAttribute('href')).toContain('basis=records');
    expect(screen.queryByText(/Amounts use the app/)).not.toBeInTheDocument();
    expect(screen.getByText('Exact daily figures (1)')).toBeInTheDocument();
    const dailyChart = screen.getByLabelText('Daily activity chart');
    expect(within(dailyChart).getByRole('link').getAttribute('href')).toContain(
      'from=2024-03-15&to=2024-03-15',
    );
  });

  it('changes scope to all dates, exposes exact monthly figures, and validates reversed dates', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Reporting period'), { target: { value: 'all' } });
    expect(screen.getByTestId('report-scope')).toHaveTextContent('Jan 1, 2023 – Mar 15, 2024');
    expect(screen.getByText('Exact monthly figures (2)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Exact monthly figures (2)'));
    expect(screen.getByRole('table', { name: /Monthly recorded activity/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Reporting period'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2025-01-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('start date is after the end date');
    expect(screen.getByRole('button', { name: 'Export report' })).toBeDisabled();
    expect(screen.queryByRole('region', { name: 'Activity totals' })).not.toBeInTheDocument();
  });

  it('retains report scope after a drill-down and browser Back', () => {
    function TransactionDestination() {
      const navigate = useNavigate();
      return <button onClick={() => navigate(-1)}>Back to report</button>;
    }
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<ReportsPage />} />
          <Route path="/transactions" element={<TransactionDestination />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Reporting period'), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('link', { name: 'Explore transactions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to report' }));
    expect(screen.getByLabelText('Reporting period')).toHaveValue('all');
    expect(screen.getByTestId('report-scope')).toHaveTextContent('Jan 1, 2023 – Mar 15, 2024');
  });

  it('supports keyboard-usable calculation help', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /How these figures are calculated/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('no currency field or conversion rates');
    expect(screen.getByRole('dialog')).toHaveTextContent('not bank balances');
  });

  it('downloads the scoped aggregate CSV and invokes the browser print workflow', () => {
    const createUrl = vi.fn(() => 'blob:report');
    const revokeUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Export report' }));
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();
    click.mockRestore();
    print.mockRestore();
  });

  it('handles empty, loading, and error states without implying statements do not exist', () => {
    useTransactionsMock.mockReturnValue({
      data: new Transactions('empty').serialize(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const view = renderPage();
    expect(screen.getByRole('link', { name: 'Import or rebuild statements' })).toHaveAttribute(
      'href',
      '/imports',
    );
    view.unmount();
    useTransactionsMock.mockReturnValue({ isLoading: true });
    const loading = renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Preparing');
    loading.unmount();
    const refetch = vi.fn();
    useTransactionsMock.mockReturnValue({ error: new Error('Snapshot unavailable'), refetch });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Snapshot unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
