/**
 * Year/month tree navigator for filtering transactions by time period.
 *
 * Displays native disclosure sections for years and their months.
 * Clicking a month filters the transaction list. Ported from the legacy
 * `txNavigationView.js`.
 *
 * @module
 */

import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn, getMonthName } from '../../lib/utils.js';
import { useTransactionsStore } from '../../store/transactions-store.js';

interface MonthEntry {
  monthString: string;
  monthName: string;
}

interface YearEntry {
  yearString: string;
  months: MonthEntry[];
}

/**
 * Build a year/month tree from the filtered transaction list.
 */
function buildYearMonthTree(
  transactions: Iterable<{ correctedTransactionDate: string }>,
): YearEntry[] {
  const yearMap = new Map<string, Set<string>>();

  for (const tx of transactions) {
    // correctedTransactionDate is an ISO-8601 UTC string. Use UTC accessors
    // so the navigation tree and `transactions-store.getFilteredTransactions`
    // agree on which month a transaction belongs to regardless of the
    // viewer's local timezone.
    const date = new Date(tx.correctedTransactionDate);
    const year = date.getUTCFullYear().toString();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');

    let months = yearMap.get(year);
    if (!months) {
      months = new Set();
      yearMap.set(year, months);
    }
    months.add(month);
  }

  const years: YearEntry[] = [];
  for (const [yearString, monthSet] of yearMap) {
    const months = [...monthSet]
      .sort((a, b) => b.localeCompare(a)) // descending
      .map((m) => ({
        monthString: m,
        monthName: getMonthName(parseInt(m, 10)),
      }));
    years.push({ yearString, months });
  }

  // Sort years descending (most recent first)
  years.sort((a, b) => b.yearString.localeCompare(a.yearString));

  return years;
}

/**
 * Sidebar navigator that presents expandable years, each containing
 * clickable month entries to filter the transaction list.
 */
export const YearMonthNav: React.FC = () => {
  const transactions = useTransactionsStore((s) => s.transactions);
  const reporting = useTransactionsStore((s) => s.reporting);
  const selectedYear = useTransactionsStore((s) => s.selectedYear);
  const selectedMonth = useTransactionsStore((s) => s.selectedMonth);
  const selectYearMonth = useTransactionsStore((s) => s.selectYearMonth);

  const yearMonthTree = useMemo(() => {
    if (!transactions) return [];
    return buildYearMonthTree(reporting);
  }, [transactions, reporting]);

  if (yearMonthTree.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-medium">No transactions yet.</p>
        <p className="text-xs">Import bank statements to see your transactions here.</p>
      </div>
    );
  }

  return (
    <nav aria-label="Year and month navigation" className="py-2">
      <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Reporting period
      </p>
      <button
        type="button"
        className="w-full px-4 py-2 text-left text-sm font-medium hover:bg-accent"
        aria-current={!selectedYear ? 'date' : undefined}
        onClick={() => selectYearMonth(null, null)}
      >
        All dates
      </button>
      {yearMonthTree.map((yearEntry) => (
        <details
          key={yearEntry.yearString}
          open={selectedYear === yearEntry.yearString || undefined}
          className="group/year"
        >
          <summary
            className={cn(
              'flex w-full cursor-pointer list-none items-center justify-between px-4 py-2 text-sm font-semibold hover:bg-accent transition-colors',
              selectedYear === yearEntry.yearString && 'text-primary',
            )}
          >
            <span>{yearEntry.yearString}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/year:rotate-180" />
          </summary>
          <ul className="pl-4 py-1">
            <li>
              <button
                type="button"
                className="w-full px-4 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => selectYearMonth(yearEntry.yearString, null)}
              >
                All of {yearEntry.yearString}
              </button>
            </li>
            {yearEntry.months.map((monthEntry) => {
              const isActive =
                selectedYear === yearEntry.yearString && selectedMonth === monthEntry.monthString;
              return (
                <li key={monthEntry.monthString}>
                  <button
                    type="button"
                    aria-current={isActive ? 'date' : undefined}
                    className={cn(
                      'w-full text-left px-4 py-1.5 text-sm rounded-md transition-colors hover:bg-accent',
                      isActive && 'bg-accent font-medium text-accent-foreground',
                    )}
                    onClick={() => selectYearMonth(yearEntry.yearString, monthEntry.monthString)}
                  >
                    {monthEntry.monthName}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </nav>
  );
};

YearMonthNav.displayName = 'YearMonthNav';
