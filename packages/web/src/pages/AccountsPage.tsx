/**
 * Account management page.
 *
 * Lists all configured accounts and provides a dialog for creating new ones.
 * Replaces the Phase 6 placeholder.
 *
 * @module
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, CreditCard, Building2, FolderOpen, CheckCircle } from 'lucide-react';
import { AccountType, type AccountConfig } from '@moneyinmotion/core';
import { Button } from '../components/ui/button.js';
import { Badge } from '../components/ui/badge.js';
import { Input } from '../components/ui/input.js';
import { Select, type SelectOption } from '../components/ui/select.js';
import { Dialog, DialogContent, DialogFooter } from '../components/ui/dialog.js';
import { useAccounts } from '../api/hooks.js';
import { createAccount, getConfig } from '../api/client.js';

// ---------------------------------------------------------------------------
// Lookup tables for form options
// ---------------------------------------------------------------------------

const institutionOptions: SelectOption[] = [
  { value: 'American Express', label: 'American Express' },
  { value: 'Barclay Bank', label: 'Barclay Bank' },
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
    case AccountType.CreditCard: return 'default';
    case AccountType.BankChecking: return 'info';
    case AccountType.BankSavings: return 'success';
    case AccountType.OrderHistory: return 'warning';
    case AccountType.EPayment: return 'secondary';
    default: return 'secondary';
  }
}

// ---------------------------------------------------------------------------
// Add Account Dialog
// ---------------------------------------------------------------------------

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (accountId: string) => void;
}

const AddAccountDialog: React.FC<AddAccountDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const [accountId, setAccountId] = useState('');
  const [title, setTitle] = useState('');
  const [instituteName, setInstituteName] = useState('Generic');
  const [accountType, setAccountType] = useState<AccountType>(AccountType.CreditCard);
  const [fileFilters, setFileFilters] = useState('*.csv');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!accountId.trim() || !title.trim()) {
      setError('Account ID and title are required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const config: AccountConfig = {
        accountInfo: {
          id: accountId.trim(),
          instituteName,
          title: title.trim(),
          type: accountType,
          requiresParent: accountType === AccountType.OrderHistory,
        },
        fileFilters: fileFilters
          .split(',')
          .map((f) => f.trim())
          .filter((f) => f.length > 0),
        scanSubFolders: true,
      };

      await createAccount(config);
      const createdId = accountId.trim();
      onCreated(createdId);
      onOpenChange(false);

      // Reset form
      setAccountId('');
      setTitle('');
      setInstituteName('Generic');
      setAccountType(AccountType.CreditCard);
      setFileFilters('*.csv');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsSaving(false);
    }
  };

  const isOrderHistory = accountType === AccountType.OrderHistory;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add Account"
        description="Configure a new financial account for importing statements."
        className="max-w-xl"
      >
        <div className="space-y-5">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="account-id" className="text-sm font-medium">
              Account ID
            </label>
            <Input
              id="account-id"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="e.g. amex-plat"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              A short, unique identifier. This becomes the folder name for statement files.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="account-title" className="text-sm font-medium">
              Account Title
            </label>
            <Input
              id="account-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Platinum Card"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="institution" className="text-sm font-medium">
              Institution
            </label>
            <Select
              id="institution"
              value={instituteName}
              onChange={(e) => setInstituteName(e.target.value)}
              options={institutionOptions}
            />
            <p className="text-xs text-muted-foreground">
              Select your bank or card issuer. Choose &lsquo;Generic&rsquo; if yours isn&rsquo;t listed — it works with most CSV formats.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Account Type</span>
            <p className="text-xs text-muted-foreground">
              Select the type of financial account.
            </p>
            <div className="space-y-1.5">
              {accountTypeOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="accountType"
                    value={opt.value}
                    checked={accountType === opt.value}
                    onChange={() => setAccountType(opt.value)}
                    className="accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {isOrderHistory && (
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3 text-xs text-yellow-800 dark:text-yellow-200">
                Order history accounts (Amazon, Etsy) match purchases to your credit card charges. They require a parent credit card account.
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="file-filters" className="text-sm font-medium">
              File Filters
            </label>
            <Input
              id="file-filters"
              value={fileFilters}
              onChange={(e) => setFileFilters(e.target.value)}
              placeholder="*.csv"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated glob patterns for statement files
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Creating...' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// AccountsPage
// ---------------------------------------------------------------------------

/**
 * Full account management page. Lists configured accounts and allows adding
 * new ones through a dialog.
 */
export const AccountsPage: React.FC = () => {
  const { data: accounts, isLoading, error, refetch } = useAccounts();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);

  // Load config to get dataPath
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await getConfig();
        if (!cancelled) {
          setDataPath(config.dataPath);
        }
      } catch {
        // Silently ignore — folder paths just won't be shown
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAccountCreated = (accountId: string) => {
    setCreatedAccountId(accountId);
    refetch();
  };

  const dismissSuccessMessage = () => {
    setCreatedAccountId(null);
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

      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground mb-6">
          Each account represents a bank account, credit card, or payment service.
          Add your accounts here, then place statement files (CSV, JSON, IIF) in the account folders.
        </p>

        {/* Success message after creating an account */}
        {createdAccountId && dataPath && (
          <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="font-medium text-green-800 dark:text-green-200">
                  Account created! Now place your statement files in:
                </p>
                <code className="block text-sm bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 px-3 py-2 rounded">
                  {dataPath}/Statements/{createdAccountId}/
                </code>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Download transaction files from your bank&rsquo;s website. Most banks offer CSV export.
                </p>
              </div>
              <button
                onClick={dismissSuccessMessage}
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
            {accounts.map((config) => {
              const info = config.accountInfo;
              return (
                <div
                  key={info.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-secondary shrink-0">
                    <Building2 className="h-5 w-5 text-secondary-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {info.title ?? info.id}
                      </span>
                      <Badge variant={badgeVariantForType(info.type)}>
                        {accountTypeLabels[info.type] ?? 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{info.instituteName}</span>
                      <span className="text-border">|</span>
                      <span>ID: {info.id}</span>
                      {config.fileFilters.length > 0 && (
                        <>
                          <span className="text-border">|</span>
                          <span>Files: {config.fileFilters.join(', ')}</span>
                        </>
                      )}
                    </div>
                    {dataPath && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                        <FolderOpen className="h-3 w-3 shrink-0" />
                        <code className="px-1 py-0.5 bg-muted rounded truncate">
                          {dataPath}/Statements/{info.id}/
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AddAccountDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onCreated={handleAccountCreated}
      />
    </div>
  );
};

AccountsPage.displayName = 'AccountsPage';
