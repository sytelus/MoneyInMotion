/**
 * Right sidebar panel showing details for the currently selected transaction(s),
 * or a net income summary when nothing is selected.
 *
 * @module
 */

import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ChevronDown, ChevronRight, Flag } from 'lucide-react';
import { NetAggregator, type Transaction } from '@moneyinmotion/core';
import { formatDate } from '../../lib/utils.js';
import { transactionCategory } from '../../lib/transaction-explorer.js';
import { AmountDisplay } from './AmountDisplay.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { HelpHint } from '../ui/help-hint.js';
import { Button } from '../ui/button.js';

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
  const select = useTransactionsStore((s) => s.selectTransaction);
  const source = transaction.toData();
  const related = [
    transaction.parentId,
    source.relatedTransferId,
    ...Object.keys(transaction.children ?? {}),
  ].filter((id): id is string => Boolean(id));
  return (
    <div className="space-y-3">
      <h3
        className="font-semibold text-base break-words"
        title={transaction.displayEntityNameNormalized}
      >
        {transaction.displayEntityNameNormalized}
      </h3>

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
                  <button
                    className="text-left text-primary underline underline-offset-2"
                    onClick={() => select(id)}
                  >
                    {tx.displayEntityNameNormalized} · {formatDate(tx.correctedTransactionDate)}
                  </button>
                </li>
              ) : null;
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
    </div>
  );
};

/**
 * Right sidebar component. Shows transaction details when one or more
 * transactions are selected, or a net income summary otherwise.
 */
export const TransactionSummary: React.FC = () => {
  const transactions = useTransactionsStore((s) => s.transactions);
  const selectedIds = useTransactionsStore((s) => s.selectedTransactionIds);
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

  const netIncome = useMemo(() => {
    if (filteredTxns.length === 0) return null;
    const agg = new NetAggregator(filteredTxns);
    return agg;
  }, [filteredTxns]);

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
          Back to period summary
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
        <h3 className="font-semibold text-base">
          {selectedTransactions.length} transactions selected
        </h3>
        <DetailRow label="Total">
          <AmountDisplay amount={total} />
        </DetailRow>
      </div>
    );
  }

  // No selection: show net income summary
  if (!netIncome) {
    return <div className="p-4 text-muted-foreground text-sm">No transactions loaded.</div>;
  }

  const subs = netIncome.aggregator.getSubAggregatorsBySortOrder();
  const incomeSub = subs.find((s) => s.name === 'Income');
  const expenseSub = subs.find((s) => s.name === 'Expenses');
  const transferSub = subs.find((s) => s.name === 'Transfers');

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold text-base">Summary</h3>

      <div className="space-y-2">
        <DetailRow label="Net Income">
          <AmountDisplay amount={netIncome.netIncomeAmount} />
        </DetailRow>
        {incomeSub && (
          <DetailRow label="Income">
            <AmountDisplay amount={incomeSub.sum} />
          </DetailRow>
        )}
        {expenseSub && (
          <DetailRow label="Expenses">
            <AmountDisplay amount={expenseSub.sum} />
          </DetailRow>
        )}
        {transferSub && (
          <DetailRow label="Transfers">
            <AmountDisplay amount={transferSub.sum} />
          </DetailRow>
        )}
      </div>

      <div className="border-t border-border pt-3 text-xs text-muted-foreground">
        {filteredTxns.length} reporting items in the displayed period and filters
      </div>

      <p className="text-xs text-muted-foreground">
        Click a transaction to see details. Use its actions menu to edit; use checkboxes for bulk
        changes.
      </p>
    </div>
  );
};

TransactionSummary.displayName = 'TransactionSummary';
