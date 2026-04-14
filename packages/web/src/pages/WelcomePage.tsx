/**
 * Welcome / Getting Started page.
 *
 * Shown when the app has no transactions loaded, guiding new users through
 * the setup process: configure data folder, add accounts, place statement
 * files, and import.
 *
 * @module
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  CreditCard,
  FileText,
  Sparkles,
  CheckCircle,
  ChevronRight,
  ArrowLeft,
  Download,
  Keyboard,
} from 'lucide-react';
import { Button } from '../components/ui/button.js';
import { getConfig, getAccounts, type AccountSummary } from '../api/client.js';
import { useScanStatements } from '../api/hooks.js';
import { cn } from '../lib/utils.js';
import { KEYBOARD_SHORTCUTS } from '../lib/shortcuts.js';

// ---------------------------------------------------------------------------
// Step status helpers
// ---------------------------------------------------------------------------

interface StepStatus {
  dataPath: string | null;
  activeDataPath: string | null;
  restartRequired: boolean;
  dataPathConfigured: boolean;
  accounts: AccountSummary[];
  accountsLoaded: boolean;
}

function useStepStatus(): StepStatus & { refresh: () => void } {
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [activeDataPath, setActiveDataPath] = useState<string | null>(null);
  const [restartRequired, setRestartRequired] = useState(false);
  const [dataPathConfigured, setDataPathConfigured] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const config = await getConfig();
        if (!cancelled) {
          setDataPath(config.dataPath);
          setActiveDataPath(config.activeDataPath);
          setRestartRequired(config.restartRequired);
          setDataPathConfigured(!!config.dataPath && config.dataPath.length > 0);
        }
      } catch {
        if (!cancelled) {
          setDataPath(null);
          setActiveDataPath(null);
          setRestartRequired(false);
          setDataPathConfigured(false);
        }
      }

      try {
        const accts = await getAccounts();
        if (!cancelled) {
          setAccounts(accts);
          setAccountsLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setAccounts([]);
          setAccountsLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    dataPath,
    activeDataPath,
    restartRequired,
    dataPathConfigured,
    accounts,
    accountsLoaded,
    refresh,
  };
}

// ---------------------------------------------------------------------------
// Step component
// ---------------------------------------------------------------------------

interface StepProps {
  number: number;
  title: string;
  icon: React.ReactNode;
  complete: boolean;
  children: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ number, title, icon, complete, children }) => (
  <div className="relative flex gap-4 pb-8 last:pb-0">
    {/* Vertical connector line */}
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'flex items-center justify-center h-10 w-10 rounded-full border-2 shrink-0 transition-colors',
          complete
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
            : 'border-border bg-muted',
        )}
      >
        {complete ? (
          <CheckCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">{number}</span>
        )}
      </div>
      {/* Connector line (hidden on last step via CSS) */}
      <div className="w-px flex-1 bg-border mt-2" />
    </div>

    {/* Content */}
    <div className="flex-1 pt-1.5">
      <h3 className="flex items-center gap-2 text-base font-semibold mb-1">
        {icon}
        {title}
        {complete && (
          <span className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
            Complete
          </span>
        )}
      </h3>
      <div className="space-y-3 text-sm text-muted-foreground">{children}</div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// WelcomePage
// ---------------------------------------------------------------------------

/**
 * Getting-started page that walks first-time users through configuration,
 * account setup, file placement, and import.
 */
export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    dataPath,
    activeDataPath,
    restartRequired,
    dataPathConfigured,
    accounts,
    accountsLoaded,
    refresh,
  } = useStepStatus();
  const scanMutation = useScanStatements();

  const hasAccounts = accounts.length > 0;
  const accountsWithStatementFiles = accounts.filter((account) => account.hasStatementFiles);
  const hasStatementFiles = accountsWithStatementFiles.length > 0;
  const hasImportedTransactions = accounts.some(
    (account) => account.stats.transactionCount > 0,
  );
  const importJustRan =
    scanMutation.isSuccess === true &&
    (scanMutation.data?.totalTransactions ?? 0) > 0;

  const handleImport = () => {
    scanMutation.mutate(undefined, {
      onSuccess: () => {
        refresh();
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-4 h-14 px-4 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Go back"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-bold text-lg">Getting Started</h1>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        {/* Welcome hero */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Welcome to MoneyInMotion</h2>
          <p className="text-muted-foreground">
            Follow the steps below to set up your financial data and start exploring your
            transactions. It only takes a few minutes.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-10">
          {/* Step 1: Configure Data Folder */}
          <Step
            number={1}
            title="Configure Data Folder"
            icon={<FolderOpen className="h-5 w-5" />}
            complete={dataPathConfigured}
          >
            <p>Choose where MoneyInMotion stores your financial data.</p>
            {dataPath !== null && (
              <p className="text-xs">
                Current path:{' '}
                <code className="px-1.5 py-0.5 bg-muted rounded text-foreground">
                  {dataPath || '(not set)'}
                </code>
              </p>
            )}
            {restartRequired && activeDataPath && activeDataPath !== dataPath && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                The server is still using{' '}
                <code className="px-1 py-0.5 bg-background rounded">{activeDataPath}</code>.
                Restart the server for the saved path to take effect — until then,
                Import will scan the old folder.
              </p>
            )}
            <div>
              <Link to="/settings">
                <Button variant="outline" size="sm">
                  {dataPathConfigured ? 'Change' : 'Configure'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </Step>

          {/* Step 2: Add Accounts */}
          <Step
            number={2}
            title="Add Accounts"
            icon={<CreditCard className="h-5 w-5" />}
            complete={hasAccounts}
          >
            <p>Tell MoneyInMotion about your bank accounts and credit cards.</p>
            {accountsLoaded && (
              <p className="text-xs">
                {accounts.length === 0
                  ? 'No accounts configured yet.'
                  : `${accounts.length} account${accounts.length === 1 ? '' : 's'} configured.`}
              </p>
            )}
            <div>
              <Link to="/accounts">
                <Button variant="outline" size="sm">
                  {hasAccounts ? 'Manage Accounts' : 'Add Account'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </Step>

          {/* Step 3: Upload + Import */}
          <Step
            number={3}
            title="Import Statements"
            icon={<Sparkles className="h-5 w-5" />}
            complete={hasImportedTransactions || importJustRan}
          >
            <p>
              Upload statement files (CSV, JSON, or IIF) from the Accounts
              page — one account at a time, or several at once. After files
              are uploaded, click <strong>Import</strong> and MoneyInMotion
              will parse, deduplicate, and categorize them for you.
            </p>
            {accountsLoaded && hasAccounts && (
              <p className="text-xs">
                {hasStatementFiles
                  ? `Statement files detected for ${accountsWithStatementFiles.length} account${accountsWithStatementFiles.length === 1 ? '' : 's'}.`
                  : 'No statement files uploaded yet.'}
              </p>
            )}

            {!dataPathConfigured && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Configure the data folder first (Step 1).
              </p>
            )}
            {dataPathConfigured && !hasAccounts && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Add at least one account first (Step 2).
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Link to="/accounts">
                <Button variant="outline" size="sm" disabled={!hasAccounts}>
                  <FileText className="h-4 w-4 mr-1.5" />
                  Upload Files
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={scanMutation.isPending || !hasAccounts}
              >
                <Download className="h-4 w-4 mr-1.5" />
                {scanMutation.isPending ? 'Importing...' : 'Import'}
              </Button>
              {scanMutation.isSuccess && scanMutation.data && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/')}
                >
                  Start Exploring
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>

            <p className="text-xs">
              Supported formats: <strong>CSV</strong> (most banks),{' '}
              <strong>JSON</strong> (Etsy), <strong>IIF</strong> (QuickBooks).
              Re-importing the same file is safe — duplicates are merged by
              content hash.
            </p>

            {scanMutation.isSuccess && scanMutation.data && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-900/20">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">
                  Import complete
                </p>
                <p className="text-emerald-900/90 dark:text-emerald-200/90 mt-1">
                  Found {scanMutation.data.totalTransactions} transaction
                  {scanMutation.data.totalTransactions === 1 ? '' : 's'}!{' '}
                  ({scanMutation.data.newTransactions} new)
                </p>
                {scanMutation.data.failedFiles?.length > 0 && (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-900/40 dark:bg-amber-900/20">
                    <p className="font-medium text-amber-900 dark:text-amber-200">
                      {scanMutation.data.failedFiles.length} file
                      {scanMutation.data.failedFiles.length === 1 ? '' : 's'} could not be parsed:
                    </p>
                    <ul className="mt-1 space-y-0.5 text-amber-900/90 dark:text-amber-200/90">
                      {scanMutation.data.failedFiles.map((f) => (
                        <li key={f.path}>
                          <code>{f.path}</code> — {f.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {scanMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {scanMutation.error instanceof Error
                  ? scanMutation.error.message
                  : 'Import failed. Make sure your data folder and accounts are configured.'}
              </div>
            )}
          </Step>
        </div>

        {/* Keyboard Shortcuts */}
        <section className="border-t border-border pt-6 mb-8">
          <h3 className="flex items-center gap-2 text-base font-semibold mb-3">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Shortcut
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {KEYBOARD_SHORTCUTS.map((s) => (
                  <tr key={s.keys} className="border-t border-border">
                    <td className="px-4 py-2">
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                        {s.keys}
                      </kbd>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{s.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer link */}
        <div className="text-center text-sm text-muted-foreground pb-8">
          <p>
            Need help?{' '}
            <a
              href="https://github.com/sytelus/MoneyInMotion"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              View documentation on GitHub
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

WelcomePage.displayName = 'WelcomePage';
