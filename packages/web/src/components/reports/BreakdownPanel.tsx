import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { ReportBreakdown } from '../../lib/financial-reports.js';
import { formatCurrency } from '../../lib/utils.js';
import { Button } from '../ui/button.js';
import { ReportPanel } from './ReportPanel.js';

export function BreakdownPanel({
  title,
  description,
  rows,
  measure,
  href,
  color = 'bg-indigo-500',
}: {
  title: string;
  description: string;
  rows: ReportBreakdown[];
  measure: 'credits' | 'debits';
  href: (row: ReportBreakdown) => string;
  color?: string;
}) {
  const [shown, setShown] = useState(6);
  const visible = rows.slice(0, shown);
  const total = rows.reduce((sum, row) => sum + row[measure], 0);
  return (
    <ReportPanel title={title} description={description}>
      {rows.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No matching activity in this scope.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((row) => (
            <Link
              key={row.key}
              to={href(row)}
              className="group block rounded-md text-sm hover:bg-slate-50"
              title={`View ${row.label} transactions`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words font-medium">{row.label}</span>
                <span className="flex shrink-0 items-center gap-1 font-semibold tabular-nums">
                  {formatCurrency(row[measure])}
                  <ArrowUpRight
                    aria-hidden
                    className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-600"
                  />
                </span>
              </div>
              <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${total ? (row[measure] / total) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.count.toLocaleString()} items ·{' '}
                {total ? ((row[measure] / total) * 100).toFixed(1) : 0}% of{' '}
                {measure === 'debits' ? 'outgoing amounts' : 'credits'}
              </p>
            </Link>
          ))}
          {rows.length > shown && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Showing {visible.length} of {rows.length} groups. The report export includes all
                groups.
              </p>
              <Button variant="ghost" size="sm" onClick={() => setShown(shown + 20)}>
                Show more ({rows.length - shown} remaining)
              </Button>
            </div>
          )}
          {shown > 6 && (
            <Button variant="ghost" size="sm" onClick={() => setShown(6)}>
              Show top 6
            </Button>
          )}
        </div>
      )}
    </ReportPanel>
  );
}
