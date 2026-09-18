import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ScopeType, Transaction, TransactionReason, type ScopeFilter } from '@moneyinmotion/core';
import { ScopeFilterEditor } from '../../src/components/editing/ScopeFilterEditor.js';

function createTransaction(amount: number): Transaction {
  return Transaction.create('import-1', 'acct-checking', false, {
    amount,
    transactionDate: '2024-02-01T00:00:00.000Z',
    entityName: 'Coffee Shop',
    transactionReason: TransactionReason.Purchase,
  });
}

function getLastFilters(onChange: ReturnType<typeof vi.fn>): ScopeFilter[] {
  return onChange.mock.calls.at(-1)?.[0] as ScopeFilter[];
}

describe('ScopeFilterEditor', () => {
  it('allows custom words and amounts, and fails closed for invalid conditions', () => {
    const onChange = vi.fn();
    render(<ScopeFilterEditor transaction={createTransaction(-100)} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Transactions matching all words/i));
    fireEvent.change(screen.getByLabelText(/Required words/), {
      target: { value: 'Coffee Market' },
    });
    expect(getLastFilters(onChange)[0]?.parameters).toEqual(['Coffee', 'Market']);
    fireEvent.click(screen.getByLabelText(/Only for amount range/i));
    fireEvent.change(screen.getByLabelText('Minimum magnitude'), { target: { value: '50' } });
    expect(getLastFilters(onChange)[1]?.parameters).toEqual(['50', '110.00', 'true']);
    fireEvent.change(screen.getByLabelText('Maximum magnitude'), { target: { value: '10' } });
    expect(getLastFilters(onChange)).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent('minimum');
    fireEvent.click(screen.getByLabelText('This transaction only'));
    expect(getLastFilters(onChange)).toHaveLength(1);
    expect(getLastFilters(onChange)[0]?.type).toBe(ScopeType.TransactionId);
  });
  it('preserves the negative flag when building amount-range filters for expenses', async () => {
    const onChange = vi.fn();

    render(<ScopeFilterEditor transaction={createTransaction(-100)} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText(/All transactions named/i));
    fireEvent.click(screen.getByLabelText(/Only for amount range/i));

    await waitFor(() => {
      const filters = getLastFilters(onChange);
      expect(filters).toEqual([
        expect.objectContaining({
          type: ScopeType.EntityNameNormalized,
          parameters: ['Coffee Shop'],
        }),
        expect.objectContaining({
          type: ScopeType.AmountRange,
          parameters: ['90.00', '110.00', 'true'],
        }),
      ]);
    });
  });

  it('omits the negative flag for positive amount-range filters', async () => {
    const onChange = vi.fn();

    render(<ScopeFilterEditor transaction={createTransaction(100)} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText(/All transactions named/i));
    fireEvent.click(screen.getByLabelText(/Only for amount range/i));

    await waitFor(() => {
      const filters = getLastFilters(onChange);
      expect(filters).toEqual([
        expect.objectContaining({
          type: ScopeType.EntityNameNormalized,
          parameters: ['Coffee Shop'],
        }),
        expect.objectContaining({
          type: ScopeType.AmountRange,
          parameters: ['90.00', '110.00'],
        }),
      ]);
    });
  });
});
