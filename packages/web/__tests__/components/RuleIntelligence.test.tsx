import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AccountType,
  ScopeType,
  Transaction,
  TransactionEdits,
  TransactionReason,
  Transactions,
  createScopeFilter,
  editValue,
  voidedEditValue,
  type TransactionEditData,
} from '@moneyinmotion/core';
import {
  summarizeRuleEffects,
  transactionRuleEffects,
  ruleKind,
} from '../../src/lib/rule-effects.js';
import {
  provenanceTimestamp,
  transactionProvenance,
} from '../../src/lib/transaction-provenance.js';
import { TransactionProvenance } from '../../src/components/transactions/TransactionProvenance.js';
import { RuleTargetPicker } from '../../src/components/editing/RuleTargetPicker.js';
import { TransactionEditWorkflow } from '../../src/components/editing/TransactionEditWorkflow.js';
import { RuleInspectionDialog } from '../../src/components/editing/RuleInspectionDialog.js';
import { RuleChangePreview } from '../../src/components/editing/RuleChangePreview.js';
import { TransactionSummary } from '../../src/components/transactions/TransactionSummary.js';
import { useTransactionsStore } from '../../src/store/transactions-store.js';
import { transactionsHref } from '../../src/lib/transaction-navigation.js';

const manageRulesMock = vi.fn();
vi.mock('../../src/api/client.js', () => ({
  manageRules: (...args: unknown[]) => manageRulesMock(...args),
  getAccounts: async () => [],
}));

function fixture() {
  const transactions = new Transactions('provenance-test');
  const tx = Transaction.create('source', 'checking', false, {
    amount: -25,
    entityName: 'Bookshop',
    entityNameNormalized: 'Bookshop',
    transactionDate: '2024-02-01',
    postedDate: '2024-02-03',
    transactionReason: TransactionReason.Purchase,
    lineNumber: 12,
    instituteReference: 'ref-123',
  });
  transactions.addNew(
    tx,
    {
      id: 'checking',
      title: 'Daily checking',
      instituteName: 'Generic',
      type: AccountType.BankChecking,
      requiresParent: false,
      interAccountNameTags: [],
    },
    {
      id: 'source',
      portableAddress: 'Statements/Checking/2024.csv',
      contentHash: 'path-identity',
      format: 'csv',
      createDate: '2024-06-01T12:00:00Z',
      updateDate: '2024-06-02T12:00:00Z',
    },
    false,
  );
  const rule = (id: string, values: TransactionEditData['values']): TransactionEditData => ({
    id,
    scopeFilters: [createScopeFilter(ScopeType.TransactionId, [tx.id])],
    values,
    sourceId: 'rules-ui',
    auditInfo: { createDate: '2024-06-03T12:00:00Z', createdBy: 'rules-ui' },
  });
  const rules = [
    rule('earlier', { categoryPath: editValue(['Shopping']), note: editValue('Keep this note') }),
    rule('later', { categoryPath: voidedEditValue() }),
  ];
  const edits = new TransactionEdits();
  rules.forEach((item) => edits.add(item));
  transactions.applyEdits(edits, true);
  return { transactions, tx: transactions.getTransaction(tx.id)!, rules };
}

function wrap(element: React.ReactNode) {
  return (
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        {element}
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  manageRulesMock.mockResolvedValue({
    revision: 'revision',
    affectedTransactionsCount: 1,
    totalRules: 3,
    missingTargets: 0,
    samples: [],
  });
});

describe('Saved rule explanations', () => {
  it('explains partial overrides and a restore-imported writer without mutating data', () => {
    const { transactions, tx, rules } = fixture();
    const before = JSON.stringify(transactions.serialize());
    const effects = transactionRuleEffects(tx, rules);
    expect(effects[0]).toMatchObject({ id: 'later', effective: ['categoryPath'], overridden: [] });
    expect(effects[1]).toMatchObject({
      id: 'earlier',
      effective: ['note'],
      overridden: ['categoryPath'],
    });
    const summaries = summarizeRuleEffects(transactions);
    expect(summaries.get('earlier')).toMatchObject({ effectiveRecords: 1, overriddenRecords: 1 });
    expect(summaries.get('later')?.accountIds.has('checking')).toBe(true);
    expect(JSON.stringify(transactions.serialize())).toBe(before);
  });
  it('keeps missing history visible and classifies only existing scope semantics', () => {
    const { tx, rules } = fixture();
    const data = tx.toData();
    data.appliedEditIdsDescending = ['unknown', 'later', 'earlier'];
    expect(transactionRuleEffects(Transaction.fromData(data), rules)[0]?.rule).toBeUndefined();
    expect(ruleKind(rules[0]!)).toBe('correction');
    expect(
      ruleKind({
        ...rules[0]!,
        scopeFilters: [createScopeFilter(ScopeType.AccountId, ['checking'])],
      }),
    ).toBe('automation');
    expect(ruleKind({ ...rules[0]!, scopeFilters: [createScopeFilter(ScopeType.None, [])] })).toBe(
      'inactive',
    );
  });
  it('opens a read-only effect inspector with record links and no mutation call', () => {
    const { transactions, rules } = fixture();
    render(
      wrap(
        <RuleInspectionDialog
          rule={rules[0]!}
          transactions={transactions}
          summary={summarizeRuleEffects(transactions).get('earlier')!}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onDuplicate={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText('Controls: Note')).toBeInTheDocument();
    expect(screen.getByText('Overridden: Category')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bookshop' })).toHaveAttribute(
      'href',
      expect.stringContaining('basis=records'),
    );
    expect(manageRulesMock).not.toHaveBeenCalled();
  });
});

describe('Truthful transaction provenance', () => {
  it('exposes source evidence, not fictional import times or checksum guarantees', () => {
    const { transactions, tx } = fixture();
    const metadata = transactionProvenance(tx, transactions);
    expect(metadata.source.portableAddress).toBe('Statements/Checking/2024.csv');
    expect(metadata.sourceRow).toBe(12);
    expect(provenanceTimestamp(undefined)).toBe('Not recorded');
    expect(provenanceTimestamp('invalid')).toBe('Not recorded');
    expect(provenanceTimestamp('2024-06-01T12:00:00Z')).toBe('2024-06-01 12:00:00 UTC');
    render(wrap(<TransactionProvenance transaction={tx} transactions={transactions} />));
    expect(screen.getByText('First import time: not recorded reliably')).toBeInTheDocument();
    expect(screen.getByText('File creation time')).toBeInTheDocument();
    expect(
      screen.getByText(/Neither proves when a statement was first imported/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore this statement/ })).toHaveAttribute(
      'href',
      expect.stringContaining('source=source'),
    );
    expect(screen.getByRole('link', { name: /Rule 2/ })).toHaveAttribute(
      'href',
      '/rules?rule=later',
    );
    expect(screen.queryByText(/checksum/i)).not.toBeInTheDocument();
  });
});

describe('Human-readable editing workflow', () => {
  it('retains an explicit restore-imported intent instead of defaulting to mark-for-review', () => {
    const { transactions, tx } = fixture();
    useTransactionsStore.getState().setTransactions(transactions.serialize());
    render(
      wrap(
        <TransactionEditWorkflow
          open
          transactions={[tx]}
          initialField="isFlagged"
          initialValues={{ isFlagged: voidedEditValue() }}
          onOpenChange={vi.fn()}
        />,
      ),
    );
    expect(screen.getByLabelText('Mark for review')).toHaveValue('reset');
  });
  it('collapses large selected-target lists until the user asks to review them', () => {
    const { transactions } = fixture();
    render(
      <RuleTargetPicker
        transactions={transactions}
        ids={['one', 'two', 'three', 'four', 'five', 'six']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Unavailable record · one')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review selected targets' }));
    expect(screen.getByText('Unavailable record · one')).toBeInTheDocument();
  });
  it('selects named targets and retains unavailable references until explicitly removed', () => {
    const { transactions, tx } = fixture();
    const onChange = vi.fn();
    render(
      <RuleTargetPicker transactions={transactions} ids={['unavailable']} onChange={onChange} />,
    );
    expect(screen.getByText('Unavailable record · unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Find or change target records' }));
    fireEvent.change(screen.getByLabelText('Find transaction targets'), {
      target: { value: 'Bookshop' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith(['unavailable', tx.id]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove target unavailable' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
  it('preserves the transaction draft when going back from server preview', async () => {
    const { transactions, tx } = fixture();
    useTransactionsStore.getState().setTransactions(transactions.serialize());
    const onOpenChange = vi.fn();
    render(
      wrap(
        <TransactionEditWorkflow
          open
          transactions={[tx]}
          initialField="note"
          onOpenChange={onOpenChange}
        />,
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Edit transaction' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Note value'), {
      target: { value: 'A carefully written correction' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    expect(await screen.findByText('1 transaction will change')).toBeInTheDocument();
    expect(manageRulesMock).toHaveBeenCalledTimes(1);
    expect(manageRulesMock.mock.calls[0]?.[1]).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Back to editing' }));
    expect(screen.getByLabelText('Note value')).toHaveValue('A carefully written correction');
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    await screen.findByText('1 transaction will change');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(manageRulesMock.mock.calls.at(-1)?.slice(1)).toEqual([false, 'revision']);
  });
  it('disambiguates preview samples by date, account, amount, and expandable identity', async () => {
    const { transactions, tx, rules } = fixture();
    manageRulesMock.mockResolvedValue({
      revision: 'revision',
      affectedTransactionsCount: 1,
      totalRules: 3,
      missingTargets: 0,
      samples: [
        {
          id: tx.id,
          before: {
            name: 'Bookshop',
            date: tx.correctedTransactionDate,
            amount: -25,
            note: 'Before',
          },
          after: {
            name: 'Bookshop',
            date: tx.correctedTransactionDate,
            amount: -25,
            note: 'After',
          },
        },
      ],
    });
    render(
      wrap(
        <RuleChangePreview
          transactions={transactions}
          changes={[{ previous: null, next: rules[0]! }]}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      ),
    );
    await screen.findByText('1 transaction will change');
    expect(screen.getByText(/Daily checking · -\$25.00/)).toBeInTheDocument();
    expect(screen.getByText('Record identity')).toBeInTheDocument();
    expect(screen.getByText(tx.id)).toBeInTheDocument();
  });
  it('never sums source records in selection or no-selection summaries', () => {
    const { transactions, tx } = fixture();
    const second = Transaction.create('source', 'checking', false, {
      amount: -40,
      entityName: 'Other store',
      transactionDate: '2024-02-02',
      transactionReason: TransactionReason.Purchase,
    });
    transactions.addNew(
      second,
      transactions.getAccountInfo('checking'),
      transactions.getImportInfo('source'),
      false,
    );
    useTransactionsStore.getState().setTransactions(transactions.serialize());
    useTransactionsStore.getState().applyScope({ basis: 'records', ids: [tx.id, second.id] });
    useTransactionsStore.getState().selectTransactions([tx.id, second.id]);
    const view = render(wrap(<TransactionSummary />));
    expect(screen.getByText(/This selection is not summed/)).toBeInTheDocument();
    expect(screen.queryByText('Selection amount')).not.toBeInTheDocument();
    view.unmount();
    useTransactionsStore.getState().clearSelection();
    render(wrap(<TransactionSummary />));
    expect(screen.getByText('Source-record inspection')).toBeInTheDocument();
    expect(screen.queryByText('Net Income')).not.toBeInTheDocument();
  });
  it('opens related records in inspection mode and rejects mixed-grain selection totals defensively', () => {
    const { transactions, tx } = fixture();
    const child = Transaction.create('source', 'checking', false, {
      amount: -25,
      entityName: 'Book detail',
      entityNameNormalized: 'Book detail',
      transactionDate: '2024-02-01',
      transactionReason: TransactionReason.Purchase,
    });
    tx.addChild(child);
    tx.completeParent();
    const data = transactions.serialize();
    data.topItems = { [tx.id]: tx.toData() };
    data.topItems[tx.id]!.children![child.id]!.combinedFromId = 'historical-record';
    useTransactionsStore.getState().setTransactions(data);
    useTransactionsStore.getState().applyScope({ basis: 'reporting', view: 'list' });
    useTransactionsStore.getState().selectTransaction(child.id);
    expect(useTransactionsStore.getState().reporting.map((item) => item.id)).toEqual([child.id]);
    render(wrap(<TransactionSummary />));
    fireEvent.click(screen.getByText('Related payment / order details (2)'));
    expect(screen.getByRole('link', { name: /^Bookshop ·/ })).toHaveAttribute(
      'href',
      transactionsHref({ transaction: tx.id, basis: 'records', view: 'list' }),
    );
    expect(screen.getByText('Related record unavailable')).toBeInTheDocument();
    expect(screen.getByText('Reference: historical-record')).toBeInTheDocument();
    act(() => useTransactionsStore.getState().selectTransactions([tx.id, child.id]));
    expect(screen.getByText(/A selected record is outside the reporting view/)).toBeInTheDocument();
    expect(screen.queryByText('Selection amount')).not.toBeInTheDocument();
    expect(screen.queryByText('-$50.00')).not.toBeInTheDocument();
    act(() => useTransactionsStore.getState().clearSelection());
    expect(screen.getByText('Net recorded activity')).toBeInTheDocument();
    expect(screen.queryByText('Net Income')).not.toBeInTheDocument();
  });
});
