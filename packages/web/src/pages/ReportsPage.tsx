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
} from '../lib/financial-reports.js';
import { parseTransactionScope, transactionsHref } from '../lib/transaction-navigation.js';
import { downloadText } from '../lib/download.js';
import { formatCurrency, formatDate } from '../lib/utils.js';
import '../components/reports/reports.css';

/** Keep loading/error/empty states outside the fully initialized report view. */
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
  const metricCards = [
    {
      title: 'Recorded credits',
      value: report.totals.credits,
      help: 'Includes refunds, discounts, and other positive amounts.',
      Icon: ArrowDownLeft,
      flow: 'credits',
      style: 'bg-emerald-50 text-emerald-800',
    },
    {
      title: 'Recorded debits',
      value: report.totals.debits,
      help: 'Outgoing amounts, before subtracting credits or refunds.',
      Icon: ArrowUpRight,
      flow: 'debits',
      style: 'bg-indigo-50 text-indigo-700',
    },
    {
      title: 'Net activity',
      value: report.totals.net,
      help: 'Credits minus debits. Not your balance or earned income.',
      Icon: Wallet,
      flow: 'activity',
      style: 'bg-slate-100 text-slate-700',
    },
  ] as const;
  return (
    <main className="mx-auto max-w-[1480px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
            Your financial workspace
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Understand the activity. Follow the details. Decide what needs attention.
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
                { value: 'latest', label: `Latest available month · ${latest}` },
                { value: 'year', label: `Latest available year · ${latest.slice(0, 4)}` },
                { value: 'all', label: 'All recorded dates' },
                { value: 'custom', label: 'Custom dates' },
                ...coverage.months.map((month) => ({ value: month, label: month })),
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
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:border-indigo-300 hover:shadow-md"
                title={`${title}: ${formatCurrency(value)}. View underlying transactions.`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-600">{title}</span>
                  <span className={`rounded-xl p-2 ${style}`}>
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Info aria-hidden className="h-4 w-4 shrink-0" />
            <span>
              {report.totals.count.toLocaleString()} reporting items in net activity. Excludes{' '}
              {report.excluded.transfers.toLocaleString()} transfer records and{' '}
              {report.excluded.unmatched.toLocaleString()} unmatched items.
            </span>
            <HelpHint title="How these figures are calculated">
              <p>
                Completed order details replace their parent payment so it is not counted twice.
                Incomplete orders use the payment amount. Dates, amounts, categories, and types
                reflect your current saved corrections.
              </p>
              <p>
                Credits include discounts and refunds, not just earnings. Source-account figures
                describe where reporting items came from, not bank balances. Account transfers and
                unmatched order details are excluded from net activity.
              </p>
              <p>
                Amounts use the app’s existing USD display. The imported model has no currency field
                or conversion rates; this overview must not be used to combine different currencies.
              </p>
            </HelpHint>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <ActivityChart months={report.months} days={report.days} scope={scope} />
            <ReviewQueue report={report} />
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-3">
            <BreakdownPanel
              title="Where outgoing amounts go"
              description="Category view of debits, before credits/refunds. User categories take precedence over statement categories."
              rows={report.categories}
              measure="debits"
              href={(row) =>
                transactionsHref({ ...scope, category: row.key, flow: 'debits', view: 'list' })
              }
            />
            <BreakdownPanel
              title="Top merchants"
              description="Largest outgoing amounts by displayed merchant. Select a merchant to inspect the exact matching items."
              rows={report.merchants}
              measure="debits"
              href={(row) =>
                transactionsHref({ ...scope, merchant: row.key, flow: 'debits', view: 'list' })
              }
            />
            <BreakdownPanel
              title="What the credits represent"
              description="Separate refunds, discounts, payments, and other credits instead of treating them all as earnings."
              rows={report.creditTypes}
              measure="credits"
              color="bg-emerald-600"
              href={(row) =>
                transactionsHref({ ...scope, reason: row.key, flow: 'credits', view: 'list' })
              }
            />
          </div>
          <AccountActivity report={report} transactions={transactions} />
        </>
      )}
      <footer className="border-t border-slate-200 pt-4 text-xs leading-5 text-muted-foreground">
        Read-only reports from the current saved snapshot · USD display, no currency conversion ·
        Figures are recorded activity, not verified balances.{' '}
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
