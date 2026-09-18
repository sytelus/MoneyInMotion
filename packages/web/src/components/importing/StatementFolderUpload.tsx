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
import { Link } from 'react-router-dom';
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
import { Button, buttonClassName } from '../ui/button.js';
import { MissingRuleTargets } from '../editing/MissingRuleTargets.js';
import { preflightFolder } from '../../lib/import-preflight.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';

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
  const folderPreflight = useMemo(() => preflightFolder(items, accounts), [items, accounts]);
  const folderNamesValid = items.length > 0 && folderPreflight.unmatchedPaths.length === 0;
  const canUpload =
    folderNamesValid && folderPreflight.errors.length === 0 && folderPreflight.eligible.length > 0;

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
            1. Choose · 2. Check · 3. Import
          </div>
          <h2 className="text-xl font-bold tracking-tight">Bring in a statement folder</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose an account folder, or a folder containing several account folders. Check the
            selection before sending any files. Matching statement files are stored, duplicate
            content is skipped, and your snapshot is rebuilt with saved rules.
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
                disabled={upload.isPending || !canUpload}
                onClick={() => upload.mutate(folderPreflight.eligible)}
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
                {folderPreflight.eligible.length} file
                {folderPreflight.eligible.length === 1 ? '' : 's'} ready
                {selectedRoot ? ` from ${selectedRoot}` : ''}
              </p>
              {folderNamesValid ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Matched account folders: {folderPreflight.selectedFolders.join(', ')}. Nothing is
                  sent until you choose “Upload & build snapshot.”
                </p>
              ) : (
                <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                  <p className="font-semibold">Fix the selected folder names before uploading.</p>
                  <p className="mt-1 text-xs">
                    These paths do not match a configured account folder:{' '}
                    {folderPreflight.unmatchedPaths.join(', ')}
                  </p>
                  <p className="mt-1 text-xs">
                    Expected:{' '}
                    {accounts.map((account) => account.relativeDirectory).join(', ') ||
                      'add an account first'}
                    . No files have been uploaded.
                  </p>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {(folderPreflight.totalBytes / 1024 / 1024).toFixed(2)} MiB selected for upload.
                Limits: 200 files, 20 MiB per file, 100 MiB per request.
              </p>
              {folderPreflight.errors.length > 0 && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
                >
                  <p className="font-medium">
                    Fix these checks before uploading. Nothing has been sent.
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {folderPreflight.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {folderPreflight.skipped.length > 0 && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer font-medium">
                    {folderPreflight.skipped.length} files excluded locally — review before
                    importing
                  </summary>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-auto">
                    {folderPreflight.skipped.map((file) => (
                      <li key={file.path} className="break-all">
                        <strong>{file.path}</strong> — {file.reason}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">
                    Excluded files will not be uploaded. Change the account’s settings if an
                    expected statement is excluded.
                  </p>
                </details>
              )}
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
                  <code className="min-w-0 break-all rounded bg-muted px-1.5 py-0.5 text-xs">
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
              <Link
                to="/accounts"
                className="font-medium text-primary underline underline-offset-2"
              >
                Add an account
              </Link>{' '}
              before uploading statements.
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
          role="status"
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
              {result.rebuild.committed && (
                <p className="mt-2 text-sm font-medium">
                  Snapshot records: {result.rebuild.previousTransactionCount.toLocaleString()} →{' '}
                  {result.rebuild.totalTransactions.toLocaleString()} (
                  {result.rebuild.newTransactions >= 0 ? '+' : ''}
                  {result.rebuild.newTransactions.toLocaleString()} net change).
                </p>
              )}
              <p className="mt-1 max-w-2xl text-xs opacity-90">
                Record counts include payments and order details, not just reportable items. A net
                change is not a count of brand-new purchases; matching and account settings can also
                affect it.
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
          <div className="mt-4 flex flex-wrap gap-2">
            {result.rebuild.committed && (
              <Link
                to={transactionsHref({ view: 'summary' })}
                className={buttonClassName({ size: 'sm', variant: 'outline' })}
              >
                Analyze transactions
              </Link>
            )}
            <Link to="/rules" className={buttonClassName({ size: 'sm', variant: 'outline' })}>
              Review saved rules
            </Link>
            {[
              ...new Set(
                result.staging.files
                  .map((file) => file.accountId)
                  .filter((id): id is string => Boolean(id)),
              ),
            ].map((id) => (
              <Link
                key={id}
                to={transactionsHref({ account: id, view: 'list', basis: 'records' })}
                className={buttonClassName({ size: 'sm', variant: 'outline' })}
              >
                Inspect{' '}
                {accounts.find((account) => account.config.accountInfo.id === id)?.config
                  .accountInfo.title || id}
              </Link>
            ))}
          </div>

          <div
            className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
            aria-label="Import statistics"
          >
            <div className="rounded-lg border border-current/15 bg-background/40 p-3">
              <p className="text-2xl font-bold">{result.staging.files.length}</p>
              <p className="text-xs opacity-75">Files processed</p>
            </div>
            <div className="rounded-lg border border-current/15 bg-background/40 p-3">
              <p className="text-2xl font-bold">{result.staging.promotedCount}</p>
              <p className="text-xs opacity-75">New files</p>
            </div>
            <div className="rounded-lg border border-current/15 bg-background/40 p-3">
              <p className="text-2xl font-bold">{result.staging.duplicateCount}</p>
              <p className="text-xs opacity-75">Duplicates</p>
            </div>
            <div className="rounded-lg border border-current/15 bg-background/40 p-3">
              <p className="text-2xl font-bold">{result.staging.rejectedCount}</p>
              <p className="text-xs opacity-75">Rejected</p>
            </div>
          </div>

          <details className="mt-3 rounded-lg border border-current/15 bg-background/40 p-3 text-xs">
            <summary className="cursor-pointer font-semibold">Review every file result</summary>
            <ul className="mt-2 space-y-2">
              {result.staging.files.map((file) => (
                <li key={file.relativePath}>
                  <span className="font-semibold uppercase">{file.status}</span>{' '}
                  <code>{file.relativePath}</code> — {file.message}
                  {file.destinationPath && (
                    <>
                      {' '}
                      Destination: <code>{file.destinationPath}</code>.
                    </>
                  )}
                  {file.duplicateOf && (
                    <>
                      {' '}
                      Existing file: <code>{file.duplicateOf}</code>.
                    </>
                  )}
                </li>
              ))}
            </ul>
          </details>

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
                    <MissingRuleTargets count={result.rebuild.unresolvedEditTargets} />
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
