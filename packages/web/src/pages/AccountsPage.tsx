/**
 * Account management page.
 *
 * Lists configured accounts, shows per-account import status, and provides
 * dialogs for creating, editing, and deleting account configurations.
 *
 * @module
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle,
  CreditCard,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { AccountType, type AccountConfig } from '@moneyinmotion/core';
import { Button } from '../components/ui/button.js';
import { Badge } from '../components/ui/badge.js';
import { Input } from '../components/ui/input.js';
import { Select, type SelectOption } from '../components/ui/select.js';
import { Dialog, DialogContent, DialogFooter } from '../components/ui/dialog.js';
import { useAccounts } from '../api/hooks.js';
import {
  createAccount,
  deleteAccount,
  getConfig,
  uploadAccountFiles,
  updateAccount,
  type AccountSummary,
} from '../api/client.js';

const institutionOptions: SelectOption[] = [
  { value: 'AmericanExpress', label: 'American Express' },
  { value: 'BarclayBank', label: 'Barclay Bank' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'Amazon', label: 'Amazon' },
  { value: 'Etsy', label: 'Etsy' },
  { value: 'Generic', label: 'Generic' },
];

const accountTypeOptions: { value: AccountType; label: string }[] = [
  { value: AccountType.CreditCard, label: 'Credit Card' },
  { value: AccountType.BankChecking, label: 'Checking' },
  { value: AccountType.BankSavings, label: 'Savings' },
  { value: AccountType.OrderHistory, label: 'Order History' },
  { value: AccountType.EPayment, label: 'E-Payment' },
];

const accountTypeLabels: Record<number, string> = {
  [AccountType.CreditCard]: 'Credit Card',
  [AccountType.BankChecking]: 'Checking',
  [AccountType.BankSavings]: 'Savings',
  [AccountType.OrderHistory]: 'Order History',
  [AccountType.EPayment]: 'E-Payment',
};

function badgeVariantForType(type: AccountType): 'default' | 'secondary' | 'info' | 'success' | 'warning' {
  switch (type) {
    case AccountType.CreditCard:
      return 'default';
    case AccountType.BankChecking:
      return 'info';
    case AccountType.BankSavings:
      return 'success';
    case AccountType.OrderHistory:
      return 'warning';
    case AccountType.EPayment:
      return 'secondary';
    default:
      return 'secondary';
  }
}

function formatCsvList(values: string[] | null | undefined): string {
  return (values ?? []).join(', ');
}

function parseCsvList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatInstitutionName(instituteName: string): string {
  switch (instituteName.replace(/\s+/g, '').toLowerCase()) {
    case 'americanexpress':
      return 'American Express';
    case 'barclaybank':
    case 'barclaycard':
      return 'Barclay Bank';
    case 'paypal':
      return 'PayPal';
    default:
      return instituteName;
  }
}

function formatLastImportedAt(value: string | null): string {
  if (!value) {
    return 'Not imported yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function buildAccountConfig(form: {
  accountId: string;
  title: string;
  instituteName: string;
  accountType: AccountType;
  fileFilters: string;
  interAccountNameTags: string;
  scanSubFolders: boolean;
}): AccountConfig {
  return {
    accountInfo: {
      id: form.accountId.trim(),
      instituteName: form.instituteName.trim(),
      title: form.title.trim(),
      type: form.accountType,
      requiresParent: form.accountType === AccountType.OrderHistory,
      interAccountNameTags: parseCsvList(form.interAccountNameTags),
    },
    fileFilters: parseCsvList(form.fileFilters).length > 0
      ? parseCsvList(form.fileFilters)
      : ['*.csv'],
    scanSubFolders: form.scanSubFolders,
  };
}

type AccountDialogMode = 'create' | 'edit';

interface AccountFormDialogProps {
  mode: AccountDialogMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountSummary | null;
  onSaved: (savedAccount: AccountSummary, previousId: string | null) => Promise<void> | void;
}

const AccountFormDialog: React.FC<AccountFormDialogProps> = ({
  mode,
  open,
  onOpenChange,
  account,
  onSaved,
}) => {
  const [accountId, setAccountId] = useState('');
  const [title, setTitle] = useState('');
  const [instituteName, setInstituteName] = useState('Generic');
  const [accountType, setAccountType] = useState<AccountType>(AccountType.CreditCard);
  const [fileFilters, setFileFilters] = useState('*.csv');
  const [interAccountNameTags, setInterAccountNameTags] = useState('');
  const [scanSubFolders, setScanSubFolders] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === 'edit' && account) {
      setAccountId(account.config.accountInfo.id);
      setTitle(account.config.accountInfo.title ?? account.config.accountInfo.id);
      setInstituteName(account.config.accountInfo.instituteName);
      setAccountType(account.config.accountInfo.type);
      setFileFilters(formatCsvList(account.config.fileFilters));
      setInterAccountNameTags(
        formatCsvList(account.config.accountInfo.interAccountNameTags),
      );
      setScanSubFolders(account.config.scanSubFolders);
    } else {
      setAccountId('');
      setTitle('');
      setInstituteName('Generic');
      setAccountType(AccountType.CreditCard);
      setFileFilters('*.csv');
      setInterAccountNameTags('');
      setScanSubFolders(true);
    }

    setError(null);
    setIsSaving(false);
  }, [account, mode, open]);

  const isOrderHistory = accountType === AccountType.OrderHistory;
  const previousId = account?.config.accountInfo.id ?? null;
  const canEditId = mode === 'create'
    || !account
    || (account.stats.transactionCount === 0 && !account.hasStatementFiles);

  const handleSubmit = async () => {
    if (!accountId.trim() || !title.trim()) {
      setError('Account ID and title are required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const config = buildAccountConfig({
        accountId,
        title,
        instituteName,
        accountType,
        fileFilters,
        interAccountNameTags,
        scanSubFolders,
      });

      const saved = mode === 'create'
        ? await createAccount(config)
        : await updateAccount(previousId ?? config.accountInfo.id, config);

      await onSaved(saved, previousId);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={mode === 'create' ? 'Add Account' : 'Edit Account'}
        description="Configure how MoneyInMotion should discover and interpret files for this account."
        className="max-w-xl"
      >
        <div className="space-y-5">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor={`${mode}-account-id`} className="text-sm font-medium">
              Account ID
            </label>
            <Input
              id={`${mode}-account-id`}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="e.g. amex-plat"
              autoFocus={mode === 'create'}
              disabled={!canEditId}
            />
            <p className="text-xs text-muted-foreground">
              This becomes the folder name under <code>Statements/</code>.
            </p>
            {!canEditId && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Account ID is locked after statement files are added or transactions are imported.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${mode}-account-title`} className="text-sm font-medium">
              Account Title
            </label>
            <Input
              id={`${mode}-account-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Platinum Card"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${mode}-institution`} className="text-sm font-medium">
              Institution
            </label>
            <Select
              id={`${mode}-institution`}
              value={instituteName}
              onChange={(e) => setInstituteName(e.target.value)}
              options={institutionOptions}
            />
            <p className="text-xs text-muted-foreground">
              Choose the institution-specific parser when available. Use &lsquo;Generic&rsquo; for most standard CSV exports.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Account Type</span>
            <p className="text-xs text-muted-foreground">
              This controls how transactions are grouped and matched.
            </p>
            <div className="space-y-1.5">
              {accountTypeOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={`${mode}-accountType`}
                    value={option.value}
                    checked={accountType === option.value}
                    onChange={() => setAccountType(option.value)}
                    className="accent-primary"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {isOrderHistory && (
              <div className="rounded-md bg-yellow-50 p-3 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                Order history accounts (Amazon, Etsy) need match tags so purchases can be reconciled to the credit-card charge.
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${mode}-match-tags`} className="text-sm font-medium">
              Match Tags
            </label>
            <Input
              id={`${mode}-match-tags`}
              value={interAccountNameTags}
              onChange={(e) => setInterAccountNameTags(e.target.value)}
              placeholder="e.g. AMEX, AMERICAN EXPRESS"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated name fragments used for transfer matching and Amazon/Etsy parent-charge matching.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${mode}-file-filters`} className="text-sm font-medium">
              File Filters
            </label>
            <Input
              id={`${mode}-file-filters`}
              value={fileFilters}
              onChange={(e) => setFileFilters(e.target.value)}
              placeholder="*.csv"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated glob patterns for statement files.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={scanSubFolders}
              onChange={(e) => setScanSubFolders(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="font-medium">Scan subfolders</span>
              <span className="block text-xs text-muted-foreground">
                Enable this if your bank export files are organized in yearly or monthly subdirectories.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving
              ? (mode === 'create' ? 'Creating...' : 'Saving...')
              : (mode === 'create' ? 'Create Account' : 'Save Changes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface FeedbackMessage {
  title: string;
  description: string;
  path?: string;
}

/**
 * Full account management page. Lists configured accounts and allows adding,
 * editing, and removing account configs through dialogs.
 */
export const AccountsPage: React.FC = () => {
  const { data: accounts, isLoading, error, refetch } = useAccounts();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountSummary | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [uploadingAccountId, setUploadingAccountId] = useState<string | null>(null);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getConfig();
        if (!cancelled) {
          setDataPath(config.dataPath);
        }
      } catch {
        // Folder paths are informative only; ignore load failures here.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissFeedback = () => {
    setFeedback(null);
  };

  const handleAccountSaved = async (
    savedAccount: AccountSummary,
    previousId: string | null,
  ) => {
    await refetch();

    const accountId = savedAccount.config.accountInfo.id;
    const action = previousId == null ? 'created' : 'updated';

    setFeedback({
      title: action === 'created' ? 'Account created' : 'Account updated',
      description:
        action === 'created'
          ? 'Place your statement files in the folder below, then run Import.'
          : 'The account configuration has been saved.',
      path: dataPath ? `${dataPath}/Statements/${accountId}/` : undefined,
    });
    setEditingAccount(null);
  };

  const handleDeleteConfirmed = async () => {
    if (!deletingAccount) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteAccount(deletingAccount.config.accountInfo.id);
      await refetch();
      setDeletingAccount(null);
      setFeedback({
        title: 'Account configuration removed',
        description: result.keptStatementFiles
          ? 'The raw statement files were left in place. Only AccountConfig.json was removed.'
          : 'The empty account folder was removed after deleting AccountConfig.json.',
      });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploadSelected = async (
    account: AccountSummary,
    fileList: FileList | null,
    input: HTMLInputElement | null,
  ) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList);
    const accountId = account.config.accountInfo.id;

    setUploadingAccountId(accountId);
    setFeedback(null);

    try {
      const result = await uploadAccountFiles(accountId, files);
      await refetch();

      const fileCount = result.uploadedFiles.length;
      const fileLabel = fileCount === 1 ? 'file' : 'files';

      setFeedback({
        title: `Uploaded ${fileCount} ${fileLabel}`,
        description:
          'The statement files were saved to this account folder. Run Import to scan and merge them.',
        path: dataPath ? `${dataPath}/Statements/${accountId}/` : undefined,
      });
    } catch (err) {
      setFeedback({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload statement files.',
      });
    } finally {
      setUploadingAccountId(null);
      if (input) {
        input.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between h-14 px-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Accounts</h1>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Account
        </Button>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        <p className="text-sm text-muted-foreground mb-6">
          Each account represents a bank account, credit card, order history, or payment service.
          Configure the parser, file filters, and matching tags here before importing statements.
          You can also upload raw statement files here instead of copying them into the data folder by hand.
        </p>

        {feedback && (
          <div
            className={`rounded-md p-4 mb-6 ${
              feedback.title === 'Upload failed'
                ? 'bg-destructive/10'
                : 'bg-green-50 dark:bg-green-900/20'
            }`}
          >
            <div className="flex items-start gap-3">
              {feedback.title === 'Upload failed' ? (
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 space-y-2">
                <p
                  className={`font-medium ${
                    feedback.title === 'Upload failed'
                      ? 'text-destructive'
                      : 'text-green-800 dark:text-green-200'
                  }`}
                >
                  {feedback.title}
                </p>
                <p
                  className={`text-sm ${
                    feedback.title === 'Upload failed'
                      ? 'text-destructive'
                      : 'text-green-700 dark:text-green-300'
                  }`}
                >
                  {feedback.description}
                </p>
                {feedback.path && (
                  <code
                    className={`block text-sm px-3 py-2 rounded ${
                      feedback.title === 'Upload failed'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100'
                    }`}
                  >
                    {feedback.path}
                  </code>
                )}
              </div>
              <button
                onClick={dismissFeedback}
                className="text-green-600 dark:text-green-400 hover:opacity-70 text-sm"
                aria-label="Dismiss"
              >
                &times;
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center text-muted-foreground py-12">
            Loading accounts...
          </div>
        )}

        {error && (
          <div className="text-center text-destructive py-12">
            Failed to load accounts: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {accounts && accounts.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No accounts configured</p>
            <p className="text-sm">Add an account to start importing statements.</p>
          </div>
        )}

        {accounts && accounts.length > 0 && (
          <div className="space-y-3">
            {accounts.map((account) => {
              const info = account.config.accountInfo;
              const transactionLabel = account.stats.transactionCount === 1
                ? 'transaction'
                : 'transactions';

              return (
                <div
                  key={info.id}
                  className="rounded-lg border border-border p-4 hover:bg-accent/20 transition-colors"
                >
                  <div className="flex gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-secondary shrink-0">
                      <Building2 className="h-5 w-5 text-secondary-foreground" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                              {info.title ?? info.id}
                            </span>
                            <Badge variant={badgeVariantForType(info.type)}>
                              {accountTypeLabels[info.type] ?? 'Unknown'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{formatInstitutionName(info.instituteName)}</span>
                            <span className="text-border">|</span>
                            <span>ID: {info.id}</span>
                            <span className="text-border">|</span>
                            <span>
                              Imported: {account.stats.transactionCount} {transactionLabel}
                            </span>
                            <span className="text-border">|</span>
                            <span>
                              Last import: {formatLastImportedAt(account.stats.lastImportedAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            ref={(node) => {
                              fileInputRefs.current[info.id] = node;
                            }}
                            id={`account-upload-${info.id}`}
                            type="file"
                            multiple
                            className="sr-only"
                            aria-label={`Upload statement files for ${info.title ?? info.id}`}
                            onChange={(event) =>
                              handleUploadSelected(
                                account,
                                event.target.files,
                                event.currentTarget,
                              )
                            }
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRefs.current[info.id]?.click()}
                            disabled={uploadingAccountId === info.id}
                          >
                            <Upload className="h-4 w-4 mr-1.5" />
                            {uploadingAccountId === info.id ? 'Uploading...' : 'Upload Files'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingAccount(account)}
                          >
                            <Pencil className="h-4 w-4 mr-1.5" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingAccount(account);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {account.config.fileFilters.length > 0 && (
                          <span>Files: {account.config.fileFilters.join(', ')}</span>
                        )}
                        <span className="text-border">|</span>
                        <span>{account.config.scanSubFolders ? 'Scanning subfolders' : 'Top-level folder only'}</span>
                        <span className="text-border">|</span>
                        <span>
                          Match tags: {account.config.accountInfo.interAccountNameTags?.join(', ') || 'None'}
                        </span>
                      </div>

                      {dataPath && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FolderOpen className="h-3 w-3 shrink-0" />
                          <code className="px-1 py-0.5 bg-muted rounded truncate">
                            {dataPath}/Statements/{info.id}/
                          </code>
                        </div>
                      )}

                      {account.hasStatementFiles && (
                        <div className="text-xs text-muted-foreground">
                          Statement files are present in this account folder.
                        </div>
                      )}
                      {!account.hasStatementFiles && (
                        <div className="text-xs text-muted-foreground">
                          No raw statement files detected yet. Use Upload Files or place exports in this folder manually.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AccountFormDialog
        mode="create"
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSaved={handleAccountSaved}
      />

      <AccountFormDialog
        mode="edit"
        open={editingAccount != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAccount(null);
          }
        }}
        account={editingAccount}
        onSaved={handleAccountSaved}
      />

      <Dialog
        open={deletingAccount != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingAccount(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent
          title="Delete Account"
          description="This removes the account configuration from MoneyInMotion."
          className="max-w-lg"
        >
          {deletingAccount && (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {deletingAccount.config.accountInfo.title ?? deletingAccount.config.accountInfo.id}
                    </p>
                    <p>
                      This deletes only <code>AccountConfig.json</code>. Raw statement files are preserved.
                    </p>
                    {deletingAccount.stats.transactionCount > 0 && (
                      <p>
                        {deletingAccount.stats.transactionCount} imported transaction(s) already exist in merged data and will not be removed automatically.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {deleteError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {deleteError}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeletingAccount(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirmed} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Account Config'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

AccountsPage.displayName = 'AccountsPage';
