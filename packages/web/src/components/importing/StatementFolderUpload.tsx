/**
 * Browser directory-picker workflow for statement ingestion.
 *
 * Browsers intentionally do not reveal an arbitrary local path. The
 * `webkitdirectory` picker supplies File objects plus safe relative paths,
 * which are enough to preserve the expected account-folder structure.
 *
 * @module
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  UploadCloud,
} from 'lucide-react';
import type { AccountSummary, FolderUploadItem } from '../../api/client.js';
import { useUploadStatementFolder } from '../../api/hooks.js';
import { Button } from '../ui/button.js';

interface StatementFolderUploadProps {
  accounts: AccountSummary[];
}

function relativePathFor(file: File): string {
  const candidate = file.webkitRelativePath || file.name;
  return candidate.replaceAll('\\', '/');
}

export const StatementFolderUpload: React.FC<StatementFolderUploadProps> = ({ accounts }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<FolderUploadItem[]>([]);
  const upload = useUploadStatementFolder();

  const selectedRoot = useMemo(() => items[0]?.relativePath.split('/')[0] ?? null, [items]);
  const selectedAccountFolders = useMemo(() => {
    const folders = new Set<string>();
    for (const item of items) {
      const parts = item.relativePath.split('/');
      const accountFolder = parts.length > 2 ? parts[1] : parts[0];
      if (accountFolder) folders.add(accountFolder);
    }
    return [...folders].sort();
  }, [items]);

  const handleFolderSelected = (fileList: FileList | null) => {
    upload.reset();
    setItems(
      Array.from(fileList ?? []).map((file) => ({
        file,
        relativePath: relativePathFor(file),
      })),
    );
  };

  const reset = () => {
    upload.reset();
    setItems([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const result = upload.data;
  const rebuildFailed = result != null && !result.rebuild.committed;

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-sm dark:border-sky-900/60 dark:from-sky-950/30 dark:via-background dark:to-indigo-950/20">
      <div className="grid gap-6 p-5 md:grid-cols-[1.25fr_0.75fr] md:p-7">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
            <UploadCloud className="h-3.5 w-3.5" />
            Secure browser upload
          </div>
          <h2 className="text-xl font-bold tracking-tight">Bring in a statement folder</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose the local folder that contains one subfolder for each account. MoneyInMotion
            stages every file, skips content already on the server, and rebuilds your financial
            snapshot automatically.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              {items.length > 0 ? 'Choose another folder' : 'Choose statement folder'}
            </Button>
            {items.length > 0 && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={upload.isPending}
                onClick={() => upload.mutate(items)}
              >
                {upload.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="mr-2 h-4 w-4" />
                )}
                {upload.isPending ? 'Uploading & rebuilding…' : 'Upload & build snapshot'}
              </Button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            aria-label="Choose statement folder"
            onChange={(event) => handleFolderSelected(event.target.files)}
            {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
          />

          {items.length > 0 && !upload.data && (
            <div className="mt-4 rounded-xl border border-border/70 bg-background/80 p-4 text-sm">
              <p className="font-semibold">
                {items.length} file{items.length === 1 ? '' : 's'} ready
                {selectedRoot ? ` from ${selectedRoot}` : ''}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Detected folders: {selectedAccountFolders.join(', ') || 'none'}. Nothing is sent
                until you choose “Upload & build snapshot.”
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-background/60">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Expected account folders
          </p>
          {accounts.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {accounts.map((account) => (
                <li key={account.config.accountInfo.id} className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-sky-600" />
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {account.relativeDirectory}
                  </code>
                  <span className="truncate text-muted-foreground">
                    {account.config.accountInfo.title}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Add an account below before uploading statements.
            </p>
          )}
        </div>
      </div>

      {upload.isError && (
        <div className="border-t border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive md:px-7">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Upload could not be completed
          </p>
          <p className="mt-1">
            {upload.error instanceof Error ? upload.error.message : 'Unknown upload error'}
          </p>
        </div>
      )}

      {result && (
        <div
          className={
            rebuildFailed
              ? 'border-t border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100 md:px-7'
              : 'border-t border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100 md:px-7'
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                {rebuildFailed ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {rebuildFailed ? 'Files staged; previous snapshot kept safe' : 'Snapshot is ready'}
              </p>
              <p className="mt-1 text-sm opacity-90">
                {result.staging.promotedCount} new, {result.staging.duplicateCount} already present,{' '}
                {result.staging.rejectedCount} rejected
                {result.rebuild.committed
                  ? `; ${result.rebuild.totalTransactions} transactions rebuilt with ${result.rebuild.appliedEdits} saved rules.`
                  : `; ${result.rebuild.failedFiles.length} statement files need attention before a safe rebuild.`}
              </p>
              <p className="mt-1 text-xs opacity-75">
                Audit manifest: <code>{result.staging.manifestPath}</code>
              </p>
              {result.rebuild.migratedEditTargets > 0 && (
                <p className="mt-1 text-xs opacity-75">
                  Preserved {result.rebuild.migratedEditTargets} legacy rule target
                  {result.rebuild.migratedEditTargets === 1 ? '' : 's'} by migrating transaction
                  IDs.
                </p>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Start another upload
            </Button>
          </div>

          {(result.staging.rejectedCount > 0 ||
            rebuildFailed ||
            result.rebuild.unresolvedEditTargets > 0) && (
            <details className="mt-3 rounded-lg border border-current/15 bg-background/40 p-3 text-xs">
              <summary className="cursor-pointer font-semibold">Review issues</summary>
              <ul className="mt-2 space-y-1.5">
                {result.staging.files
                  .filter((file) => file.status === 'rejected')
                  .map((file) => (
                    <li key={file.relativePath}>
                      <code>{file.relativePath}</code> — {file.message}
                    </li>
                  ))}
                {result.rebuild.failedFiles.map((file) => (
                  <li key={file.path}>
                    <code>{file.path}</code> — {file.error}
                  </li>
                ))}
                {result.rebuild.unresolvedEditTargets > 0 && (
                  <li>
                    {result.rebuild.unresolvedEditTargets} legacy exact-ID rule target
                    {result.rebuild.unresolvedEditTargets === 1 ? '' : 's'} no longer identify a
                    transaction and were retained unchanged in Rules.
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
};

StatementFolderUpload.displayName = 'StatementFolderUpload';
