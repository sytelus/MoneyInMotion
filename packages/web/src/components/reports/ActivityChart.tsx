import { Link } from 'react-router-dom';
import type { CashFlowPeriod, ReportScope } from '../../lib/financial-reports.js';
import { monthBounds } from '../../lib/financial-reports.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { formatCurrency } from '../../lib/utils.js';
import { ReportPanel } from './ReportPanel.js';

export function ActivityChart({
  months,
  days,
  scope,
}: {
  months: CashFlowPeriod[];
  days: CashFlowPeriod[];
  scope: ReportScope;
}) {
  // A single active month is more useful as a daily trend than one large bar.
  // Broader histories remain monthly so rendered chart controls stay bounded.
  const daily = months.length === 1;
  const periods = daily ? days : months;
  const unit = daily ? 'day' : 'month';
  const adjective = daily ? 'daily' : 'monthly';
  const displayed = periods.slice(-12);
  const max = Math.max(1, ...displayed.flatMap((period) => [period.income, period.spending]));
  const width = (value: number) => ({
    width: `${(Math.max(value, 0) / max) * 100}%`,
    minWidth: value > 0 ? 2 : 0,
  });
  const href = (key: string) => {
    const bounds = daily ? { from: key, to: key } : monthBounds(key);
    return transactionsHref({
      ...scope,
      from: scope.from > bounds.from ? scope.from : bounds.from,
      to: scope.to && scope.to < bounds.to ? scope.to : bounds.to,
      flow: 'cashflow',
      view: 'list',
    });
  };
  return (
    <ReportPanel
      title="Income and spending"
      description="Spending is net of refunds and discounts. Transfers, unmatched order details, and credits awaiting your income decision are left out."
    >
      <div className="mb-4 flex flex-wrap gap-4 text-xs font-medium">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
          Income
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />
          Spending
        </span>
      </div>
      {periods.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No income or spending in this scope.
        </p>
      ) : (
        <>
          <div className="space-y-3" aria-label={`${daily ? 'Daily' : 'Monthly'} cash-flow chart`}>
            {displayed.map((period) => (
              <Link
                key={period.key}
                to={href(period.key)}
                title={`${period.key}: income ${formatCurrency(period.income)}, spending ${formatCurrency(period.spending)}, savings ${formatCurrency(period.savings)}. View transactions.`}
                aria-label={`${period.key}: income ${formatCurrency(period.income)}, spending ${formatCurrency(period.spending)}. View transactions`}
                className="group grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 rounded-md p-1 hover:bg-slate-50"
              >
                <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-700">
                  {period.key}
                </span>
                <span aria-hidden className="space-y-1">
                  <span
                    className="block h-3 rounded-r bg-emerald-600"
                    style={width(period.income)}
                  />
                  <span
                    className="block h-3 rounded-r bg-indigo-500"
                    style={width(period.spending)}
                  />
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {periods.length > 12 ? `Chart shows the latest 12 active ${unit}s in this scope. ` : ''}
            {daily ? 'Days' : 'Months'} with no income or spending are omitted; missing statements
            cannot be inferred. Select a {unit} to inspect its transactions.
          </p>
          <details className="mt-4 rounded-lg border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              Exact {adjective} figures ({periods.length})
            </summary>
            <div
              className="overflow-x-auto p-3"
              role="region"
              aria-label={`${daily ? 'Daily' : 'Monthly'} figures`}
              tabIndex={0}
            >
              <table className="w-full text-xs tabular-nums">
                <caption className="sr-only">
                  {daily ? 'Daily' : 'Monthly'} income, spending, and savings in the selected date
                  range and source account
                </caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="p-2">
                      {daily ? 'Day' : 'Month'}
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Income
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Spending
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Savings
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr key={period.key} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="whitespace-nowrap p-2 text-left font-medium">
                        <Link className="text-indigo-700 underline" to={href(period.key)}>
                          {period.key}
                        </Link>
                      </th>
                      <td className="whitespace-nowrap p-2 text-right">
                        {formatCurrency(period.income)}
                      </td>
                      <td className="whitespace-nowrap p-2 text-right">
                        {formatCurrency(period.spending)}
                      </td>
                      <td className="whitespace-nowrap p-2 text-right">
                        {formatCurrency(period.savings)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </ReportPanel>
  );
}
