/** Account lifecycle workspace. Removing a configuration never deletes raw statements. */
import React, { useDeferredValue, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  FolderOpen,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Header } from '../components/layout/Header.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { Badge } from '../components/ui/badge.js';
import { Input } from '../components/ui/input.js';
import { Select } from '../components/ui/select.js';
import { Dialog, DialogContent, DialogFooter } from '../components/ui/dialog.js';
import { HelpHint } from '../components/ui/help-hint.js';
import { useAccounts } from '../api/hooks.js';
import { deleteAccount, getConfig, type AccountSummary } from '../api/client.js';
import { getDisconnectedFolders, type DisconnectedAccountFolder } from '../api/imports.js';
import {
  AccountFormDialog,
  accountTypeLabels,
  badgeVariantForType,
  formatInstitutionName,
  formatRecordBuildDate,
} from '../components/accounts/AccountFormDialog.js';
import { transactionsHref } from '../lib/transaction-navigation.js';

interface Feedback {
  title: string;
  description: string;
  rebuild: boolean;
}

export function AccountsPage() {
  const { data: accounts, isLoading, error, refetch } = useAccounts();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountSummary | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountSummary | null>(null);
  const [reconnectFolder, setReconnectFolder] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState<DisconnectedAccountFolder[]>([]);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    let cancelled = false;
    getConfig()
      .then((config) => {
        if (!cancelled) setDataPath(config.activeUserDataPath);
      })
      .catch(() => {});
    getDisconnectedFolders()
      .then((folders) => {
        if (!cancelled) {
          setDisconnected(folders);
          setFolderError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setFolderError(
            err instanceof Error ? err.message : 'Could not check disconnected folders.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const handleAccountSaved = async (savedAccount: AccountSummary, previousId: string | null) => {
    await refetch();
    setFeedback({
      title: reconnectFolder
        ? 'Account folder reconnected'
        : previousId == null
          ? 'Account created'
          : 'Account updated',
      description:
        previousId != null || savedAccount.hasStatementFiles
          ? 'Configuration is saved. Existing snapshot records are unchanged until you rebuild from stored statements in Imports.'
          : 'Ready for statements. Open Imports and choose this account folder, or a folder containing several configured accounts.',
      rebuild: previousId != null || savedAccount.hasStatementFiles,
    });
    setEditingAccount(null);
    setReconnectFolder(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!deletingAccount) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteAccount(deletingAccount.config.accountInfo.id);
      await refetch();
      setDeletingAccount(null);
      setFeedback({
        title: 'Account configuration removed',
        description: result.keptStatementFiles
          ? 'Raw statements were kept. Current snapshot records remain until the next rebuild, which excludes this account. Reconnect its folder below before rebuilding if you want to retain it.'
          : 'The empty folder was removed. The next rebuild excludes this account.',
        rebuild: false,
      });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to remove configuration.');
    } finally {
      setIsDeleting(false);
    }
  };

  const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = (accounts ?? []).filter((account) => {
    const info = account.config.accountInfo;
    return (
      (type === 'all' || String(info.type) === type) &&
      (status === 'all' ||
        (status === 'records'
          ? account.stats.transactionCount > 0
          : account.stats.transactionCount === 0)) &&
      words.every((word) =>
        `${info.title} ${info.id} ${info.instituteName} ${account.relativeDirectory}`
          .toLowerCase()
          .includes(word),
      )
    );
  });
  const storedCount = accounts?.filter((account) => account.hasStatementFiles).length ?? 0;

  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Connected to your statements
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Accounts</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Set up the accounts behind your records. Each account owns one top-level statement
              folder; files inside it can be organized by year or month.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/imports" className={buttonClassName({ variant: 'outline' })}>
              <UploadCloud className="mr-2 h-4 w-4" />
              Import statements
            </Link>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Configured accounts', value: accounts?.length ?? 0, Icon: Building2 },
            { label: 'Folders with stored files', value: storedCount, Icon: FolderOpen },
            { label: 'Folders to reconnect', value: disconnected.length, Icon: Link2 },
          ].map(({ label, value, Icon }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-xl border border-border bg-background p-4"
            >
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{isLoading ? '—' : value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {feedback && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">{feedback.title}</p>
                <p className="mt-1 text-sm">{feedback.description}</p>
                {feedback.rebuild && (
                  <Link
                    to="/imports"
                    className="mt-2 inline-block text-sm font-semibold underline underline-offset-2"
                  >
                    Open Imports to rebuild
                  </Link>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFeedback(null)}
                aria-label="Dismiss account message"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {disconnected.length > 0 && (
          <section
            className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20"
            aria-label="Disconnected account folders"
          >
            <h2 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
              Folders without an account configuration
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              These folders are excluded from rebuilds. Reconnect with the original account ID and
              parser settings to preserve transaction identities. No statement file will be deleted.
            </p>
            <ul className="mt-4 space-y-2">
              {disconnected.map((folder) => (
                <li
                  key={folder.relativeDirectory}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/70 p-3"
                >
                  <div className="min-w-0">
                    <code className="break-all text-sm">
                      Statements/{folder.relativeDirectory}/
                    </code>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {folder.originalAccount
                        ? `Original account: ${folder.originalAccount.title || folder.originalAccount.id} (${folder.originalAccount.id})`
                        : folder.identityStatus === 'ambiguous'
                          ? 'Multiple historical identities found. Restore the original AccountConfig.json from backup before rebuilding.'
                          : 'Original identity not found. Use your original account ID and settings from backup.'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={folder.identityStatus === 'ambiguous'}
                    onClick={() => setReconnectFolder(folder.relativeDirectory)}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Reconnect folder
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {folderError && (
          <p role="alert" className="text-sm text-amber-800 dark:text-amber-200">
            Disconnected-folder check unavailable: {folderError} Configured accounts are still shown
            below.
          </p>
        )}

        <section className="space-y-4" aria-label="Configured accounts">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_200px]">
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Search accounts</span>
              <Input
                className="pl-9"
                placeholder="Search account, institution, or folder…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <Select
              aria-label="Account type filter"
              value={type}
              onChange={(event) => setType(event.target.value)}
              options={[
                { value: 'all', label: 'All account types' },
                ...Object.entries(accountTypeLabels).map(([value, label]) => ({ value, label })),
              ]}
            />
            <Select
              aria-label="Account status filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={[
                { value: 'all', label: 'All import states' },
                { value: 'records', label: 'Has snapshot records' },
                { value: 'empty', label: 'No snapshot records' },
              ]}
            />
          </div>
          {isLoading && (
            <p role="status" className="py-12 text-center text-muted-foreground">
              Loading accounts…
            </p>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
            >
              <p>Failed to load accounts: {error.message}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          )}
          {accounts && (
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {filtered.length} of {accounts.length} accounts
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((account) => {
              const info = account.config.accountInfo;
              return (
                <article
                  key={info.id}
                  className="flex flex-col rounded-xl border border-border bg-background p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words text-lg font-semibold">{info.title || info.id}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatInstitutionName(info.instituteName)} · ID: {info.id}
                      </p>
                    </div>
                    <Badge variant={badgeVariantForType(info.type)}>
                      {accountTypeLabels[info.type] ?? 'Unknown'}
                    </Badge>
                  </div>
                  <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm">
                    <p>Snapshot records</p>
                    <p className="font-semibold tabular-nums">
                      {account.stats.transactionCount.toLocaleString()}
                    </p>
                    <p className="text-muted-foreground">Statement files</p>
                    <p className="text-right">
                      {account.hasStatementFiles ? 'Stored' : 'Not added'}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <span>
                      Latest record build: {formatRecordBuildDate(account.stats.lastImportedAt)}
                    </span>
                    <HelpHint title="Latest record build">
                      <p>
                        This is the latest creation timestamp among this account’s snapshot records.
                        Rebuilding creates records again, so this is not the first-import time.
                      </p>
                      <p>
                        Snapshot record counts include related payments and order details. Use the
                        transaction reporting view for financial totals. Upload receipts and
                        statement sources are available in Imports.
                      </p>
                    </HelpHint>
                  </div>
                  <details className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
                    <summary className="cursor-pointer font-medium">
                      Folder &amp; matching settings
                    </summary>
                    <div className="mt-3 space-y-2 text-muted-foreground">
                      <p>Files: {account.config.fileFilters.join(', ')}</p>
                      <p>
                        {account.config.scanSubFolders
                          ? 'Scanning subfolders'
                          : 'Top-level files only'}
                      </p>
                      <p>Match tags: {info.interAccountNameTags?.join(', ') || 'None'}</p>
                      <code className="block break-all">
                        {dataPath ? `${dataPath}/` : ''}Statements/{account.relativeDirectory}/
                      </code>
                    </div>
                  </details>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                    <Link
                      to={transactionsHref({ account: info.id, basis: 'records', view: 'list' })}
                      className={buttonClassName({ size: 'sm', variant: 'outline' })}
                    >
                      Inspect account records
                      <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => setEditingAccount(account)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingAccount(account);
                      }}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove config
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          {accounts && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 font-semibold">
                {accounts.length ? 'No accounts match these filters' : 'Set up your first account'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {accounts.length
                  ? 'Try another search or account type.'
                  : 'Add your bank account, card, order history, or payment service, then import its statements.'}
              </p>
            </div>
          )}
        </section>
      </main>
      <AccountFormDialog
        key={`create-${showAddDialog}`}
        mode="create"
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSaved={handleAccountSaved}
      />
      <AccountFormDialog
        key={`edit-${editingAccount?.config.accountInfo.id ?? 'closed'}`}
        mode="edit"
        account={editingAccount}
        open={editingAccount != null}
        onOpenChange={(open) => {
          if (!open) setEditingAccount(null);
        }}
        onSaved={handleAccountSaved}
      />
      <AccountFormDialog
        key={`reconnect-${reconnectFolder ?? 'closed'}`}
        mode="create"
        reconnectFolder={reconnectFolder}
        originalAccount={
          disconnected.find((folder) => folder.relativeDirectory === reconnectFolder)
            ?.originalAccount
        }
        open={reconnectFolder != null}
        onOpenChange={(open) => {
          if (!open) setReconnectFolder(null);
        }}
        onSaved={handleAccountSaved}
      />
      <Dialog
        open={deletingAccount != null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeletingAccount(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent
          title="Remove account configuration?"
          description="This is not a permanent deletion of your statement files."
          className="max-w-lg"
        >
          <div className="space-y-4 text-sm">
            <p className="font-semibold">
              {deletingAccount?.config.accountInfo.title || deletingAccount?.config.accountInfo.id}
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p>
                Only <code>AccountConfig.json</code> is deleted. Raw statement files are preserved.
              </p>
              <p className="mt-2 font-semibold">
                The next rebuild excludes this account and can remove its records from the snapshot.
              </p>
              <p className="mt-2">
                Current snapshot records and rules remain until rebuild. Rules targeting this
                account may then have unavailable targets. To retain the account, reconnect its
                folder with the original account ID and settings before rebuilding.
              </p>
            </div>
            {deleteError && (
              <p role="alert" className="text-destructive">
                {deleteError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeletingAccount(null)}
            >
              Keep account
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleDeleteConfirmed()}
            >
              {isDeleting ? 'Removing…' : 'Remove configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
