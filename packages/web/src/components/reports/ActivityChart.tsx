import { Link } from 'react-router-dom';
import type { ReportBreakdown, ReportScope } from '../../lib/financial-reports.js';
import { monthBounds } from '../../lib/financial-reports.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { formatCurrency } from '../../lib/utils.js';
import { ReportPanel } from './ReportPanel.js';

export function ActivityChart({
  months,
  days,
  scope,
}: {
  months: ReportBreakdown[];
  days: ReportBreakdown[];
  scope: ReportScope;
}) {
  // A single active month is more useful as a daily trend than one large bar.
  // Broader histories remain monthly so rendered chart controls stay bounded.
  const daily = months.length === 1;
  const periods = daily ? days : months;
  const unit = daily ? 'day' : 'month';
  const adjective = daily ? 'daily' : 'monthly';
  const displayed = periods.slice(-12);
  const max = Math.max(1, ...displayed.flatMap((month) => [month.credits, month.debits]));
  const href = (month: string) => {
    const bounds = daily ? { from: month, to: month } : monthBounds(month);
    return transactionsHref({
      ...scope,
      from: scope.from > bounds.from ? scope.from : bounds.from,
      to: scope.to && scope.to < bounds.to ? scope.to : bounds.to,
      flow: 'activity',
      view: 'list',
    });
  };
  return (
    <ReportPanel
      title="Money in, money out"
      description="Recorded credits and debits, excluding transfers and unmatched order details. Refunds and discounts are credits, not earned income."
    >
      <div className="mb-4 flex flex-wrap gap-4 text-xs font-medium">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
          Credits
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />
          Debits
        </span>
      </div>
      {periods.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No recorded credits or debits in this scope.
        </p>
      ) : (
        <>
          <div className="space-y-3" aria-label={`${daily ? 'Daily' : 'Monthly'} activity chart`}>
            {displayed.map((month) => (
              <Link
                key={month.key}
                to={href(month.key)}
                title={`${month.key}: credits ${formatCurrency(month.credits)}, debits ${formatCurrency(month.debits)}, net ${formatCurrency(month.net)}. View transactions.`}
                aria-label={`${month.key}: credits ${formatCurrency(month.credits)}, debits ${formatCurrency(month.debits)}. View transactions`}
                className="group grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 rounded-md p-1 hover:bg-slate-50"
              >
                <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-700">
                  {month.key}
                </span>
                <span aria-hidden className="space-y-1">
                  <span
                    className="block h-3 rounded-r bg-emerald-600"
                    style={{
                      width: `${(month.credits / max) * 100}%`,
                      minWidth: month.credits ? 2 : 0,
                    }}
                  />
                  <span
                    className="block h-3 rounded-r bg-indigo-500"
                    style={{
                      width: `${(month.debits / max) * 100}%`,
                      minWidth: month.debits ? 2 : 0,
                    }}
                  />
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {periods.length > 12 ? `Chart shows the latest 12 active ${unit}s in this scope. ` : ''}
            {daily ? 'Days' : 'Months'} with no recorded activity are omitted; missing statements
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
                  {daily ? 'Daily' : 'Monthly'} recorded activity in the selected date range and
                  source account
                </caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="p-2">
                      {daily ? 'Day' : 'Month'}
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Credits
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Debits
                    </th>
                    <th scope="col" className="p-2 text-right">
                      Net activity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((month) => (
                    <tr key={month.key} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="whitespace-nowrap p-2 text-left font-medium">
                        <Link className="text-indigo-700 underline" to={href(month.key)}>
                          {month.key}
                        </Link>
                      </th>
                      <td className="whitespace-nowrap p-2 text-right">
                        {formatCurrency(month.credits)}
                      </td>
                      <td className="whitespace-nowrap p-2 text-right">
                        {formatCurrency(month.debits)}
                      </td>
                      <td className="whitespace-nowrap p-2 text-right">
                        {formatCurrency(month.net)}
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
