import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Transactions } from '@moneyinmotion/core';
import { ArrowUpRight, FileText, History, UploadCloud } from 'lucide-react';
import { useAccounts, useTransactions } from '../api/hooks.js';
import { Header } from '../components/layout/Header.js';
import { buttonClassName, Button } from '../components/ui/button.js';
import { StatementFolderUpload } from '../components/importing/StatementFolderUpload.js';
import { ExistingStatements } from '../components/importing/ExistingStatements.js';
import { SourceInventory } from '../components/importing/SourceInventory.js';
import { UploadHistory } from '../components/importing/UploadHistory.js';
import { Notice } from '../components/ui/notice.js';

/** Separate import operations and traceable evidence from account configuration. */
export function ImportsPage() {
  const accounts = useAccounts();
  const snapshot = useTransactions();
  const transactions = useMemo(
    () => (snapshot.data ? Transactions.fromData(snapshot.data) : null),
    [snapshot.data],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab = requestedTab === 'sources' || requestedTab === 'history' ? requestedTab : 'upload';
  const setTab = (next: 'upload' | 'sources' | 'history') => {
    setSearchParams(next === 'upload' ? {} : { tab: next });
  };
  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Your data, traceable
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Imports &amp; sources</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Bring in statements, check what happened, and trace any record back to its source.
            </p>
          </div>
          <Link to="/accounts" className={buttonClassName({ variant: 'outline' })}>
            Manage accounts
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
        <nav
          aria-label="Import workspace"
          className="flex flex-wrap gap-2 border-b border-border pb-3"
        >
          {(
            [
              { id: 'upload', label: 'Import statements', Icon: UploadCloud },
              { id: 'sources', label: 'Statement sources', Icon: FileText },
              { id: 'history', label: 'Upload receipts', Icon: History },
            ] as const
          ).map(({ id, label, Icon }) => (
            <Button
              key={id}
              variant={tab === id ? 'default' : 'ghost'}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          ))}
        </nav>
        {tab === 'upload' && (
          <div className="space-y-5">
            {accounts.isLoading && <p role="status">Loading account folders…</p>}
            {accounts.error && (
              <Notice
                tone="error"
                title="Account folders could not be loaded"
                actions={
                  <Button variant="outline" size="sm" onClick={() => void accounts.refetch()}>
                    Try again
                  </Button>
                }
              >
                Import is unavailable until MoneyInMotion can read the configured accounts. No files
                were uploaded or changed.
              </Notice>
            )}
            {accounts.data && (
              <>
                <StatementFolderUpload accounts={accounts.data} />
                <ExistingStatements accounts={accounts.data} />
              </>
            )}
          </div>
        )}
        {tab === 'sources' && (
          <>
            {snapshot.isLoading && <p role="status">Loading statement sources…</p>}
            {snapshot.error && (
              <Notice
                tone="error"
                title="Statement sources could not be loaded"
                actions={
                  <Button variant="outline" size="sm" onClick={() => void snapshot.refetch()}>
                    Try again
                  </Button>
                }
              >
                MoneyInMotion could not read the current snapshot. No statement or transaction data
                was changed.
              </Notice>
            )}
            {transactions && <SourceInventory transactions={transactions} />}
          </>
        )}
        {tab === 'history' && <UploadHistory />}
      </main>
    </div>
  );
}
