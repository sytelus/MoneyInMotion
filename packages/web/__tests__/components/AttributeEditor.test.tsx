import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  Transaction,
  TransactionReason,
} from '@moneyinmotion/core';
import { AttributeEditor } from '../../src/components/editing/AttributeEditor.js';

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('../../src/api/hooks.js', () => ({
  useApplyEdits: () => ({
    mutate: mocks.mutate,
    isPending: false,
  }),
}));

vi.mock('../../src/store/transactions-store.js', () => ({
  useTransactionsStore: () => null,
}));

function createTransaction(): Transaction {
  return Transaction.create('import-1', 'checking', false, {
    amount: -12.5,
    transactionDate: '2024-02-01T00:00:00.000Z',
    entityName: 'Coffee Shop',
    transactionReason: TransactionReason.Purchase,
  });
}

describe('AttributeEditor', () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
  });

  it('creates a persisted transaction-date correction', () => {
    render(
      <AttributeEditor
        open={true}
        onOpenChange={vi.fn()}
        transaction={createTransaction()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Change Transaction Date'));
    fireEvent.change(screen.getByLabelText('Corrected transaction date'), {
      target: { value: '2024-03-14' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mocks.mutate).toHaveBeenCalledOnce();
    const edits = mocks.mutate.mock.calls[0]?.[0];
    expect(edits).toEqual([
      expect.objectContaining({
        values: {
          transactionDate: {
            value: '2024-03-14T00:00:00.000Z',
            isVoided: false,
          },
        },
      }),
    ]);
  });
});
