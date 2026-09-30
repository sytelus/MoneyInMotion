/** Account lifecycle workspace. Removing a configuration never deletes raw statements. */
import React, { useDeferredValue, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  FolderOpen,
  Link2,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
} from 'lucide-react';
import { Header } from '../components/layout/Header.js';
import { Button, buttonClassName } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Select } from '../components/ui/select.js';
import { Dialog, DialogContent, DialogFooter } from '../components/ui/dialog.js';
import { Notice } from '../components/ui/notice.js';
import { useAccounts } from '../api/hooks.js';
import { deleteAccount, getConfig, type AccountSummary } from '../api/client.js';
import {
  getDisconnectedFolders,
  getStatementInventory,
  type StatementEntry,
  ImportApiError,
  type DisconnectedAccountFolder,
} from '../api/imports.js';
import {
  AccountFormDialog,
  accountTypeLabels,
  type AccountSaveOutcome,
} from '../components/accounts/AccountFormDialog.js';
import { AccountCard } from '../components/accounts/AccountCard.js';
import { MissingRuleTargets } from '../components/editing/MissingRuleTargets.js';

interface Feedback {
  title: string;
  description: string;
  rebuild: boolean;
  tone?: 'success' | 'warning';
  failedFiles?: Array<{ path: string; error: string }>;
  unresolvedTargets?: number;
}

interface FolderCheckFailure {
  restartRequired: boolean;
}

function describeFolderCheckFailure(error: unknown): FolderCheckFailure {
  const message = error instanceof Error ? error.message : '';
  return {
    restartRequired:
      (error instanceof ImportApiError && error.status === 404) ||
      /endpoint not found|not found/i.test(message),
  };
}

export function AccountsPage() {
  const { data: accounts, isLoading, error, refetch } = useAccounts();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountSummary | null>(null);
  const [duplicatingAccount, setDuplicatingAccount] = useState<AccountSummary | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountSummary | null>(null);
  const [reconnectFolder, setReconnectFolder] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState<DisconnectedAccountFolder[]>([]);
  const [folderCheckStatus, setFolderCheckStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [folderError, setFolderError] = useState<FolderCheckFailure | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [showTasks, setShowTasks] = useState(false);
  const [inventory, setInventory] = useState<StatementEntry[]>([]);
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');

  const retryDisconnectedFolders = () => {
    setFolderCheckStatus('loading');
    setFolderError(null);
    getDisconnectedFolders()
      .then((folders) => {
        setDisconnected(folders);
        setFolderCheckStatus('ready');
      })
      .catch((err: unknown) => {
        setFolderError(describeFolderCheckFailure(err));
        setFolderCheckStatus('error');
      });
  };

  useEffect(() => {
    let cancelled = false;
    getStatementInventory()
      .then((result) => {
        if (!cancelled)
          setInventory(result.truncated || result.unreadableFolders ? [] : result.entries);
      })
      .catch(() => {});
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
          setFolderCheckStatus('ready');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFolderError(describeFolderCheckFailure(err));
          setFolderCheckStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const handleAccountSaved = async (savedAccount: AccountSummary, outcome: AccountSaveOutcome) => {
    await refetch();
    setShowTasks(true);
    const failed = !!outcome.rebuildError || outcome.rebuild?.committed === false;
    setFeedback({
      title: failed
        ? 'Account saved; transactions need a rebuild'
        : outcome.rebuild?.committed
          ? 'Account saved and transactions rebuilt'
          : duplicatingAccount
            ? 'Duplicate account created'
            : 'Account created',
      description: failed
        ? 'Your settings were saved. The rebuild did not finish, so existing transactions are still shown. Review the file errors below, fix the statements or settings, then rebuild in Imports.'
        : outcome.rebuild
          ? `${outcome.rebuild.importedFiles.length} files read · ${outcome.rebuild.totalTransactions.toLocaleString()} transaction records · ${outcome.rebuild.appliedEdits} saved rules processed.`
          : `Ready to import statements into ${savedAccount.relativeDirectory}.`,
      tone: failed ? 'warning' : 'success',
      rebuild: failed,
      unresolvedTargets: outcome.rebuild?.unresolvedEditTargets,
      failedFiles:
        outcome.rebuild?.failedFiles ??
        (outcome.rebuildError ? [{ path: 'Rebuild', error: outcome.rebuildError }] : []),
    });
    setEditingAccount(null);
    setDuplicatingAccount(null);
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
      setShowTasks(true);
      setFeedback({
        title: 'Account configuration removed',
        description: result.keptStatementFiles
          ? 'Raw statements were kept. Current snapshot records remain until the next rebuild, which excludes this account. Configure its folder again before rebuilding if you want to keep these transactions.'
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
      <main className="workspace">
        <div className="workspace-heading">
          <div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Accounts</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage your bank accounts, cards and purchase histories. Browse statements, update
              settings and view transactions.
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

        <div className="accounts-layout">
          <aside
            aria-label="Account summary"
            className="accounts-stats grid grid-cols-3 gap-3 min-[1600px]:grid-cols-1"
          >
            {[
              {
                label: 'Configured accounts',
                value: isLoading ? '—' : (accounts?.length ?? 0),
                Icon: Building2,
              },
              {
                label: 'Accounts with files',
                value: isLoading ? '—' : storedCount,
                Icon: FolderOpen,
              },
              {
                label: 'Folders to configure',
                value: folderCheckStatus === 'ready' ? disconnected.length : '—',
                Icon: Link2,
              },
            ].map(({ label, value, Icon }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-3 text-center shadow-sm sm:flex-row sm:gap-3 sm:p-4 sm:text-left"
              >
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </aside>
          <aside className="accounts-tasks space-y-4" aria-label="Account tasks">
            <Button
              className="w-full justify-between xl:hidden"
              variant="outline"
              aria-expanded={showTasks}
              aria-controls="account-task-details"
              onClick={() => setShowTasks((value) => !value)}
            >
              Account tasks
              {folderCheckStatus === 'ready' && disconnected.length > 0
                ? ` · ${disconnected.length} folders to configure`
                : folderCheckStatus === 'error'
                  ? ' · Check needed'
                  : ' & statements'}
              <ChevronDown className={`ml-2 h-4 w-4 ${showTasks ? 'rotate-180' : ''}`} />
            </Button>
            <div
              id="account-task-details"
              className={`space-y-4 ${showTasks ? '' : 'hidden xl:block'}`}
            >
              <div className="rounded-xl border border-info-border bg-info p-4 text-info-foreground">
                <h2 className="flex items-center gap-2 font-semibold">
                  <FolderOpen className="h-4 w-4" />
                  Statement explorer
                </h2>
                <p className="mt-2 text-sm">
                  Browse account folders, file counts and files excluded by your settings.
                </p>
                <Link
                  className={buttonClassName({ variant: 'outline', size: 'sm', className: 'mt-3' })}
                  to="/imports?tab=files"
                >
                  Browse statements
                </Link>
              </div>

              {feedback && (
                <Notice
                  tone={feedback.tone ?? 'success'}
                  title={feedback.title}
                  actions={
                    <>
                      {feedback.rebuild && (
                        <Link
                          to="/imports"
                          className={buttonClassName({ size: 'sm', variant: 'outline' })}
                        >
                          Rebuild transactions
                        </Link>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFeedback(null)}
                        aria-label="Dismiss account message"
                      >
                        Dismiss
                      </Button>
                    </>
                  }
                >
                  <p>{feedback.description}</p>
                  {!!feedback.unresolvedTargets && (
                    <MissingRuleTargets count={feedback.unresolvedTargets} />
                  )}
                  {!!feedback.failedFiles?.length && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium">
                        View rebuild errors ({feedback.failedFiles.length})
                      </summary>
                      <ul className="mt-2 space-y-2 break-words">
                        {feedback.failedFiles.map((file) => (
                          <li key={file.path}>
                            <strong>{file.path}</strong>: {file.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </Notice>
              )}

              {disconnected.length > 0 && (
                <section
                  className="rounded-xl border border-warning-border bg-warning p-4 text-warning-foreground"
                  aria-label="Folders to configure"
                >
                  <h2 className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                    Folders to configure
                  </h2>
                  <p className="mt-2 text-sm leading-6">
                    These folders have no account settings. Configure them to include their
                    statements in transactions.
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
                          <p className="mt-1 text-xs leading-5 text-warning-foreground">
                            {folder.originalAccount
                              ? `Original account: ${folder.originalAccount.title || folder.originalAccount.id} (${folder.originalAccount.id})`
                              : folder.identityStatus === 'ambiguous'
                                ? 'Multiple historical identities found. Restore the original AccountConfig.json from backup before rebuilding.'
                                : 'New account? Choose its settings. Previously imported? Use its original account ID.'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={folder.identityStatus === 'ambiguous'}
                          onClick={() => setReconnectFolder(folder.relativeDirectory)}
                        >
                          <Link2 className="mr-2 h-4 w-4" />
                          Configure account
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {folderError && (
                <Notice
                  tone={folderError.restartRequired ? 'info' : 'warning'}
                  role="alert"
                  title={
                    folderError.restartRequired
                      ? 'Restart MoneyInMotion to finish this update'
                      : 'Statement folders could not be checked'
                  }
                  actions={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={folderCheckStatus === 'loading'}
                      onClick={retryDisconnectedFolders}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {folderCheckStatus === 'loading' ? 'Checking…' : 'Try again'}
                    </Button>
                  }
                >
                  {folderError.restartRequired ? (
                    <p>
                      Your configured accounts are available. This app update is only partially
                      loaded, so the folder check is not ready yet. Restart MoneyInMotion with{' '}
                      <code>./run.sh</code>, then try again.
                    </p>
                  ) : (
                    <p>
                      Your configured accounts are available. MoneyInMotion could not check whether
                      any statement folders still need account settings. Check that the server is
                      running, then try again.
                    </p>
                  )}
                </Notice>
              )}
            </div>
          </aside>
          <section className="accounts-content space-y-4" aria-label="Configured accounts">
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
                  { value: 'records', label: 'Has transactions' },
                  { value: 'empty', label: 'No transactions' },
                ]}
              />
            </div>
            {isLoading && (
              <p role="status" className="py-12 text-center text-muted-foreground">
                Loading accounts…
              </p>
            )}
            {error && (
              <Notice
                tone="error"
                title="Accounts could not be loaded"
                actions={
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    Try again
                  </Button>
                }
              >
                MoneyInMotion could not reach the account service. Check that the app is running,
                then try again. No account configuration was changed.
              </Notice>
            )}
            {accounts && (
              <p aria-live="polite" className="text-xs text-muted-foreground">
                {filtered.length} of {accounts.length} accounts
              </p>
            )}
            <div className="grid gap-3">
              {filtered.map((account) => (
                <AccountCard
                  key={account.config.accountInfo.id}
                  account={account}
                  folder={inventory.find(
                    (entry) => entry.path === account.relativeDirectory && entry.kind === 'folder',
                  )}
                  dataPath={dataPath}
                  onEdit={() => setEditingAccount(account)}
                  onDuplicate={() => setDuplicatingAccount(account)}
                  onRemove={() => {
                    setDeleteError(null);
                    setDeletingAccount(account);
                  }}
                />
              ))}
            </div>
            {accounts && filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-10 text-center">
                <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
                <h2 className="mt-3 font-semibold">
                  {accounts.length
                    ? 'No accounts match these filters'
                    : 'Set up your first account'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {accounts.length
                    ? 'Try another search or account type.'
                    : 'Add your bank account, card, order history, or payment service, then import its statements.'}
                </p>
              </div>
            )}
          </section>
        </div>
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
        key={`duplicate-${duplicatingAccount?.config.accountInfo.id ?? 'closed'}`}
        mode="create"
        templateAccount={duplicatingAccount}
        open={duplicatingAccount != null}
        onOpenChange={(open) => {
          if (!open) setDuplicatingAccount(null);
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
          title="Remove account?"
          description="Statement files are kept so you can configure this account again."
          className="max-w-lg"
        >
          <div className="space-y-4 text-sm">
            <p className="font-semibold">
              {deletingAccount?.config.accountInfo.title || deletingAccount?.config.accountInfo.id}
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p>The account’s settings are removed. Statement files stay in their folder.</p>
              <p className="mt-2 font-semibold">
                The next rebuild excludes this account and can remove its records from the snapshot.
              </p>
              <p className="mt-2">
                Current snapshot records and rules remain until rebuild. Rules targeting this
                account may then have unavailable targets. To retain the account, configure its
                folder again with the original account ID and settings before rebuilding.
              </p>
            </div>
            {deleteError && (
              <Notice tone="error" title="Account configuration was not removed">
                {deleteError}
              </Notice>
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
              {isDeleting ? 'Removing…' : 'Remove account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
