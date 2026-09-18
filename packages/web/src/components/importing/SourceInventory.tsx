import React, { useDeferredValue, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, FileText, Search } from 'lucide-react';
import type { Transactions } from '@moneyinmotion/core';
import { sourceInventory, formatEvidenceDate } from '../../lib/import-evidence.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { Pagination } from '../ui/pagination.js';
import { HelpHint } from '../ui/help-hint.js';
import { buttonClassName } from '../ui/button.js';

const PAGE_SIZE = 25;

/** Browse source records rather than summing parent/child records as spending. */
export function SourceInventory({ transactions }: { transactions: Transactions }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const update = (key: string, value: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key !== 'sourcePage') next.delete('sourcePage');
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };
  const query = searchParams.get('sourceSearch') ?? '';
  const setQuery = (value: string) => update('sourceSearch', value);
  const search = useDeferredValue(query);
  const account = searchParams.get('sourceAccount') ?? '';
  const setAccount = (value: string) => update('sourceAccount', value);
  const sort = searchParams.get('sourceSort') ?? 'path';
  const setSort = (value: string) => update('sourceSort', value);
  const requestedPage = Number(searchParams.get('sourcePage') ?? '0');
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
  const setPage = (value: number) => update('sourcePage', value ? String(value) : '');
  const heading = useRef<HTMLDivElement>(null);
  const sources = useMemo(() => sourceInventory(transactions), [transactions]);
  const accounts = useMemo(
    () => [...new Set(sources.flatMap((item) => item.accountIds))].sort(),
    [sources],
  );
  const filtered = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return sources
      .filter(
        (item) =>
          (!account || item.accountIds.includes(account)) &&
          words.every((word) =>
            `${item.source.portableAddress} ${item.accountIds.join(' ')} ${item.from} ${item.to}`
              .toLowerCase()
              .includes(word),
          ),
      )
      .sort((a, b) =>
        sort === 'recent'
          ? (b.to ?? '').localeCompare(a.to ?? '')
          : sort === 'records'
            ? b.recordCount - a.recordCount
            : a.source.portableAddress.localeCompare(b.source.portableAddress),
      );
  }, [sources, search, account, sort]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));

  return (
    <section className="space-y-5" aria-label="Statement source inventory">
      <div ref={heading} className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Statement sources</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Find a file, then inspect the records it contributes to your current snapshot.
          </p>
        </div>
        <HelpHint title="Source records and file dates">
          <p>
            Source counts include parent payments and order details. They are useful for tracing
            data, but must not be added together as spending totals.
          </p>
          <p>
            File timestamps come from the filesystem and may change when files are copied. They are
            not verified first-import times. Upload history separately records browser receipt
            times.
          </p>
          <p>
            This inventory covers files referenced by current transaction records, not every file on
            disk or every historical import attempt.
          </p>
        </HelpHint>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_190px]">
        <label className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Search statement sources</span>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search files, accounts, or dates…"
            className="pl-9"
          />
        </label>
        <Select
          aria-label="Source account"
          value={account}
          onChange={(event) => {
            setAccount(event.target.value);
          }}
          options={[
            { value: '', label: 'All accounts' },
            ...accounts.map((id) => ({
              value: id,
              label: transactions.getAccountInfo(id).title || id,
            })),
          ]}
        />
        <Select
          aria-label="Sort statement sources"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
          }}
          options={[
            { value: 'path', label: 'Filename A–Z' },
            { value: 'recent', label: 'Latest transaction first' },
            { value: 'records', label: 'Most records first' },
          ]}
        />
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-background">
        {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((item) => (
          <article key={item.source.id} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 gap-3">
                <FileText className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h3 className="break-all text-sm font-semibold">{item.source.portableAddress}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.accountIds
                      .map((id) => transactions.getAccountInfo(id).title || id)
                      .join(', ')}{' '}
                    · {item.source.format?.toUpperCase() || 'Statement'} ·{' '}
                    {item.recordCount.toLocaleString()} source records
                  </p>
                  <p className="mt-2 text-sm">
                    Transaction dates: {item.from} → {item.to}{' '}
                    <span className="text-xs text-muted-foreground">UTC</span>
                  </p>
                </div>
              </div>
              <Link
                to={transactionsHref({ source: item.source.id, basis: 'records', view: 'list' })}
                className={buttonClassName({ variant: 'outline', size: 'sm' })}
              >
                Inspect records
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Link>
            </div>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">File evidence</summary>
              <dl className="mt-2 grid gap-1 break-all sm:grid-cols-[150px_1fr]">
                <dt>Filesystem created</dt>
                <dd>{formatEvidenceDate(item.source.createDate)}</dd>
                <dt>Filesystem modified</dt>
                <dd>{formatEvidenceDate(item.source.updateDate)}</dd>
                <dt>Source identifier</dt>
                <dd className="select-all">{item.source.id}</dd>
              </dl>
            </details>
          </article>
        ))}
        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {sources.length === 0
              ? 'No statement sources in the current snapshot. Upload statements or build from existing files.'
              : 'No sources match these filters. Try another filename or account.'}
          </p>
        )}
      </div>
      <Pagination
        page={currentPage}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        noun="sources"
        onChange={(next) => {
          setPage(next);
          heading.current?.scrollIntoView({ block: 'start' });
        }}
      />
    </section>
  );
}
