import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Transaction, TransactionReason } from '@moneyinmotion/core';
import { TransactionRow } from '../../src/components/transactions/TransactionRow.js';

function makeTransaction(): Transaction {
  return Transaction.create('import', 'checking', false, {
    amount: -25.99,
    transactionDate: '2024-03-15',
    entityName: 'Example Market',
    transactionReason: TransactionReason.Purchase,
  });
}

describe('transaction grid rows', () => {
  it('renders transaction values as accessible grid cells and supports keyboard selection', () => {
    const transaction = makeTransaction();
    const onClick = vi.fn();
    render(<TransactionRow transaction={transaction} isSelected={false} onClick={onClick} />);

    const row = screen.getByRole('row');
    expect(within(row).getAllByRole('gridcell')).toHaveLength(6);
    expect(within(row).getByText('Example Market')).toBeInTheDocument();

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledWith(transaction.id);
  });
});
