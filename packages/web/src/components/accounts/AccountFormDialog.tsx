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
import { Select } from '../ui/select.js';
import { HelpHint } from '../ui/help-hint.js';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { Notice } from '../ui/notice.js';
import {
  createAccount,
  updateAccount,
  type AccountSummary,
  type SnapshotBuildResponse,
} from '../../api/client.js';
import { reconnectAccount } from '../../api/imports.js';
import { useRebuildSnapshot } from '../../api/hooks.js';

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

/** Configuration saving and rebuilding are separate operations; report both honestly. */
export interface AccountSaveOutcome {
  rebuild: SnapshotBuildResponse | null;
  rebuildError: string | null;
}

interface AccountFormDialogProps {
  mode: AccountDialogMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: AccountSummary | null;
  /** Copies settings into a new, unsaved account. The new ID is intentionally blank. */
  templateAccount?: AccountSummary | null;
  reconnectFolder?: string | null;
  originalAccount?: AccountInfo | null;
  onSaved: (savedAccount: AccountSummary, outcome: AccountSaveOutcome) => Promise<void> | void;
}

export const AccountFormDialog: React.FC<AccountFormDialogProps> = ({
  mode,
  open,
  onOpenChange,
  account,
  templateAccount,
  reconnectFolder,
  originalAccount,
  onSaved,
}) => {
  const editedConfig = mode === 'edit' ? account?.config : undefined;
  const templateConfig = mode === 'create' ? templateAccount?.config : undefined;
  const initialInfo = editedConfig?.accountInfo ?? originalAccount ?? templateConfig?.accountInfo;
  const [accountId, setAccountId] = useState(templateConfig ? '' : (initialInfo?.id ?? ''));
  const [title, setTitle] = useState(initialInfo?.title ?? initialInfo?.id ?? '');
  const [instituteName, setInstituteName] = useState(initialInfo?.instituteName ?? 'Generic');
  const [accountType, setAccountType] = useState<AccountType>(
    initialInfo?.type ?? AccountType.CreditCard,
  );
  const [fileFilters, setFileFilters] = useState(
    editedConfig || templateConfig
      ? formatCsvList((editedConfig ?? templateConfig)?.fileFilters)
      : '*.csv',
  );
  const [interAccountNameTags, setInterAccountNameTags] = useState(
    formatCsvList(initialInfo?.interAccountNameTags),
  );
  const [scanSubFolders, setScanSubFolders] = useState(
    (editedConfig ?? templateConfig)?.scanSubFolders ?? true,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rebuild = useRebuildSnapshot();
  const shouldRebuild = mode === 'edit' || !!reconnectFolder;
  const [phase, setPhase] = useState<'save' | 'rebuild'>('save');

  const isOrderHistory = accountType === AccountType.OrderHistory;
  const previousId = account?.config.accountInfo.id ?? null;
  const canEditId =
    !originalAccount &&
    (mode === 'create' ||
      !account ||
      (account.stats.transactionCount === 0 && !account.hasStatementFiles));

  const handleSubmit = async () => {
    if (isSaving) return;
    if (!accountId.trim() || !title.trim()) {
      setError('Account ID and title are required.');
      return;
    }
    if (!instituteName.trim()) {
      setError('Institution is required.');
      return;
    }
    if (
      accountId.trim() === '.' ||
      accountId.includes('..') ||
      !/^[a-zA-Z0-9._-]+$/.test(accountId.trim())
    ) {
      setError(
        'Use letters, numbers, hyphens, underscores or dots for the account ID. Spaces, path separators, "." and ".." are not allowed.',
      );
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
    setPhase('save');
    setError(null);

    try {
      const saved = reconnectFolder
        ? await reconnectAccount(reconnectFolder, config)
        : mode === 'create'
          ? await createAccount(config)
          : await updateAccount(previousId ?? config.accountInfo.id, config);

      const outcome: AccountSaveOutcome = { rebuild: null, rebuildError: null };
      if (shouldRebuild) {
        setPhase('rebuild');
        try {
          outcome.rebuild = await rebuild.mutateAsync();
        } catch (error) {
          // The account is already saved. A failed second step must never be
          // described as a failed save or cause a retry to create it twice.
          outcome.rebuildError =
            error instanceof Error ? error.message : 'Could not rebuild transactions.';
        }
      }
      await onSaved(saved, outcome);
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
            ? 'Configure account folder'
            : templateAccount
              ? 'Duplicate account settings'
              : mode === 'create'
                ? 'Add Account'
                : 'Edit Account'
        }
        description={
          templateAccount
            ? 'Review the copied settings and create a separate account only when you are ready.'
            : 'Choose which statement files to read and how to match their transactions.'
        }
        className="max-w-3xl"
      >
        <form
          id={`${mode}-account-form`}
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <fieldset disabled={isSaving} className="grid min-w-0 gap-5 sm:grid-cols-2">
            {error && (
              <Notice className="sm:col-span-2" tone="error" title="Account could not be saved">
                {error}
              </Notice>
            )}

            {templateAccount && (
              <p className="sm:col-span-2 rounded-lg bg-info p-3 text-sm text-info-foreground">
                Settings copied — nothing has been saved. Enter a new account ID and review the
                settings from <strong>{templateAccount.config.accountInfo.title}</strong>.
              </p>
            )}

            {reconnectFolder && (
              <div className="sm:col-span-2 rounded-lg bg-info p-3 text-sm text-info-foreground">
                <p className="font-medium break-all">Statements/{reconnectFolder}/</p>
                <p className="mt-1">
                  {originalAccount
                    ? 'Original account identity has been filled in. The account ID stays fixed so saved corrections still apply. File patterns and subfolder settings are not retained in transactions; check the defaults below.'
                    : 'For an existing account, use its original ID and settings from a backup so saved corrections still apply. For a new account, choose a unique ID.'}
                </p>
                <p className="mt-2">
                  Review the file types and subfolder setting below. Saving also rebuilds
                  transactions from all configured accounts.
                </p>
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
                {!canEditId ? (
                  'Fixed because this account has imported transactions or stored statements.'
                ) : reconnectFolder ? (
                  'Use the original ID if this folder belonged to a previously imported account.'
                ) : (
                  <>
                    This becomes the folder name under <code>Statements/</code>. Use letters,
                    digits, hyphens, underscores, or dots; no spaces.
                  </>
                )}
              </p>
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
                Select your provider, or enter your bank’s name for a standard CSV statement.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor={`${mode}-account-type`} className="text-sm font-medium">
                Account Type
              </label>
              <Select
                id={`${mode}-account-type`}
                value={String(accountType)}
                onChange={(event) => setAccountType(Number(event.target.value) as AccountType)}
                options={accountTypeOptions.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Bank, card, payment service or purchase history.
              </p>
              {isOrderHistory && (
                <p className="text-xs text-info-foreground">
                  Amazon and Etsy orders need matching names to find their payments.
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor={`${mode}-match-tags`} className="text-sm font-medium">
                Transaction matching names
              </label>
              <Input
                id={`${mode}-match-tags`}
                value={interAccountNameTags}
                onChange={(e) => setInterAccountNameTags(e.target.value)}
                placeholder="e.g. AMEX, AMERICAN EXPRESS"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated text to look for in other statements, such as{' '}
                <strong>ETSY, PAYPAL</strong> or <strong>AMEX</strong>. Used to match purchases to
                payments and transfers between accounts.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${mode}-file-filters`} className="text-sm font-medium">
                Statement files to process
              </label>
              <Input
                id={`${mode}-file-filters`}
                value={fileFilters}
                onChange={(e) => setFileFilters(e.target.value)}
                placeholder="*.csv"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated filename patterns, for example <code>*.csv, *.json</code>. Other
                files are ignored. Supported formats: CSV, JSON and IIF; Excel files must be
                exported as CSV.
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
                <span className="font-medium">Include subfolders</span>
                <span className="block text-xs text-muted-foreground">
                  Read statements in year, month or other folders inside this account.
                </span>
              </span>
            </label>
          </fieldset>
        </form>

        <DialogFooter className="sticky -bottom-6 -mx-6 mb-[-1.5rem] flex-wrap items-center border-t border-border bg-background px-6 py-4">
          {shouldRebuild && (
            <p className="mr-auto flex items-center text-xs text-muted-foreground">
              Refreshes all configured accounts.
              <HelpHint title="Save and rebuild">
                <p>
                  Saves this account’s settings, then rereads stored statements for every configured
                  account and applies saved rules. Accounts without settings are excluded. If a file
                  cannot be read, the current transactions stay available and the result lists the
                  files to fix.
                </p>
              </HelpHint>
            </p>
          )}
          <Button variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={`${mode}-account-form`} disabled={isSaving}>
            {isSaving
              ? phase === 'rebuild'
                ? 'Rebuilding…'
                : mode === 'create'
                  ? 'Creating...'
                  : 'Saving...'
              : shouldRebuild
                ? 'Save and rebuild'
                : templateAccount
                  ? 'Create duplicate account'
                  : mode === 'create'
                    ? 'Create Account'
                    : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
