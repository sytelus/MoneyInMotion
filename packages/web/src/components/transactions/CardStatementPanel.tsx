import React from 'react';
import { Link } from 'react-router-dom';
import { Copy, CreditCard } from 'lucide-react';
import type { Transaction, Transactions } from '@moneyinmotion/core';
import { FLAGGED, cardStatementsOf, statementStatusText } from '../../lib/card-statements.js';
import { duplicateRowsOf } from '../../lib/duplicates.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { countLabel, formatCurrency } from '../../lib/utils.js';
import { StatementCheck } from './StatementCheck.js';

/**
 * Where a record sits in the card's reconciliation: the statement it belongs
 * to (payment, lines, estimates), or the counted copy when it is a duplicate.
 */
export function CardStatementPanel({
  transaction,
  transactions,
}: {
  transaction: Transaction;
  transactions: Transactions;
}) {
  const keptId = duplicateRowsOf(transactions).duplicateOf.get(transaction.id);
  if (keptId) {
    const kept = transactions.getTransaction(keptId);
    const file = kept ? transactions.getImportInfo(kept.importId).portableAddress : 'another file';
    return (
      <section
        aria-label="Duplicate row"
        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"
      >
        <h3 className="mb-1 flex items-center gap-2 font-semibold">
          <Copy className="h-4 w-4" />
          Duplicate row: not counted
        </h3>
        <p>
          The same row is in {file}, with slightly different text. That copy is counted; this one is
          left out of every total.
        </p>
        <Link
          className="mt-2 inline-block font-medium underline underline-offset-2"
          to={transactionsHref({ ids: [keptId, transaction.id], basis: 'records', view: 'list' })}
        >
          View both copies
        </Link>
      </section>
    );
  }
  const index = cardStatementsOf(transactions);
  const statementId = index.statementOf.get(transaction.id);
  const statement = statementId ? index.byId.get(statementId) : undefined;
  if (!statement) return null;
  const card = transactions.getAccountInfo(statement.accountId).title || statement.accountId;
  const status = statementStatusText[statement.status];
  const warn = FLAGGED.has(statement.status) && !statement.check?.current;
  return (
    <section
      aria-label="Card statement"
      className={`rounded-lg border p-3 text-xs ${warn ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-border bg-muted/30'}`}
    >
      <h3 className="mb-2 flex items-center gap-2 font-semibold">
        <CreditCard className="h-4 w-4 text-primary" />
        {card} statement, {statement.opening} to {statement.closing}: {status.label}
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
        <dt>Lines</dt>
        <dd>
          {statement.itemIds.length
            ? `${countLabel(statement.itemIds.length, 'line')}, ${formatCurrency(statement.charges)}`
            : 'None imported'}
        </dd>
        <dt>Paid</dt>
        <dd>
          {statement.paymentIds.length
            ? `${countLabel(statement.paymentIds.length, 'payment')}, ${formatCurrency(statement.paid)}`
            : 'No payment found'}
        </dd>
        {statement.creditsBeforePayment > 0 && (
          <>
            <dt>Refunds before payment</dt>
            <dd>{formatCurrency(statement.creditsBeforePayment)}, taken off the autopay</dd>
          </>
        )}
        {(statement.status === 'shortfall' || statement.status === 'excess') && (
          <>
            <dt>Difference</dt>
            <dd>
              {formatCurrency(Math.abs(statement.unresolved))}{' '}
              {statement.unresolved > 0 ? 'more' : 'less'} paid than the lines show
            </dd>
          </>
        )}
        {statement.estimated > 0 && (
          <>
            <dt>Estimated</dt>
            <dd>{formatCurrency(statement.estimated)}, spread evenly over the period</dd>
          </>
        )}
      </dl>
      <p className="mt-2">{status.help}</p>
      <StatementCheck key={statement.id} statement={statement} transactions={transactions} />
      <Link
        className="mt-2 inline-block font-medium text-primary underline underline-offset-2"
        to={transactionsHref({ statement: statement.id, basis: 'records', view: 'list' })}
      >
        View this statement’s payments, lines, and estimates
      </Link>
    </section>
  );
}
