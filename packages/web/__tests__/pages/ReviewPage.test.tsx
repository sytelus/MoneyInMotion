import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountType, Transaction, TransactionReason, Transactions } from '@moneyinmotion/core';
import { ReviewPage } from '../../src/pages/ReviewPage.js';

const useTransactionsMock = vi.fn();
vi.mock('../../src/api/hooks.js', () => ({
  useTransactions: () => useTransactionsMock(),
  useStatementInventory: () => ({ data: { entries: [], truncated: false, unreadableFolders: 0 } }),
}));

function snapshot() {
  const collection = new Transactions('review');
  const add = (account: 'checking' | 'card', amount: number, date: string, name: string) => {
    const tx = Transaction.create('statement', account, false, {
      amount,
      transactionDate: date,
      entityName: name,
      entityNameNormalized: name,
      transactionReason: TransactionReason.Purchase,
    });
    collection.addNew(
      tx,
      {
        id: account,
        instituteName: 'Generic',
        title: account === 'card' ? 'Chase card' : 'Checking',
        type: account === 'card' ? AccountType.CreditCard : AccountType.BankChecking,
        interAccountNameTags: account === 'card' ? ['chase'] : [],
        requiresParent: false,
      },
      { id: 'statement', portableAddress: `${account}/s.csv`, contentHash: 'path-id' },
      false,
    );
  };
  add('card', -100, '2024-02-03', 'Grocery');
  add('card', -50, '2024-02-20', 'Books');
  add('checking', -140, '2024-03-08', 'CHASE EPAY 1');
  add('checking', -300, '2023-06-05', 'CHASE AUTOPAY 2');
  return collection.serialize();
}

describe('Review page', () => {
  it('lists statements that don’t add up, and payments spread as estimates', () => {
    useTransactionsMock.mockReturnValue({ data: snapshot(), isLoading: false, error: null });
    render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>,
    );
    const statements = screen.getByRole('region', { name: 'Card statements' });
    expect(within(statements).getByText('1 statement to look at')).toBeInTheDocument();
    const row = within(statements).getByRole('table', { name: 'Statements to look at' });
    expect(row).toHaveTextContent('More lines than paid');
    expect(row).toHaveTextContent('-$10.00');
    expect(
      within(row).getByRole('link', { name: /View Chase card statement closing/ }),
    ).toHaveAttribute('href', expect.stringContaining('statement=card%3A'));
    expect(statements).toHaveTextContent(
      '$300.00 paid to cards over 1 billing period has no statement lines',
    );
    expect(screen.getByRole('region', { name: 'Records to check' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Rules' })).toBeInTheDocument();
  });
});
