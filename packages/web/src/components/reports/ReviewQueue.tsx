import { Link } from 'react-router-dom';
import { AlertTriangle, Flag, Tags, Unlink, ArrowRight } from 'lucide-react';
import type { FinancialReport } from '../../lib/financial-reports.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { ReportPanel } from './ReportPanel.js';

export function ReviewQueue({ report }: { report: FinancialReport }) {
  const items = [
    {
      key: 'flagged',
      label: 'Marked for review',
      description: 'Your reminders, including marks on parent payments.',
      Icon: Flag,
      basis: 'records',
    },
    {
      key: 'uncategorized',
      label: 'Needs a category',
      description: 'Reporting items with neither a user nor statement category.',
      Icon: Tags,
      basis: 'reporting',
    },
    {
      key: 'unmatched',
      label: 'Unmatched order details',
      description: 'Order records without a linked payment; excluded from net activity.',
      Icon: Unlink,
      basis: 'records',
    },
    {
      key: 'incomplete',
      label: 'Incomplete payment details',
      description: 'Linked order amounts do not cover the payment; the payment is counted once.',
      Icon: AlertTriangle,
      basis: 'records',
    },
  ] as const;
  return (
    <ReportPanel
      title="Your review queue"
      description="Counts follow the selected dates and source account. Flags and matching queues count source records, including hidden parent/detail records; the category queue counts reporting items. They can differ from the reporting totals above. A flag alone never changes totals."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map(({ key, label, description, Icon, basis }) => (
          <Link
            key={key}
            to={transactionsHref({ ...report.scope, review: key, basis, view: 'list' })}
            className="group flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
            title={`${label}: ${report.review[key]}. ${description}`}
          >
            <span className="rounded-lg bg-amber-50 p-2 text-amber-800">
              <Icon aria-hidden className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-semibold tabular-nums">
                {report.review[key].toLocaleString()}
              </span>
              <span className="block text-sm font-medium">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {description}
              </span>
            </span>
            <ArrowRight
              aria-hidden
              className="mt-1 h-4 w-4 shrink-0 text-slate-500 group-hover:text-indigo-700"
            />
          </Link>
        ))}
      </div>
    </ReportPanel>
  );
}
