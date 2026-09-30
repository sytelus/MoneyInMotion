import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Transactions } from '@moneyinmotion/core';
import { ArrowUpRight, FileText, FolderTree, History, UploadCloud } from 'lucide-react';
import { useAccounts, useTransactions } from '../api/hooks.js';
import { Header } from '../components/layout/Header.js';
import { buttonClassName, Button } from '../components/ui/button.js';
import { StatementFolderUpload } from '../components/importing/StatementFolderUpload.js';
import { ExistingStatements } from '../components/importing/ExistingStatements.js';
import { SourceInventory } from '../components/importing/SourceInventory.js';
import { UploadHistory } from '../components/importing/UploadHistory.js';
import { Notice } from '../components/ui/notice.js';
import { StatementExplorer } from '../components/importing/StatementExplorer.js';
import { Select } from '../components/ui/select.js';

const workspaceTabs = [
  { id: 'upload', label: 'Import statements', Icon: UploadCloud },
  { id: 'files', label: 'Statement explorer', Icon: FolderTree },
  { id: 'sources', label: 'Imported transactions by file', Icon: FileText },
  { id: 'history', label: 'Upload history', Icon: History },
] as const;
type WorkspaceTab = (typeof workspaceTabs)[number]['id'];

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
  const tab =
    requestedTab === 'sources' || requestedTab === 'history' || requestedTab === 'files'
      ? requestedTab
      : 'upload';
  const setTab = (next: WorkspaceTab) => {
    setSearchParams(next === 'upload' ? {} : { tab: next });
  };
  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="workspace">
        <div className="workspace-heading">
          <div>
            <h1>Statements &amp; imports</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Import statements, browse stored files and review previous uploads.
            </p>
          </div>
          <Link to="/accounts" className={buttonClassName({ variant: 'outline' })}>
            Manage accounts
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
        <label className="block text-xs font-medium sm:hidden">
          Workspace view
          <Select
            className="mt-1"
            value={tab}
            onChange={(event) => setTab(event.target.value as WorkspaceTab)}
            options={workspaceTabs.map((item) => ({ value: item.id, label: item.label }))}
          />
        </label>
        <nav
          aria-label="Import workspace"
          className="hidden flex-wrap gap-2 border-b border-border pb-3 sm:flex"
        >
          {workspaceTabs.map(({ id, label, Icon }) => (
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
        {tab === 'files' && <StatementExplorer transactions={transactions} />}
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
