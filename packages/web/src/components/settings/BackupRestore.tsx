/** Explicit create → review → confirm → result workflow for full-data recovery. */
import React, { useEffect, useState } from 'react';
import { Archive, Download, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Notice } from '../ui/notice.js';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import {
  listBackups,
  createBackup,
  previewBackup,
  previewUploadedBackup,
  cancelRestore,
  restoreBackup,
  backupDownloadUrl,
  type BackupList,
  type CreatedBackup,
  type RestorePreview,
  type RestoreResult,
} from '../../api/backups.js';

const RECEIPT_KEY = 'mim-restore-result';
function readReceipt(): RestoreResult | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(RECEIPT_KEY) || 'null') as RestoreResult | null;
    return value?.restored === true && typeof value.recoveryDirectory === 'string' ? value : null;
  } catch {
    return null;
  }
}
function size(bytes: number): string {
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

export function BackupRestore({
  disabled = false,
  onBusyChange,
  onRestored = () => window.location.reload(),
}: {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onRestored?: () => void;
}) {
  const [catalog, setCatalog] = useState<BackupList | null>(null);
  const [selection, setSelection] = useState('');
  const [uploaded, setUploaded] = useState<File | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedBackup | null>(null);
  const [restored, setRestored] = useState(readReceipt);
  const reviewButton = React.useRef<HTMLButtonElement>(null);

  const refresh = async () => {
    const next = await listBackups();
    setCatalog(next);
    setSelection((current) =>
      next.backups.some((b) => b.name === current) ? current : next.backups[0]?.name || '',
    );
  };
  useEffect(() => {
    let cancelled = false;
    listBackups()
      .then((next) => {
        if (!cancelled) {
          setCatalog(next);
          setSelection(next.backups[0]?.name || '');
        }
      })
      .catch((failure) => {
        if (!cancelled)
          setError(failure instanceof Error ? failure.message : 'Could not list backups.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError('');
    onBusyChange?.(true);
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'The operation could not finish. Try again.',
      );
    } finally {
      setBusy('');
      onBusyChange?.(false);
    }
  }
  const unavailable = disabled || Boolean(busy);
  const dismissPreview = () => {
    if (busy) return;
    if (preview)
      void cancelRestore(preview.token).catch(() => {
        /* Server also expires private previews after 15 minutes. */
      });
    setPreview(null);
    setConfirmation('');
  };

  return (
    <section
      className="min-w-0 space-y-4 rounded-xl border border-border bg-background p-5"
      aria-labelledby="backup-title"
      aria-busy={Boolean(busy)}
    >
      <div>
        <h2 id="backup-title" className="flex items-center gap-2 text-base font-semibold">
          <Archive className="h-5 w-5 text-primary" aria-hidden />
          Backups and restore
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Save all statements, account settings, transactions, rules, upload receipts, and
          application settings in one ZIP.
        </p>
      </div>
      <p className="text-sm break-all">
        Server backup folder: <code>{catalog?.directory || '~ (server home)'}</code>
        <br />
        Filename: <code>{catalog?.defaultName || '<user_alias>_mim_backup_<datetime>.zip'}</code>
      </p>
      <p className="text-xs text-muted-foreground">
        The user alias is the active username. ZIPs are not encrypted. Keep an additional copy on a
        separate drive; browser downloads use your browser’s download folder.
      </p>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">
          Backup limits and prerequisites
        </summary>
        <p className="mt-1">
          Requires Python 3.9+ on the server. Maximum: 2 GiB ZIP and expanded contents, 512 MiB per
          file, 20,000 files/folders, and 40 folder levels. Links are not supported. Allow space for
          a staged restore and the retained previous data.
        </p>
      </details>
      {disabled && (
        <p className="text-sm text-warning-foreground">
          Finish or discard settings changes and wait for other operations before using backup or
          restore. Restart if saved settings have not taken effect.
        </p>
      )}
      <Button
        disabled={unavailable || !catalog}
        onClick={() =>
          void run('Creating backup…', async () => {
            setCreated(await createBackup());
            await refresh();
          })
        }
      >
        <Archive className="mr-2 h-4 w-4" aria-hidden />
        Create full backup
      </Button>
      {created && (
        <Notice tone="success" title="Backup saved">
          <p>
            {created.fileCount} files, {size(created.totalBytes)} before compression. Saved to{' '}
            <code className="break-all">{created.path}</code>.
          </p>
          <a
            className="inline-flex items-center gap-1 font-medium underline"
            href={backupDownloadUrl(created.name)}
          >
            <Download className="h-4 w-4" aria-hidden />
            Download ZIP copy
          </a>
        </Notice>
      )}
      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="font-medium">Restore from a backup</h3>
        <p className="text-sm text-muted-foreground">
          Restoring replaces this user’s entire data folder and saved settings, without rebuilding.
          Later changes are removed from active data; a recovery copy is retained. Close other tabs
          before restoring.
        </p>
        <div className="space-y-1">
          <label htmlFor="restore-backup" className="text-sm font-medium">
            Backup in server home folder
          </label>
          <select
            id="restore-backup"
            className="w-full min-w-0 rounded-md border border-input bg-background p-2 text-sm"
            value={selection}
            disabled={unavailable || !catalog?.backups.length}
            onChange={(event) => {
              setSelection(event.target.value);
              setUploaded(null);
            }}
          >
            {!catalog?.backups.length && (
              <option value="">
                {catalog
                  ? 'No saved backups found'
                  : error
                    ? 'Backup list unavailable'
                    : 'Loading backups…'}
              </option>
            )}
            {catalog?.backups.map((backup) => (
              <option key={backup.name} value={backup.name}>
                {backup.name} ({size(backup.sizeBytes)})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            The newest filename is selected by default. The review shows the verified archive date.
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="restore-file" className="text-sm font-medium">
            Or browse for a backup ZIP on this device
          </label>
          <Input
            id="restore-file"
            type="file"
            accept=".zip,application/zip"
            disabled={unavailable}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPreview(null);
              setError('');
              if (
                file &&
                (!file.name.toLowerCase().endsWith('.zip') ||
                  file.size > (catalog?.maxArchiveBytes ?? 2 * 1024 ** 3))
              ) {
                setUploaded(null);
                event.target.value = '';
                setError('Choose a ZIP file no larger than 2 GiB. Nothing was uploaded.');
                return;
              }
              setUploaded(file);
            }}
          />
          {uploaded && (
            <p className="text-sm">
              Selected upload: {uploaded.name}.{' '}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => setUploaded(null)}
                disabled={unavailable}
              >
                Use server backup instead
              </button>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            ref={reviewButton}
            variant="outline"
            disabled={unavailable || (!selection && !uploaded)}
            onClick={() =>
              void run('Validating backup…', async () => {
                const result = uploaded
                  ? await previewUploadedBackup(uploaded)
                  : await previewBackup(selection);
                setPreview(result);
                setConfirmation('');
              })
            }
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
            Review restore
          </Button>
          <Button
            variant="ghost"
            disabled={unavailable}
            onClick={() => void run('Refreshing backups…', refresh)}
          >
            Refresh list
          </Button>
        </div>
      </div>
      {busy && (
        <p role="status" className="text-sm font-medium text-primary">
          {busy} Keep this page open. Other data operations are temporarily paused.
        </p>
      )}
      {error && !preview && (
        <Notice tone="error" title="Backup or restore could not finish">
          <p>{error}</p>
          <p>If a response was lost, refresh the list or reload the page before retrying.</p>
        </Notice>
      )}
      {restored && catalog?.destination === restored.destination && (
        <Notice tone="success" title="Data restored from backup">
          <p>
            Restored {restored.fileCount} files from {new Date(restored.createdAt).toLocaleString()}
            . No rebuild was performed.
          </p>
          <p>
            Previous data and settings:{' '}
            <code className="break-all">{restored.recoveryDirectory}</code>.
          </p>
          {restored.restartRequired && (
            <p>Restart the server to use the restored port {restored.port}.</p>
          )}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => {
              sessionStorage.removeItem(RECEIPT_KEY);
              setRestored(null);
            }}
          >
            Dismiss result
          </button>
        </Notice>
      )}
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) dismissPreview();
        }}
      >
        {preview && (
          <DialogContent
            title="Replace current data with this backup?"
            description="Review the archive and destination. Cancel leaves your active data unchanged."
            returnFocusRef={reviewButton}
          >
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt>Backup date</dt>
              <dd>{new Date(preview.createdAt).toLocaleString()}</dd>
              <dt>User</dt>
              <dd>{preview.username}</dd>
              <dt>Contents</dt>
              <dd>
                {preview.fileCount} files · {size(preview.totalBytes)}
              </dd>
              <dt>Replace folder</dt>
              <dd className="break-all">
                <code>{preview.destination}</code>
              </dd>
              <dt>Restore port</dt>
              <dd>
                {preview.port}
                {preview.restartRequired ? ' (restart required)' : ''}
              </dd>
            </dl>
            <Notice
              tone="warning"
              title="Changes made after this backup will leave active data"
              className="my-4"
            >
              <p>
                The complete current folder is retained beside your data as a recovery copy. This is
                a replacement, not a merge. Allow enough disk space for both versions.
              </p>
            </Notice>
            <label htmlFor="restore-confirmation" className="text-sm font-medium">
              Type {preview.username} to confirm
            </label>
            <Input
              id="restore-confirmation"
              autoComplete="off"
              value={confirmation}
              disabled={Boolean(busy)}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            {error && (
              <Notice tone="error" title="Restore could not finish" className="mt-3">
                {error}
              </Notice>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={Boolean(busy)} onClick={dismissPreview}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={Boolean(busy) || confirmation !== preview.username}
                onClick={() =>
                  void run('Restoring data…', async () => {
                    const result = await restoreBackup(preview.token, confirmation);
                    setRestored(result);
                    setPreview(null);
                    try {
                      sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(result));
                    } catch {
                      /* Reload remains necessary even when browser storage is unavailable. */
                    }
                    // A full reload clears React Query, transaction selections, and drafts;
                    // no old in-memory snapshot may outlive the server-side replacement.
                    onRestored();
                  })
                }
              >
                {busy ? 'Restoring…' : 'Restore and replace data'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
