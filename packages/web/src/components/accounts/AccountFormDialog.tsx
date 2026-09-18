/** Account configuration editor; raw statements and transaction schemas are unchanged. */
import React, { useState } from 'react';
import {
  AccountType,
  validateAccountConfigSupport,
  type AccountConfig,
  type AccountInfo,
} from '@moneyinmotion/core';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { createAccount, updateAccount, type AccountSummary } from '../../api/client.js';
import { reconnectAccount } from '../../api/imports.js';

const institutionOptions = [
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

export const accountTypeLabels: Record<number, string> = {
  [AccountType.CreditCard]: 'Credit Card',
  [AccountType.BankChecking]: 'Checking',
  [AccountType.BankSavings]: 'Savings',
  [AccountType.OrderHistory]: 'Order History',
  [AccountType.EPayment]: 'E-Payment',
};

export function badgeVariantForType(
  type: AccountType,
): 'default' | 'secondary' | 'info' | 'success' | 'warning' {
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

export function formatInstitutionName(instituteName: string): string {
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

export function formatRecordBuildDate(value: string | null): string {
  if (!value) {
    return 'Not recorded';
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
  const parsedFileFilters = parseCsvList(form.fileFilters);
  return {
    accountInfo: {
      id: form.accountId.trim(),
      instituteName: form.instituteName.trim(),
      title: form.title.trim(),
      type: form.accountType,
      requiresParent: form.accountType === AccountType.OrderHistory,
      interAccountNameTags: parseCsvList(form.interAccountNameTags),
    },
    fileFilters: parsedFileFilters.length > 0 ? parsedFileFilters : ['*.csv'],
    scanSubFolders: form.scanSubFolders,
  };
}

type AccountDialogMode = 'create' | 'edit';

interface AccountFormDialogProps {
  mode: AccountDialogMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountSummary | null;
  reconnectFolder?: string | null;
  originalAccount?: AccountInfo | null;
  onSaved: (savedAccount: AccountSummary, previousId: string | null) => Promise<void> | void;
}

export const AccountFormDialog: React.FC<AccountFormDialogProps> = ({
  mode,
  open,
  onOpenChange,
  account,
  reconnectFolder,
  originalAccount,
  onSaved,
}) => {
  const editedConfig = mode === 'edit' ? account?.config : undefined;
  const initialInfo = editedConfig?.accountInfo ?? originalAccount;
  const [accountId, setAccountId] = useState(initialInfo?.id ?? '');
  const [title, setTitle] = useState(initialInfo?.title ?? initialInfo?.id ?? '');
  const [instituteName, setInstituteName] = useState(initialInfo?.instituteName ?? 'Generic');
  const [accountType, setAccountType] = useState<AccountType>(
    initialInfo?.type ?? AccountType.CreditCard,
  );
  const [fileFilters, setFileFilters] = useState(
    editedConfig ? formatCsvList(editedConfig.fileFilters) : '*.csv',
  );
  const [interAccountNameTags, setInterAccountNameTags] = useState(
    formatCsvList(initialInfo?.interAccountNameTags),
  );
  const [scanSubFolders, setScanSubFolders] = useState(editedConfig?.scanSubFolders ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOrderHistory = accountType === AccountType.OrderHistory;
  const previousId = account?.config.accountInfo.id ?? null;
  const canEditId =
    !originalAccount &&
    (mode === 'create' ||
      !account ||
      (account.stats.transactionCount === 0 && !account.hasStatementFiles));

  const handleSubmit = async () => {
    if (!accountId.trim() || !title.trim()) {
      setError('Account ID and title are required.');
      return;
    }
    if (!instituteName.trim()) {
      setError('Institution is required.');
      return;
    }

    const config = buildAccountConfig({
      accountId,
      title,
      instituteName,
      accountType,
      fileFilters,
      interAccountNameTags,
      scanSubFolders,
    });
    const supportError = validateAccountConfigSupport(config);
    if (supportError) {
      setError(supportError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const saved = reconnectFolder
        ? await reconnectAccount(reconnectFolder, config)
        : mode === 'create'
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSaving) onOpenChange(next);
      }}
    >
      <DialogContent
        title={
          reconnectFolder
            ? 'Reconnect account folder'
            : mode === 'create'
              ? 'Add Account'
              : 'Edit Account'
        }
        description="Configure how MoneyInMotion should discover and interpret files for this account."
        className="max-w-xl"
      >
        <div className="space-y-5">
          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {reconnectFolder && (
            <div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-950 dark:bg-sky-950/30 dark:text-sky-100">
              <p className="font-medium break-all">Reconnect Statements/{reconnectFolder}/</p>
              <p className="mt-1">
                {originalAccount
                  ? 'The original account identity was found in surviving snapshot records and is locked to preserve transaction IDs and rule targets. Institution, type, title, and matching tags are prefilled from those records.'
                  : 'No unique account identity was found in the current snapshot. Enter the original account ID and settings from your backup; the folder name is not necessarily the account ID. Choosing a different ID can invalidate saved rule targets.'}
              </p>
              <p className="mt-2">
                Statement files remain untouched. File filters and subfolder settings are not
                retained in snapshot records: review the defaults below, then rebuild from Imports
                after saving.
              </p>
            </div>
          )}
          {mode === 'edit' && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
              Changes update account configuration only. Rebuild from Imports to refresh existing
              records, matching, and reporting. Changing parser, type, or file filters can change
              which records are included.
            </p>
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
              {reconnectFolder ? (
                'Use the same account ID as the original imported records.'
              ) : (
                <>
                  This becomes the folder name under <code>Statements/</code>. Use letters, digits,
                  hyphens, underscores, or dots; no spaces.
                </>
              )}
            </p>
            {!canEditId && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Account ID is locked to preserve existing transactions and their saved rule targets.
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
            <Input
              id={`${mode}-institution`}
              list={`${mode}-institution-options`}
              value={instituteName}
              onChange={(e) => setInstituteName(e.target.value)}
              placeholder="e.g. Chase or Generic"
            />
            <datalist id={`${mode}-institution-options`}>
              {institutionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Enter the institution name. Known names select a specialized parser; other names use
              the generic statement parser.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Account Type</span>
            <p className="text-xs text-muted-foreground">
              This controls how transactions are grouped and matched.
            </p>
            <div className="space-y-1.5">
              {accountTypeOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
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
                Order history accounts (Amazon, Etsy) need match tags so purchases can be reconciled
                to the credit-card charge.
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
              Comma-separated name fragments used for transfer matching and Amazon/Etsy
              parent-charge matching.
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
              Comma-separated filters: <code>*.csv</code>, an exact filename, or <code>*</code>.
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
                Enable this if your bank export files are organized in yearly or monthly
                subdirectories.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving
              ? mode === 'create'
                ? 'Creating...'
                : 'Saving...'
              : reconnectFolder
                ? 'Reconnect folder'
                : mode === 'create'
                  ? 'Create Account'
                  : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
