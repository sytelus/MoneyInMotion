import React, { useDeferredValue, useMemo, useState } from 'react';
import type { Transactions } from '@moneyinmotion/core';
import { Search, X } from 'lucide-react';
import { Input } from '../ui/input.js';
import { Button } from '../ui/button.js';
import { Pagination } from '../ui/pagination.js';
import { formatCurrency, formatDate } from '../../lib/utils.js';

/** Human-readable exact-record targeting. Unavailable legacy IDs are retained until removed. */
export function RuleTargetPicker({
  transactions,
  ids,
  onChange,
}: {
  transactions: Transactions;
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.toLowerCase().trim());
  const [page, setPage] = useState(0);
  const selected = new Set(ids.filter(Boolean));
  const [showSelected, setShowSelected] = useState(selected.size <= 5);
  const [browsing, setBrowsing] = useState(selected.size === 0);
  const matches = useMemo(
    () =>
      [...transactions.allParentChildTransactions].filter((tx) =>
        `${tx.displayEntityNameNormalized} ${tx.entityName} ${tx.accountId} ${transactions.getAccountInfo(tx.accountId).title} ${tx.correctedTransactionDate} ${tx.id}`
          .toLowerCase()
          .includes(search),
      ),
    [transactions, search],
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matches.length / 10) - 1));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">{selected.size} specific records selected</span>
        <Button variant="ghost" size="sm" onClick={() => setShowSelected(!showSelected)}>
          {showSelected ? 'Hide selected targets' : 'Review selected targets'}
        </Button>
      </div>
      {showSelected && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-border">
          {selected.size === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Choose records below. No records are selected yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {[...selected].map((id) => {
                const tx = transactions.getTransaction(id);
                return (
                  <li key={id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="min-w-0 flex-1 break-words">
                      {tx
                        ? `${tx.displayEntityNameNormalized} · ${formatDate(tx.correctedTransactionDate)} · ${formatCurrency(tx.correctedAmount)}`
                        : `Unavailable record · ${id}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove target ${tx?.displayEntityNameNormalized ?? id}`}
                      onClick={() => onChange([...selected].filter((value) => value !== id))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        aria-expanded={browsing}
        onClick={() => setBrowsing(!browsing)}
      >
        {browsing ? 'Hide transaction search' : 'Find or change target records'}
      </Button>
      {browsing && (
        <>
          <label className="block text-xs font-medium">
            <span className="mb-1 flex items-center gap-1">
              <Search className="h-3.5 w-3.5" />
              Find transaction targets
            </span>
            <Input
              value={query}
              placeholder="Merchant, date, account, or transaction ID"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <ul className="max-h-52 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {matches.slice(currentPage * 10, (currentPage + 1) * 10).map((tx) => (
              <li key={tx.id}>
                <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-xs hover:bg-muted/50">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    checked={selected.has(tx.id)}
                    disabled={!selected.has(tx.id) && selected.size >= 1000}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(tx.id)) next.delete(tx.id);
                      else next.add(tx.id);
                      onChange([...next]);
                    }}
                  />
                  <span className="min-w-0 break-words">
                    <span className="font-medium">{tx.displayEntityNameNormalized}</span>
                    <span className="block text-muted-foreground">
                      {formatDate(tx.correctedTransactionDate)} ·{' '}
                      {transactions.getAccountInfo(tx.accountId).title || tx.accountId} ·{' '}
                      {formatCurrency(tx.correctedAmount)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {!matches.length && (
              <li className="p-3 text-sm text-muted-foreground">
                No matching records. Try another merchant, date, or account.
              </li>
            )}
          </ul>
          <Pagination
            page={currentPage}
            pageSize={10}
            total={matches.length}
            onChange={setPage}
            noun="records"
          />
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Includes source, parent, and item records. These are exact targets, not a repeating merchant
        automation. Up to 1,000 targets per edit.
      </p>
    </div>
  );
}
