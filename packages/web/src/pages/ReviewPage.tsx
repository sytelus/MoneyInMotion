import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CreditCard, History } from 'lucide-react';
import type { Transactions } from '@moneyinmotion/core';
import { useTransactions } from '../api/hooks.js';
import { Header } from '../components/layout/Header.js';
import { ReportPanel } from '../components/reports/ReportPanel.js';
import { ReviewQueue } from '../components/reports/ReviewQueue.js';
import { StoredFilesNotImported } from '../components/importing/UnrecognizedFiles.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { Notice } from '../components/ui/notice.js';
import { Pagination } from '../components/ui/pagination.js';
import {
  cardStatementsOf,
  loadTransactions,
  statementStatusText,
  type CardStatement,
} from '../lib/card-statements.js';
import { buildFinancialReport, statementsToReview } from '../lib/financial-reports.js';
import { diagnoseRules } from '../lib/rule-diagnostics.js';
import { transactionsHref } from '../lib/transaction-navigation.js';
import { countLabel, formatCurrency } from '../lib/utils.js';

const PAGE_SIZE = 25;

/** Everything that needs a look after an import, in one place, each with a way to act on it. */
export function ReviewPage() {
  const { data, isLoading, error, refetch } = useTransactions();
  const transactions = useMemo(() => (data ? loadTransactions(data) : null), [data]);
  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="workspace">
        <div className="workspace-heading">
          <div>
            <h1>Review</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              What MoneyInMotion couldn’t settle on its own. Totals already account for each item;
              reviewing makes them more precise.
            </p>
          </div>
        </div>
        {isLoading && <p role="status">Checking your transactions…</p>}
        {error && (
          <Notice
            tone="error"
            title="Your transactions could not be loaded"
            actions={<Button onClick={() => void refetch()}>Try again</Button>}
          >
            Nothing was changed.
          </Notice>
        )}
        {transactions && <ReviewContent transactions={transactions} />}
      </main>
    </div>
  );
}

function ReviewContent({ transactions }: { transactions: Transactions }) {
  const report = useMemo(
    () => buildFinancialReport(transactions, { from: '', to: '', account: '' }),
    [transactions],
  );
  const rules = useMemo(() => diagnoseRules(transactions), [transactions]);
  const ruleIssues =
    rules.counts.unmatched +
    rules.counts.overridden +
    rules.counts.duplicate +
    rules.counts.missing +
    rules.counts.conflict;
  return (
    <div className="space-y-5">
      <StoredFilesNotImported />
      <CardStatements transactions={transactions} />
      <ReviewQueue
        report={report}
        hide={['statements']}
        title="Records to check"
        description="All dates and accounts. Each opens the matching records in Transactions."
      />
      <ReportPanel
        title="Rules"
        description="Saved rules that do nothing, repeat another, point at records that aren’t loaded, or disagree about a category."
      >
        <Link
          to="/rules"
          className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/40"
        >
          <span className="rounded-lg bg-amber-50 p-2 text-amber-800">
            <History aria-hidden className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm">
            <span className="block text-xl font-semibold tabular-nums">
              {ruleIssues.toLocaleString()}
            </span>
            rule issues in Rule Studio
          </span>
          <ArrowRight aria-hidden className="h-4 w-4 text-slate-500" />
        </Link>
      </ReportPanel>
    </div>
  );
}

function CardStatements({ transactions }: { transactions: Transactions }) {
  const index = cardStatementsOf(transactions);
  const [page, setPage] = useState(0);
  const review = useMemo(
    () =>
      statementsToReview(transactions).sort(
        (a, b) => Math.abs(b.unexplained) - Math.abs(a.unexplained) || a.id.localeCompare(b.id),
      ),
    [transactions],
  );
  const cards = useMemo(() => {
    const result = new Map<string, Record<CardStatement['status'], number>>();
    for (const statement of index.statements) {
      const counts = result.get(statement.accountId) ?? {
        reconciled: 0,
        difference: 0,
        'no-lines': 0,
        'missing-payment': 0,
        unpaid: 0,
      };
      counts[statement.status]++;
      result.set(statement.accountId, counts);
    }
    return [...result];
  }, [index]);
  const standalone = [...index.standalonePayments].flatMap(
    (id) => transactions.getTransaction(id) ?? [],
  );
  const standaloneTotal = -standalone.reduce((sum, tx) => sum + tx.correctedAmount, 0);
  const title = (id: string) => transactions.getAccountInfo(id).title || id;
  if (!index.statements.length && !standalone.length) return null;
  return (
    <ReportPanel
      title="Card statements"
      description="A payment to a card is the spending; the card’s lines for the billing period it paid are its details. When the lines add up, they count instead of the payment. When they don’t, the gap counts as an “Unexplained difference”, so totals always equal what was paid."
    >
      <div className="overflow-x-auto">
        <table className="data-table" aria-label="Statements by card">
          <thead>
            <tr>
              <th>Card</th>
              <th className="text-right">{statementStatusText.reconciled.label}</th>
              <th className="text-right">{statementStatusText.difference.label}</th>
              <th className="text-right">{statementStatusText['missing-payment'].label}</th>
              <th className="text-right">{statementStatusText['no-lines'].label}</th>
              <th className="text-right">{statementStatusText.unpaid.label}</th>
            </tr>
          </thead>
          <tbody>
            {cards.map(([accountId, counts]) => (
              <tr key={accountId}>
                <td>{title(accountId)}</td>
                {(
                  ['reconciled', 'difference', 'missing-payment', 'no-lines', 'unpaid'] as const
                ).map((status) => (
                  <td key={status} className="text-right tabular-nums">
                    {counts[status]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {standalone.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {countLabel(standalone.length, 'bank payment')} to cards (
          {formatCurrency(standaloneTotal)}) paid billing periods with no imported card lines, so
          each counts as spending itself.{' '}
          <Link
            className="font-medium text-primary underline underline-offset-2"
            to={transactionsHref({
              ids: standalone.map((tx) => tx.id),
              basis: 'records',
              view: 'list',
            })}
          >
            View them
          </Link>
        </p>
      )}
      {review.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 aria-hidden className="h-4 w-4" /> Every statement with a payment adds up.
        </p>
      ) : (
        <>
          <h3 className="mt-5 text-sm font-semibold">
            {countLabel(review.length, 'statement')} to look at
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Largest differences first. A difference often means a missing or extra line, a statement
            file that doesn’t cover the whole period, or a line that landed in the next period (then
            the next statement is off by the opposite amount).
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="data-table" aria-label="Statements to look at">
              <thead>
                <tr>
                  <th>Statement</th>
                  <th>Status</th>
                  <th className="text-right">Lines</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Difference</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {review.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((statement) => (
                  <tr key={statement.id}>
                    <td>
                      <CreditCard aria-hidden className="mr-1 inline h-4 w-4 text-primary" />
                      {title(statement.accountId)}, closing {statement.closing}
                    </td>
                    <td title={statementStatusText[statement.status].help}>
                      {statementStatusText[statement.status].label}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(statement.charges)} ({statement.itemIds.length})
                    </td>
                    <td className="text-right tabular-nums">
                      {statement.paymentIds.length ? formatCurrency(statement.paid) : '—'}
                    </td>
                    <td className="text-right tabular-nums">
                      {statement.differenceId ? formatCurrency(statement.unexplained) : '—'}
                    </td>
                    <td>
                      <Link
                        className={buttonClassName({ variant: 'outline', size: 'sm' })}
                        to={transactionsHref({
                          statement: statement.id,
                          basis: 'records',
                          view: 'list',
                        })}
                        aria-label={`View ${title(statement.accountId)} statement closing ${statement.closing}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={review.length}
            noun="statements"
            onChange={setPage}
          />
        </>
      )}
    </ReportPanel>
  );
}
