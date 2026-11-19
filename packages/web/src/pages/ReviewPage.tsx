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
  ESTIMATED_CATEGORY,
  cardStatementsOf,
  loadTransactions,
  statementStatusText,
  type CardStatement,
} from '../lib/card-statements.js';
import { duplicateRowsOf } from '../lib/duplicates.js';
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
      <DuplicateRows transactions={transactions} />
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

const STATUS_COLUMNS: Array<{ label: string; statuses: CardStatement['status'][] }> = [
  { label: 'Adds up', statuses: ['reconciled', 'timing'] },
  { label: statementStatusText.shortfall.label, statuses: ['shortfall'] },
  { label: statementStatusText.excess.label, statuses: ['excess', 'missing-payment'] },
  { label: statementStatusText['no-lines'].label, statuses: ['no-lines'] },
  { label: statementStatusText.unpaid.label, statuses: ['unpaid'] },
];

function CardStatements({ transactions }: { transactions: Transactions }) {
  const index = cardStatementsOf(transactions);
  const [page, setPage] = useState(0);
  const review = useMemo(
    () =>
      statementsToReview(transactions).sort(
        (a, b) => Math.abs(b.unresolved) - Math.abs(a.unresolved) || a.id.localeCompare(b.id),
      ),
    [transactions],
  );
  const cards = useMemo(() => {
    const result = new Map<string, CardStatement[]>();
    for (const statement of index.statements)
      result.set(statement.accountId, [...(result.get(statement.accountId) ?? []), statement]);
    return [...result];
  }, [index]);
  const estimated = index.statements.filter((statement) => statement.estimated > 0);
  const estimatedTotal = estimated.reduce((sum, statement) => sum + statement.estimated, 0);
  const timing = index.statements.filter((statement) => statement.status === 'timing').length;
  const title = (id: string) => transactions.getAccountInfo(id).title || id;
  if (!index.statements.length) return null;
  return (
    <ReportPanel
      title="Card statements"
      description="Card lines give the dates and categories of spending; payments check that the lines are complete. Statements are reconciled with a running balance, as your card issuer does, so refunds that reduce an autopay and lines that land in a neighbouring period aren’t errors. Where lines are missing, the missing amount is spread evenly over the billing period as estimated spending."
    >
      <div className="overflow-x-auto">
        <table className="data-table" aria-label="Statements by card">
          <thead>
            <tr>
              <th>Card</th>
              {STATUS_COLUMNS.map((column) => (
                <th key={column.label} className="text-right">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cards.map(([accountId, statements]) => (
              <tr key={accountId}>
                <td>{title(accountId)}</td>
                {STATUS_COLUMNS.map((column) => (
                  <td key={column.label} className="text-right tabular-nums">
                    {statements.filter((s) => column.statuses.includes(s.status)).length}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {timing > 0 && (
          <li>
            {countLabel(timing, 'statement')} add up only together with the next one: a refund, a
            line, or an extra payment landed in a neighbouring period. Nothing to do.
          </li>
        )}
        {estimated.length > 0 && (
          <li>
            {formatCurrency(estimatedTotal)} paid to cards over{' '}
            {countLabel(estimated.length, 'billing period')} has no statement lines; it is spread
            evenly over each period as estimated spending. Importing those statements replaces the
            estimates.{' '}
            <Link
              className="font-medium text-primary underline underline-offset-2"
              to={transactionsHref({ category: ESTIMATED_CATEGORY, view: 'summary' })}
            >
              View estimated spending
            </Link>
          </li>
        )}
      </ul>
      {review.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 aria-hidden className="h-4 w-4" /> Every statement adds up.
        </p>
      ) : (
        <>
          <h3 className="mt-5 text-sm font-semibold">
            {countLabel(review.length, 'statement')} to look at
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Differences that the following statements don’t make up for, largest first. Lines
            missing: import the statement, or check that the file covers the whole period. More
            lines than paid: look for a duplicate line, or a payment from an account you don’t
            import.
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
                      {title(statement.accountId)}, {statement.opening} to {statement.closing}
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
                      {formatCurrency(statement.unresolved)}
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

function DuplicateRows({ transactions }: { transactions: Transactions }) {
  const pairs = [...duplicateRowsOf(transactions).duplicateOf].flatMap(([dropId, keepId]) => {
    const drop = transactions.getTransaction(dropId);
    const keep = transactions.getTransaction(keepId);
    return drop && keep ? [{ drop, keep }] : [];
  });
  if (!pairs.length) return null;
  const file = (importId: string) =>
    transactions.getImportInfo(importId).portableAddress.split('/').at(-1) ?? importId;
  return (
    <ReportPanel
      title="Rows in two files"
      description="The same row appears in two overlapping statement files with slightly different text. One copy is counted; the other is left out of every total. Your files aren’t changed."
    >
      <ul className="space-y-2 text-sm">
        {pairs.map(({ drop, keep }) => (
          <li key={drop.id} className="flex flex-wrap items-center gap-x-2">
            <span className="font-medium">
              {drop.transactionDate.slice(0, 10)} · {formatCurrency(drop.amount)} ·{' '}
              {keep.displayEntityNameNormalized}
            </span>
            <span className="text-muted-foreground">
              counted from {file(keep.importId)}, left out of {file(drop.importId)}
            </span>
            <Link
              className="font-medium text-primary underline underline-offset-2"
              to={transactionsHref({ ids: [keep.id, drop.id], basis: 'records', view: 'list' })}
            >
              View both
            </Link>
          </li>
        ))}
      </ul>
    </ReportPanel>
  );
}
