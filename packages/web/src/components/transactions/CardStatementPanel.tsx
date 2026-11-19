import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import type { Transaction, Transactions } from '@moneyinmotion/core';
import { cardStatementsOf, statementStatusText } from '../../lib/card-statements.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { countLabel, formatCurrency } from '../../lib/utils.js';

/** The card statement a record belongs to: payment, lines, and whether they add up. */
export function CardStatementPanel({
  transaction,
  transactions,
}: {
  transaction: Transaction;
  transactions: Transactions;
}) {
  const index = cardStatementsOf(transactions);
  const statementId = index.statementOf.get(transaction.id);
  const statement = statementId ? index.byId.get(statementId) : undefined;
  if (!statement) {
    if (!index.standalonePayments.has(transaction.id)) return null;
    return (
      <section
        aria-label="Card statement"
        className="rounded-lg border border-border bg-muted/30 p-3 text-xs"
      >
        <h3 className="mb-1 flex items-center gap-2 font-semibold">
          <CreditCard className="h-4 w-4 text-primary" />
          Card payment with no statement lines
        </h3>
        <p className="text-muted-foreground">{statementStatusText['no-lines'].help}</p>
      </section>
    );
  }
  const card = transactions.getAccountInfo(statement.accountId).title || statement.accountId;
  const status = statementStatusText[statement.status];
  const warn = statement.status === 'difference' || statement.status === 'missing-payment';
  return (
    <section
      aria-label="Card statement"
      className={`rounded-lg border p-3 text-xs ${warn ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-border bg-muted/30'}`}
    >
      <h3 className="mb-2 flex items-center gap-2 font-semibold">
        <CreditCard className="h-4 w-4 text-primary" />
        {card} statement closing {statement.closing}: {status.label}
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
        <dt>Lines</dt>
        <dd>
          {countLabel(statement.itemIds.length, 'line')}, {formatCurrency(statement.charges)}
        </dd>
        <dt>Paid</dt>
        <dd>
          {statement.paymentIds.length
            ? `${countLabel(statement.paymentIds.length, 'payment')}, ${formatCurrency(statement.paid)}`
            : 'No payment found'}
        </dd>
        {statement.differenceId && (
          <>
            <dt>Difference</dt>
            <dd>
              {formatCurrency(Math.abs(statement.unexplained))}{' '}
              {statement.unexplained > 0 ? 'more' : 'less'} paid than the lines show
            </dd>
          </>
        )}
      </dl>
      <p className="mt-2">{status.help}</p>
      <Link
        className="mt-2 inline-block font-medium text-primary underline underline-offset-2"
        to={transactionsHref({ statement: statement.id, basis: 'records', view: 'list' })}
      >
        View this statement’s payment and lines
      </Link>
    </section>
  );
}
