import React from 'react';
import { Button } from './button.js';

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  noun = 'results',
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav
      aria-label={`${noun} pages`}
      className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-3 text-sm"
    >
      <span aria-live="polite" className="text-muted-foreground">
        {total ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, total)} of{' '}
        {total.toLocaleString()} {noun}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page + 1} of {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages - 1}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
