import React, { useDeferredValue, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CopyCheck, Download, History, Search } from 'lucide-react';
import {
  getUploadHistory,
  ImportApiError,
  type UploadBatch,
  type UploadHistoryFilters,
} from '../../api/imports.js';
import { formatEvidenceDate } from '../../lib/import-evidence.js';
import { Input } from '../ui/input.js';
import { Select } from '../ui/select.js';
import { Button } from '../ui/button.js';
import { Pagination } from '../ui/pagination.js';
import { Notice } from '../ui/notice.js';

function downloadReceipt(batch: UploadBatch) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(batch, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `upload-receipt-${batch.batchId}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Durable staging evidence only; rebuild outcomes were not recorded historically. */
export function UploadHistory() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState<UploadHistoryFilters['status']>('all');
  const [page, setPage] = useState(0);
  const heading = useRef<HTMLDivElement>(null);
  const history = useQuery({
    queryKey: ['upload-history', page, deferredSearch, status],
    queryFn: () => getUploadHistory({ page, search: deferredSearch, status }),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  return (
    <section className="space-y-5" aria-label="Upload history">
      <div ref={heading}>
        <h2 className="text-xl font-semibold tracking-tight">Upload receipts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          See what arrived, what was already present, and which files were rejected.
        </p>
      </div>
      <Notice tone="info" title="Receipts confirm file handling, not a completed rebuild">
        <p className="mt-1">
          Historical rebuild outcomes and original first-import times were not saved. Files copied
          directly to the server have no browser upload receipt; use Statement sources to trace
          their current records.
        </p>
      </Notice>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Search upload receipts</span>
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search filename, account, receipt…"
          />
        </label>
        <Select
          aria-label="Upload receipt status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as UploadHistoryFilters['status']);
            setPage(0);
          }}
          options={[
            { value: 'all', label: 'All file outcomes' },
            { value: 'promoted', label: 'Includes new files' },
            { value: 'duplicate', label: 'Includes duplicates' },
            { value: 'rejected', label: 'Includes rejected files' },
          ]}
        />
      </div>
      {history.isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading saved receipts…
        </p>
      )}
      {history.error && (
        <Notice
          tone={
            history.error instanceof ImportApiError && history.error.status === 404
              ? 'info'
              : 'error'
          }
          role="alert"
          title={
            history.error instanceof ImportApiError && history.error.status === 404
              ? 'Restart MoneyInMotion to finish this update'
              : 'Upload receipts could not be loaded'
          }
          actions={
            <Button variant="outline" size="sm" onClick={() => void history.refetch()}>
              Try again
            </Button>
          }
        >
          {history.error instanceof ImportApiError && history.error.status === 404
            ? 'This app update is only partially loaded, so upload receipts are not ready yet. Restart MoneyInMotion with ./run.sh, then try again. Your statements and current snapshot are unchanged.'
            : 'MoneyInMotion could not read saved upload receipts. Statement files and the current snapshot were not changed. Check that the server is running, then try again.'}
        </Notice>
      )}
      {history.data != null && (
        <>
          {history.data.unreadableCount > 0 && (
            <Notice tone="warning" role="alert" title="Some saved receipts need attention">
              {history.data.unreadableCount} upload receipt
              {history.data.unreadableCount === 1 ? '' : 's'} could not be read or validated. Their
              files were not changed. Check the staging folder for incomplete or invalid manifests.
            </Notice>
          )}
          <div className="space-y-3">
            {history.data.entries.map((batch) => {
              const count = (value: string) =>
                batch.files.filter((file) => file.status === value).length;
              return (
                <article
                  key={batch.batchId}
                  className="rounded-xl border border-border bg-background p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <History className="mt-1 h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <h3 className="font-semibold">{formatEvidenceDate(batch.stagedAt)}</h3>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          Receipt {batch.batchId} · {batch.sourceFileCount} files received
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => downloadReceipt(batch)}>
                      <Download className="mr-1.5 h-4 w-4" />
                      Download receipt
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {count('promoted')} new files stored
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                      <CopyCheck className="h-3.5 w-3.5" />
                      {count('duplicate')} already present
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {count('rejected')} rejected
                    </span>
                  </div>
                  <details className="mt-4 border-t border-border pt-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                      Inspect file results ({batch.files.length})
                    </summary>
                    <ul className="mt-3 max-h-96 space-y-3 overflow-auto">
                      {batch.files.map((file) => (
                        <li key={file.relativePath} className="rounded-lg bg-muted/40 p-3 text-xs">
                          <p className="break-all font-semibold">{file.relativePath}</p>
                          <p className="mt-1">
                            {file.status === 'promoted'
                              ? 'New file stored'
                              : file.status === 'duplicate'
                                ? 'Already present'
                                : 'Rejected'}{' '}
                            · {(file.sizeBytes / 1024).toFixed(1)} KiB · {file.message}
                          </p>
                          {(file.destinationPath || file.duplicateOf) && (
                            <p className="mt-1 break-all text-muted-foreground">
                              Stored source: {file.destinationPath || file.duplicateOf}
                            </p>
                          )}
                          <details className="mt-2 text-muted-foreground">
                            <summary className="cursor-pointer">Content checksum (SHA-256)</summary>
                            <code className="mt-1 block break-all select-all">{file.sha256}</code>
                          </details>
                        </li>
                      ))}
                    </ul>
                  </details>
                </article>
              );
            })}
            {history.data.total === 0 && (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {history.data.totalRecorded === 0
                  ? 'No browser upload receipts yet. Existing statements may have been copied directly or imported before receipts were recorded.'
                  : 'No receipts match these filters.'}
              </p>
            )}
          </div>
          <Pagination
            page={history.data.page}
            pageSize={history.data.pageSize}
            total={history.data.total}
            noun="upload receipts"
            onChange={(next) => {
              setPage(next);
              heading.current?.scrollIntoView({ block: 'start' });
            }}
          />
        </>
      )}
    </section>
  );
}
