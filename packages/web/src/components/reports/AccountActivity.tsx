import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import type { Transactions } from '@moneyinmotion/core';
import type { FinancialReport } from '../../lib/financial-reports.js';
import { reportDay } from '../../lib/financial-reports.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { formatCurrency, formatDate } from '../../lib/utils.js';
import { Button } from '../ui/button.js';
import { ReportPanel } from './ReportPanel.js';

export function AccountActivity({
  report,
  transactions,
}: {
  report: FinancialReport;
  transactions: Transactions;
}) {
  const [showTransfers, setShowTransfers] = useState(5);
  const title = (id: string) => transactions.getAccountInfo(id).title || id;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ReportPanel
        title="Activity by source account"
        description="Reporting-item attribution, not balances or bank cash movement. Order details can belong to Amazon or PayPal while their parent payment belongs to a card."
      >
        {report.accounts.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No account activity in this scope.</p>
        ) : (
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Source account activity"
            tabIndex={0}
          >
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">
                Recorded credits, debits, and net activity by source account
              </caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 text-left font-medium">
                    Source account
                  </th>
                  <th scope="col" className="p-2 text-right font-medium">
                    Credits
                  </th>
                  <th scope="col" className="p-2 text-right font-medium">
                    Debits
                  </th>
                  <th scope="col" className="py-2 pl-2 text-right font-medium">
                    Net
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.accounts.map((account) => (
                  <tr key={account.key} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="min-w-28 py-3 pr-3 text-left font-medium">
                      <Link
                        className="text-indigo-700 underline decoration-indigo-200 underline-offset-4 hover:decoration-indigo-600"
                        to={transactionsHref({
                          ...report.scope,
                          account: account.key,
                          flow: 'activity',
                          view: 'list',
                        })}
                      >
                        {account.label}
                      </Link>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {account.count.toLocaleString()} items
                      </span>
                    </th>
                    <td className="whitespace-nowrap p-2 text-right">
                      {formatCurrency(account.credits)}
                    </td>
                    <td className="whitespace-nowrap p-2 text-right">
                      {formatCurrency(account.debits)}
                    </td>
                    <td className="whitespace-nowrap py-2 pl-2 text-right font-medium">
                      {formatCurrency(account.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportPanel>
      <ReportPanel
        title="Linked account transfers"
        description="Existing matched pairs, counted once. Included when either side falls in this scope; a counterpart may be outside the dates or source account."
      >
        {report.transfers.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">
            <ArrowLeftRight aria-hidden className="mb-2 h-6 w-6 text-slate-400" />
            <p>No linked transfers in this scope.</p>
            <p className="mt-1 text-xs">
              This does not prove there were no transfers. Inspect statement activity to check
              unlinked records.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {report.transfers.length.toLocaleString()} linked pairs · pairs are excluded from net
              activity when classified as transfers
            </p>
            {report.transfers.slice(0, showTransfers).map((pair) => (
              <Link
                key={pair.id}
                to={transactionsHref({
                  ids: [pair.left.id, pair.right.id],
                  basis: 'records',
                  view: 'list',
                })}
                className="block rounded-xl border border-slate-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/30"
                title="Inspect both linked source records"
              >
                <span className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-medium">
                    <span className="break-words">{title(pair.fromAccount)}</span>
                    {pair.inconsistent ? (
                      <ArrowLeftRight aria-label="Linked accounts" className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowRight aria-label="to" className="h-3.5 w-3.5" />
                    )}
                    <span className="break-words">{title(pair.toAccount)}</span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {pair.inconsistent ? 'Review amounts' : formatCurrency(pair.amount)}
                  </span>
                </span>
                <span className="mt-2 block text-xs text-muted-foreground">
                  {formatDate(reportDay(pair.left))} / {formatDate(reportDay(pair.right))} · View
                  both records
                </span>
                {pair.outsidePeriod && (
                  <span className="mt-1 block text-xs text-amber-800">
                    One side is outside the selected dates.
                  </span>
                )}
                {pair.inconsistent && (
                  <span className="mt-1 flex items-center gap-1 text-xs text-amber-800">
                    <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
                    Current amounts or links need review; no direction or total is assumed.
                  </span>
                )}
              </Link>
            ))}
            {report.transfers.length > showTransfers && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTransfers(showTransfers + 20)}
              >
                Show more transfer pairs
              </Button>
            )}
            {showTransfers > 5 && (
              <Button variant="ghost" size="sm" onClick={() => setShowTransfers(5)}>
                Show latest 5
              </Button>
            )}
          </div>
        )}
      </ReportPanel>
    </div>
  );
}
