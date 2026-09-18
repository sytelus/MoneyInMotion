/**
 * Right sidebar panel showing details for the currently selected transaction(s),
 * or a non-duplicated activity summary when nothing is selected.
 *
 * @module
 */

import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Flag } from 'lucide-react';
import { NetAggregator, type Transaction } from '@moneyinmotion/core';
import { formatDate } from '../../lib/utils.js';
import { transactionCategory } from '../../lib/transaction-explorer.js';
import { AmountDisplay } from './AmountDisplay.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { HelpHint } from '../ui/help-hint.js';
import { Button } from '../ui/button.js';
import { TransactionProvenance } from './TransactionProvenance.js';
import { transactionProvenance } from '../../lib/transaction-provenance.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';

/**
 * Collapsible section for provider attributes (arbitrary key-value metadata
 * attached to a transaction by the statement parser).
 */
const ProviderAttributes: React.FC<{ attributes: Record<string, string> }> = ({ attributes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const entries = Object.entries(attributes);
  if (entries.length === 0) return null;

  return (
    <div className="border-t border-border pt-3">
      <button
        aria-expanded={isOpen}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Provider Attributes ({entries.length})
      </button>
      {isOpen && (
        <dl className="mt-2 space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="grid grid-cols-[auto_1fr] gap-2 text-xs">
              <dt className="text-muted-foreground font-medium">{key}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};

/** Detail row helper. */
const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-2 text-sm">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="min-w-0 break-words text-right">{children}</span>
  </div>
);

/** Single-transaction detail view. */
const SingleDetail: React.FC<{ transaction: Transaction }> = ({ transaction }) => {
  const transactions = useTransactionsStore((s) => s.transactions);
  const source = transaction.toData();
  const related = transactions ? transactionProvenance(transaction, transactions).relatedIds : [];
  return (
    <div className="space-y-3">
      <h2
        className="font-semibold text-base break-words"
        title={transaction.displayEntityNameNormalized}
      >
        {transaction.displayEntityNameNormalized}
      </h2>

      <div className="space-y-2">
        <DetailRow label="Amount">
          <AmountDisplay amount={transaction.correctedAmount} />
        </DetailRow>
        <DetailRow label="Date">{formatDate(transaction.correctedTransactionDate)}</DetailRow>
        <DetailRow label="Account">
          {transactions?.getAccountInfo(transaction.accountId).title || transaction.accountId}
        </DetailRow>
        <DetailRow label="Category">{transactionCategory(transaction)}</DetailRow>

        {transaction.note && (
          <div className="text-sm">
            <span className="text-muted-foreground">Note: </span>
            <span>{transaction.note}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Marked for review:</span>
          {transaction.isUserFlagged ? (
            <span className="inline-flex items-center gap-1">
              <Flag className="h-4 w-4 text-destructive" />
              Yes
            </span>
          ) : (
            <span className="text-muted-foreground">No</span>
          )}
        </div>
        <HelpHint title="Mark for review">
          A personal reminder you can filter by. Marking a transaction does not affect totals.
        </HelpHint>
      </div>

      {related.length > 0 && (
        <details className="border-t border-border pt-3 text-xs">
          <summary className="cursor-pointer font-medium">
            Related payment / order details ({related.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {related.map((id) => {
              const tx = transactions?.getTransaction(id);
              return tx ? (
                <li key={id}>
                  <Link
                    className="text-left text-primary underline underline-offset-2"
                    to={transactionsHref({ transaction: id, basis: 'records', view: 'list' })}
                  >
                    {tx.displayEntityNameNormalized} · {formatDate(tx.correctedTransactionDate)}
                  </Link>
                </li>
              ) : (
                <li key={id} className="rounded-md bg-amber-50 p-2 text-amber-900">
                  <p className="font-medium">Related record unavailable</p>
                  <p className="mt-1">
                    This saved reference points to a record not retained in the loaded history,
                    which can happen to an earlier combined or source record. No counterpart is
                    guessed.
                  </p>
                  <p className="mt-1 break-all">Reference: {id}</p>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-muted-foreground">
            Related records provide context. They are not added again to reporting totals.
          </p>
        </details>
      )}
      <details className="border-t border-border pt-3 text-xs">
        <summary className="cursor-pointer font-medium">
          Original statement values &amp; IDs
        </summary>
        <dl className="mt-2 space-y-2 break-all">
          <dt>Name</dt>
          <dd>{transaction.entityName}</dd>
          <dt>Imported amount</dt>
          <dd>{source.amount}</dd>
          <dt>Imported date</dt>
          <dd>{source.transactionDate}</dd>
          {transaction.providerCategoryName && (
            <>
              <dt>Statement category</dt>
              <dd>{transaction.providerCategoryName}</dd>
            </>
          )}
          <dt>Transaction ID</dt>
          <dd className="select-all">{transaction.id}</dd>
          <dt>Import ID</dt>
          <dd>{source.importId}</dd>
        </dl>
      </details>

      {transaction.providerAttributes && (
        <ProviderAttributes attributes={transaction.providerAttributes} />
      )}
      {transactions && (
        <TransactionProvenance transaction={transaction} transactions={transactions} />
      )}
    </div>
  );
};

/**
 * Right sidebar component. Shows transaction details when one or more
 * transactions are selected, or a non-duplicated activity summary otherwise.
 */
export const TransactionSummary: React.FC = () => {
  const transactions = useTransactionsStore((s) => s.transactions);
  const selectedIds = useTransactionsStore((s) => s.selectedTransactionIds);
  const basis = useTransactionsStore((s) => s.basis);
  const reporting = useTransactionsStore((s) => s.reporting);
  const filteredTxns = useTransactionsStore(useShallow((s) => s.getFilteredTransactions()));

  const selectedTransactions = useMemo(() => {
    if (!transactions || selectedIds.size === 0) return [];
    const result: Transaction[] = [];
    for (const id of selectedIds) {
      const tx = transactions.getTransaction(id);
      if (tx) result.push(tx);
    }
    return result;
  }, [transactions, selectedIds]);

  // Selection can survive a refetch or originate from an investigative link.
  // Do not trust the current view label as proof that the selection is additive.
  const selectionIsReportingGrain = useMemo(() => {
    if (basis !== 'reporting') return false;
    const reportingIds = new Set(reporting.map((transaction) => transaction.id));
    return [...selectedIds].every((id) => reportingIds.has(id));
  }, [basis, reporting, selectedIds]);

  const netIncome = useMemo(() => {
    if (filteredTxns.length === 0 || basis === 'records') return null;
    const agg = new NetAggregator(filteredTxns);
    return agg;
  }, [filteredTxns, basis]);

  // Show selected transaction details
  if (selectedTransactions.length === 1) {
    return (
      <div className="p-4">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3"
          onClick={() => useTransactionsStore.getState().clearSelection()}
        >
          Back to results
        </Button>
        <SingleDetail transaction={selectedTransactions[0]!} />
        <p className="mt-4 text-xs text-muted-foreground">
          Tip: Press Alt+T to categorize, Alt+N to add a note.
        </p>
      </div>
    );
  }

  if (selectedTransactions.length > 1) {
    const total = selectedTransactions.reduce((sum, tx) => sum + tx.correctedAmount, 0);
    return (
      <div className="p-4 space-y-3">
        <h2 className="font-semibold text-base">
          {selectedTransactions.length} transactions selected
        </h2>
        {selectionIsReportingGrain ? (
          <DetailRow label="Selection amount">
            <AmountDisplay amount={total} />
          </DetailRow>
        ) : (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Source records can include the same payment and its order details. This selection is not
            summed.{' '}
            {basis === 'records'
              ? 'Switch to Reporting items for non-duplicated totals.'
              : 'A selected record is outside the reporting view. Clear this selection and select reporting items again for a non-duplicated amount.'}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Use Edit selected items to preview a correction to this batch. Keyboard edit shortcuts
          apply to all selected records.
        </p>
      </div>
    );
  }

  if (basis === 'records')
    return (
      <div className="space-y-3 p-4 text-sm">
        <h2 className="font-semibold">Source-record inspection</h2>
        <p>{filteredTxns.length.toLocaleString()} records match this period and filters.</p>
        <p className="text-muted-foreground">
          These records may include a payment and its order details. Amounts are not summed here.
          Select a row for source evidence and the current rule chain.
        </p>
      </div>
    );

  // No selection: show non-duplicated net activity, never an account balance.
  if (!netIncome) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        No reporting items match this period and filters.
      </div>
    );
  }

  const subs = netIncome.aggregator.getSubAggregatorsBySortOrder();
  const incomeSub = subs.find((s) => s.name === 'Income');
  const expenseSub = subs.find((s) => s.name === 'Expenses');
  const transferSub = subs.find((s) => s.name === 'Transfers');
  const unmatchedSub = subs.find((s) => s.name === 'Unmatched');

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-base">Summary</h2>

      <div className="space-y-2">
        <DetailRow label="Net recorded activity">
          <AmountDisplay amount={netIncome.netIncomeAmount} />
        </DetailRow>
        {incomeSub && (
          <DetailRow label="Incoming amounts">
            <AmountDisplay amount={incomeSub.sum} />
          </DetailRow>
        )}
        {expenseSub && (
          <DetailRow label="Outgoing amounts">
            <AmountDisplay amount={expenseSub.sum} />
          </DetailRow>
        )}
        {transferSub && (
          <DetailRow label="Transfers (excluded)">
            <AmountDisplay amount={transferSub.sum} />
          </DetailRow>
        )}
        {unmatchedSub && (
          <DetailRow label="Unmatched (excluded)">
            <AmountDisplay amount={unmatchedSub.sum} />
          </DetailRow>
        )}
      </div>

      <div className="border-t border-border pt-3 text-xs text-muted-foreground">
        {filteredTxns.length} reporting items in the displayed period and filters
      </div>

      <p className="text-xs text-muted-foreground">
        Incoming amounts include returns and discounts, not only earnings. Transfers and unmatched
        records are excluded from net recorded activity; this is not an account balance.
      </p>
      <p className="text-xs text-muted-foreground">
        Click a transaction to see details. Use its actions menu to edit; use checkboxes for bulk
        changes.
      </p>
    </div>
  );
};

TransactionSummary.displayName = 'TransactionSummary';
