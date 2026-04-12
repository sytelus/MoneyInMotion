/**
 * Year/month tree navigator for filtering transactions by time period.
 *
 * Displays an accordion of years, each expandable to show its months.
 * Clicking a month filters the transaction list. Ported from the legacy
 * `txNavigationView.js`.
 *
 * @module
 */

import React, { useMemo } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, Download } from 'lucide-react';
import { cn, getMonthName } from '../../lib/utils.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { useScanStatements } from '../../api/hooks.js';
import { Button } from '../ui/button.js';

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
 * Sidebar navigator that presents an accordion of years, each containing
 * clickable month entries to filter the transaction list.
 */
export const YearMonthNav: React.FC = () => {
  const transactions = useTransactionsStore((s) => s.transactions);
  const selectedYear = useTransactionsStore((s) => s.selectedYear);
  const selectedMonth = useTransactionsStore((s) => s.selectedMonth);
  const selectYearMonth = useTransactionsStore((s) => s.selectYearMonth);

  const yearMonthTree = useMemo(() => {
    if (!transactions) return [];
    return buildYearMonthTree(transactions.topLevelTransactions);
  }, [transactions]);

  const scanMutation = useScanStatements();

  if (yearMonthTree.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-medium">No transactions yet.</p>
        <p className="text-xs">Import bank statements to see your transactions here.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => scanMutation.mutate(undefined)}
          disabled={scanMutation.isPending}
        >
          <Download className="h-4 w-4 mr-1.5" />
          {scanMutation.isPending ? 'Importing...' : 'Import'}
        </Button>
      </div>
    );
  }

  return (
    <nav aria-label="Year and month navigation" className="py-2">
      <Accordion.Root
        type="multiple"
        defaultValue={yearMonthTree.length > 0 ? [yearMonthTree[0]!.yearString] : []}
      >
        {yearMonthTree.map((yearEntry) => (
          <Accordion.Item key={yearEntry.yearString} value={yearEntry.yearString}>
            <Accordion.Header asChild>
              <Accordion.Trigger
                className={cn(
                  'flex w-full items-center justify-between px-4 py-2 text-sm font-semibold hover:bg-accent transition-colors group',
                  selectedYear === yearEntry.yearString && 'text-primary',
                )}
              >
                <span>{yearEntry.yearString}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <ul className="pl-4 py-1">
                {yearEntry.months.map((monthEntry) => {
                  const isActive =
                    selectedYear === yearEntry.yearString &&
                    selectedMonth === monthEntry.monthString;
                  return (
                    <li key={monthEntry.monthString}>
                      <button
                        className={cn(
                          'w-full text-left px-4 py-1.5 text-sm rounded-md transition-colors hover:bg-accent',
                          isActive && 'bg-accent font-medium text-accent-foreground',
                        )}
                        onClick={() =>
                          selectYearMonth(yearEntry.yearString, monthEntry.monthString)
                        }
                      >
                        {monthEntry.monthName}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </nav>
  );
};

YearMonthNav.displayName = 'YearMonthNav';
