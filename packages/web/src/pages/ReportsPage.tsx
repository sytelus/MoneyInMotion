/** Financial overview: a read-only, drillable projection of the current snapshot. */
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Transactions } from '@moneyinmotion/core';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Download,
  Printer,
  UploadCloud,
  Wallet,
  Info,
  BarChart3,
} from 'lucide-react';
import { useTransactions } from '../api/hooks.js';
import { Header } from '../components/layout/Header.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Select } from '../components/ui/select.js';
import { HelpHint } from '../components/ui/help-hint.js';
import { Notice } from '../components/ui/notice.js';
import { ActivityChart } from '../components/reports/ActivityChart.js';
import { BreakdownPanel } from '../components/reports/BreakdownPanel.js';
import { ReviewQueue } from '../components/reports/ReviewQueue.js';
import { AccountActivity } from '../components/reports/AccountActivity.js';
import {
  buildFinancialReport,
  financialReportCsv,
  monthBounds,
  reportCoverage,
  type ReportBreakdown,
} from '../lib/financial-reports.js';
import { parseTransactionScope, transactionsHref } from '../lib/transaction-navigation.js';
import { downloadText } from '../lib/download.js';
import { countLabel, formatCurrency, formatDate, formatPeriodKey } from '../lib/utils.js';
import '../components/reports/reports.css';

/** Keep loading/error/empty states outside the fully initialized report view. */
/** Fraction of spending in the "Uncategorized" row. */
function uncategorizedShare(categories: ReportBreakdown[]): number {
  const total = categories.reduce((sum, row) => sum + row.spending, 0);
  const uncategorized = categories.find((row) => row.key === 'Uncategorized')?.spending ?? 0;
  return total > 0 ? uncategorized / total : 0;
}

export function ReportsPage() {
  const { data, isLoading, error, refetch } = useTransactions();
  const transactions = useMemo(() => (data ? Transactions.fromData(data) : null), [data]);
  return (
    <div className="reports-page min-h-screen bg-slate-50/70">
      <Header />
      {isLoading ? (
        <main className="mx-auto max-w-7xl p-8">
          <p role="status">Preparing your financial overview…</p>
        </main>
      ) : error ? (
        <main className="mx-auto max-w-3xl p-8">
          <h1 className="text-2xl font-semibold">Overview unavailable</h1>
          <Notice
            tone="error"
            title="Financial overview could not be loaded"
            className="my-4"
            actions={<Button onClick={() => void refetch()}>Try again</Button>}
          >
            MoneyInMotion could not read the current snapshot. Your statements, rules, and saved
            transaction data were not changed.
          </Notice>
        </main>
      ) : transactions && transactions.allTransactionCount > 0 ? (
        <FinancialOverview transactions={transactions} />
      ) : (
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-indigo-100 text-indigo-700">
            <BarChart3 aria-hidden className="h-8 w-8" />
          </span>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">
            Your finances, with the details connected
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Set up your accounts, import statements, then explore spending, credits, and the records
            behind every figure. If statements already exist on this computer, Imports can rebuild
            your overview from them.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link className={buttonClassName()} to="/accounts">
              Set up accounts
            </Link>
            <Link className={buttonClassName({ variant: 'outline' })} to="/imports">
              Import or rebuild statements
            </Link>
          </div>
        </main>
      )}
    </div>
  );
}

function FinancialOverview({ transactions }: { transactions: Transactions }) {
  const coverage = useMemo(() => reportCoverage(transactions), [transactions]);
  // Report scope belongs to the URL so drill-down → browser Back restores it.
  // It is view state, not new financial data or application configuration.
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const latest = coverage.to.slice(0, 7);
  const { period, custom, report, scopeWarnings } = useMemo(() => {
    const query = new URLSearchParams(search);
    const requestedPeriod = query.get('period') ?? 'latest';
    const period = ['latest', 'year', 'all', 'custom', ...coverage.months].includes(requestedPeriod)
      ? requestedPeriod
      : 'latest';
    const requestedAccount = query.get('account') ?? '';
    const account = transactions.hasAccountInfo(requestedAccount) ? requestedAccount : '';
    const scopeWarnings = [
      ...(requestedAccount && !account
        ? ['The requested source account is not in this snapshot. Showing all source accounts.']
        : []),
      ...(period !== requestedPeriod
        ? ['The requested period is unavailable. Showing the latest available month.']
        : []),
    ];
    const parsed = parseTransactionScope(`?${search}`);
    const custom = { from: parsed.from ?? '', to: parsed.to ?? '' };
    const bounds =
      period === 'custom'
        ? custom
        : period === 'all'
          ? { from: coverage.from, to: coverage.to }
          : period === 'year'
            ? { from: `${latest.slice(0, 4)}-01-01`, to: `${latest.slice(0, 4)}-12-31` }
            : monthBounds(period === 'latest' ? latest : period);
    return {
      period,
      custom,
      scopeWarnings,
      report: buildFinancialReport(transactions, { ...bounds, account }),
    };
  }, [transactions, coverage, search, latest]);
  const scope = report.scope;
  const account = scope.account;
  const invalid = Boolean(scope.from && scope.to && scope.from > scope.to);
  const accounts = useMemo(
    () =>
      [...new Set([...transactions.allParentChildTransactions].map((row) => row.accountId))]
        .map((id) => ({ value: id, label: transactions.getAccountInfo(id).title || id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [transactions],
  );
  const scopeLabel = `${scope.from ? formatDate(scope.from) : 'All earlier dates'} – ${scope.to ? formatDate(scope.to) : 'All later dates'}`;
  const updateScopeParams = (values: Record<string, string>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  const changePeriod = (value: string) => {
    updateScopeParams({
      period: value,
      from: value === 'custom' ? scope.from : '',
      to: value === 'custom' ? scope.to : '',
    });
  };
  const exportReport = () => {
    downloadText(
      financialReportCsv(report),
      `moneyinmotion-report-${scope.from || 'start'}-${scope.to || 'end'}.csv`,
    );
  };
  const cash = report.cashFlow;
  const metricCards = [
    {
      title: 'Income',
      value: cash.income,
      help: 'Paychecks, interest, and other deposits you earned. Excludes refunds and transfers.',
      Icon: ArrowDownLeft,
      flow: 'income',
      style: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    },
    {
      title: 'Spending',
      value: cash.spending,
      help: `${formatCurrency(cash.grossSpending)} spent minus ${formatCurrency(cash.offsets)} in refunds, returns, and discounts.`,
      Icon: ArrowUpRight,
      flow: 'spending',
      style: 'border-indigo-300 bg-indigo-50 text-indigo-900',
    },
    {
      title: cash.savings < 0 ? 'Deficit' : 'Savings',
      value: cash.savings,
      help: 'Income minus spending. Not an account balance.',
      Icon: Wallet,
      flow: 'cashflow',
      style:
        cash.savings < 0
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-sky-300 bg-sky-50 text-sky-900',
    },
  ] as const;
  return (
    <main className="workspace">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
            Your financial workspace
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Review cash flow, spending categories and transactions that need attention.
          </p>
        </div>
        <div className="report-screen-only flex flex-wrap items-center gap-2">
          <Link
            to="/imports"
            className={buttonClassName({ className: 'bg-indigo-700 hover:bg-indigo-800' })}
          >
            <UploadCloud aria-hidden className="mr-2 h-4 w-4" />
            Import statements
          </Link>
          <Button
            variant="outline"
            onClick={exportReport}
            disabled={invalid || !report.rows.length}
          >
            <Download aria-hidden className="mr-2 h-4 w-4" />
            Export report
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            disabled={invalid}
            title="Print this overview or save it as PDF with your browser"
          >
            <Printer aria-hidden className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>
      <section
        aria-label="Report scope"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="report-screen-only grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="text-xs font-medium text-slate-600">
            Reporting period
            <Select
              className="mt-1"
              value={period}
              onChange={(event) => changePeriod(event.target.value)}
              options={[
                { value: 'latest', label: `Latest month · ${formatPeriodKey(latest)}` },
                { value: 'year', label: `Latest year · ${latest.slice(0, 4)}` },
                { value: 'all', label: 'All dates' },
                { value: 'custom', label: 'Custom dates' },
                ...coverage.months.map((month) => ({
                  value: month,
                  label: formatPeriodKey(month),
                })),
              ]}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Source account
            <Select
              className="mt-1"
              value={account}
              onChange={(event) => updateScopeParams({ account: event.target.value })}
              options={[{ value: '', label: 'All source accounts' }, ...accounts]}
            />
          </label>
          <Link
            className={buttonClassName({ variant: 'outline' })}
            to={transactionsHref({ ...scope, view: 'list' })}
          >
            Explore transactions
            <ArrowRight aria-hidden className="ml-2 h-4 w-4" />
          </Link>
        </div>
        {period === 'custom' && (
          <div className="report-screen-only mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium">
              From date
              <Input
                type="date"
                className="mt-1"
                value={custom.from}
                onChange={(event) => updateScopeParams({ from: event.target.value })}
              />
            </label>
            <label className="text-xs font-medium">
              Through date
              <Input
                type="date"
                className="mt-1"
                value={custom.to}
                onChange={(event) => updateScopeParams({ to: event.target.value })}
              />
            </label>
          </div>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-800">
          <CalendarDays aria-hidden className="h-4 w-4 text-indigo-700" />
          <span data-testid="report-scope">{scopeLabel}</span>
          <span className="font-normal text-muted-foreground">
            · UTC ·{' '}
            {account
              ? transactions.getAccountInfo(account).title || account
              : 'All source accounts'}
          </span>
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Available records: {formatDate(coverage.from)} – {formatDate(coverage.to)}. Date coverage
          does not establish that every statement has been imported.
        </p>
        {scopeWarnings.length > 0 && (
          <Notice tone="warning" title="Reporting scope adjusted" className="mt-3">
            {scopeWarnings.join(' ')}
          </Notice>
        )}
      </section>
      {invalid ? (
        <Notice tone="warning" role="alert" title="Reporting period needs attention">
          The start date is after the end date. Fix the reporting period to view or export results.
        </Notice>
      ) : (
        <>
          {report.rows.length === 0 && (
            <div
              role="status"
              className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900"
            >
              No reporting items in this scope. Try another date range or source account. Review
              counts below also check source records that may be hidden behind reporting details.
            </div>
          )}
          <section aria-label="Activity totals" className="grid gap-4 md:grid-cols-3">
            {metricCards.map(({ title, value, help, Icon, flow, style }) => (
              <Link
                key={title}
                to={transactionsHref({ ...scope, flow, view: 'list' })}
                className={`group rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md ${style}`}
                title={`${title}: ${formatCurrency(value)}. View underlying transactions.`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="rounded-xl bg-white/70 p-2">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                </span>
                <span className="mt-4 block text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {formatCurrency(value)}
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">{help}</span>
                <span className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-700">
                  View transactions
                  <ArrowRight aria-hidden className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </section>
          {cash.undecidedCount > 0 && (
            <Notice tone="warning" title="Some credits need your decision">
              <p>
                {countLabel(cash.undecidedCount, 'credit')} totaling{' '}
                {formatCurrency(cash.undecidedAmount)} could be income or could offset spending (for
                example card statement credits, PayPal receipts, or reward points). They are left
                out of the figures above until you decide.{' '}
                <Link
                  className="font-semibold underline"
                  to={transactionsHref({ ...scope, flow: 'undecided', view: 'list' })}
                >
                  Review them
                </Link>
                , select one or more, and choose <strong>Count as income</strong> or{' '}
                <strong>Count against spending</strong>.
              </p>
            </Notice>
          )}
          {cash.investmentCount > 0 && (
            <Notice tone="info" title="Investment transfers">
              <p>
                {formatCurrency(cash.fromInvestments)} came in from your investments and{' '}
                {formatCurrency(cash.toInvestments)} went out to them (
                {countLabel(cash.investmentCount, 'transaction')}). This is your own money moving,
                so it is neither income nor spending, and savings above stays income minus spending.{' '}
                <Link
                  className="font-semibold underline"
                  to={transactionsHref({ ...scope, flow: 'investment', view: 'list' })}
                >
                  View them
                </Link>
                .
              </p>
            </Notice>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Info aria-hidden className="h-4 w-4 shrink-0" />
            <span>
              {(cash.incomeCount + cash.spendingCount).toLocaleString()} reporting items. Excludes{' '}
              {report.excluded.transfers.toLocaleString()} transfer records and{' '}
              {report.excluded.unmatched.toLocaleString()} unmatched items.
            </span>
            <HelpHint title="How these figures are calculated">
              <p>
                <strong>Income</strong> is interest plus deposits into checking or savings accounts.{' '}
                <strong>Spending</strong> is purchases, fees, checks, ATM withdrawals, and loan
                payments, minus refunds, returns, and discounts. Account transfers and card payments
                are neither.
              </p>
              <p>
                Money moved to or from an investment account you don&apos;t import, such as a
                brokerage withdrawal that pays for a large purchase, is neither too: set its type to{' '}
                <strong>Investment Transfer</strong> and it is shown on its own.
              </p>
              <p>
                Other credits, such as card statement credits or PayPal receipts, wait for your
                decision. Setting a transaction&apos;s type yourself always settles it.
              </p>
              <p>
                Completed order details replace their parent payment so it is not counted twice.
                Dates, amounts, categories, and types reflect your saved corrections. Amounts are
                USD.
              </p>
            </HelpHint>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <ActivityChart months={report.months} days={report.days} scope={scope} />
            <ReviewQueue report={report} />
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-3">
            <BreakdownPanel
              title="Where the money goes"
              description="Spending by category, net of refunds. An uncategorized refund counts against the category of the purchase it reverses."
              rows={report.categories}
              measure="spending"
              of="spending"
              href={(row) =>
                transactionsHref({ ...scope, category: row.key, flow: 'spending', view: 'list' })
              }
              footer={
                uncategorizedShare(report.categories) > 0.25 && (
                  <div className="mb-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950">
                    <p>
                      Most spending here has no category yet. Pick one per merchant and future
                      imports follow.
                    </p>
                    <Link
                      className={buttonClassName({ size: 'sm', className: 'mt-2' })}
                      to={transactionsHref({
                        ...scope,
                        category: 'Uncategorized',
                        flow: 'spending',
                        view: 'list',
                      })}
                    >
                      Categorize spending
                    </Link>
                  </div>
                )
              }
            />
            <BreakdownPanel
              title="Top merchants"
              description="Spending by merchant, net of refunds. Select a merchant to inspect the exact items."
              rows={report.merchants}
              measure="spending"
              of="spending"
              href={(row) =>
                transactionsHref({ ...scope, merchant: row.key, flow: 'spending', view: 'list' })
              }
            />
            <BreakdownPanel
              title="Where income comes from"
              description="Income by payer, such as an employer or bank interest."
              rows={report.incomeSources}
              measure="credits"
              of="income"
              color="bg-emerald-600"
              href={(row) =>
                transactionsHref({ ...scope, merchant: row.key, flow: 'income', view: 'list' })
              }
            />
          </div>
          <AccountActivity report={report} transactions={transactions} />
        </>
      )}
      <footer className="border-t border-slate-200 pt-4 text-xs leading-5 text-muted-foreground">
        Read-only reports from the current saved snapshot · USD · Figures come from your statements,
        not verified account balances.{' '}
        <Link to="/imports" className="text-indigo-700 underline">
          Review statement sources
        </Link>{' '}
        or{' '}
        <Link to="/rules" className="text-indigo-700 underline">
          manage the rules behind your corrections
        </Link>
        .
      </footer>
    </main>
  );
}
