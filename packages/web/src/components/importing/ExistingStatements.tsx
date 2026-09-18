import React from 'react';
import { Link } from 'react-router-dom';
import type { AccountSummary } from '../../api/client.js';
import { useRebuildSnapshot } from '../../api/hooks.js';
import { Button, buttonClassName } from '../ui/button.js';
import { MissingRuleTargets } from '../editing/MissingRuleTargets.js';
import { Notice } from '../ui/notice.js';

/** Make server-side statements usable without asking users to upload them again. */
export const ExistingStatements: React.FC<{ accounts: AccountSummary[] }> = ({ accounts }) => {
  const rebuild = useRebuildSnapshot();
  const storedAccounts = accounts.filter((account) => account.hasStatementFiles);
  if (storedAccounts.length === 0) return null;
  const result = rebuild.data;

  return (
    <section className="rounded-xl border border-border bg-muted/30 p-5 space-y-3 text-left">
      <h2 className="text-lg font-semibold">Rebuild from stored statements</h2>
      <p className="text-sm text-muted-foreground">
        Files are already stored for {storedAccounts.length} account
        {storedAccounts.length === 1 ? '' : 's'}. Build your transaction history from these files to
        browse dates, analyze spending, and apply saved rules. Rebuilding rereads every configured
        account and applies its latest parser, filters, and matching settings. Accounts whose
        configurations were removed will not be included.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={rebuild.isPending} onClick={() => rebuild.mutate(undefined)}>
          {rebuild.isPending ? 'Building transaction history…' : 'Build from existing statements'}
        </Button>
        <Link to="/transactions" className={buttonClassName({ variant: 'outline' })}>
          View transactions
        </Link>
        <Link to="/rules" className={buttonClassName({ variant: 'outline' })}>
          View saved rules
        </Link>
      </div>
      {rebuild.error && (
        <Notice tone="error" title="Transaction history could not be rebuilt">
          The previous snapshot was kept. Review the statement files reported by the server, then
          try again; no incomplete result replaced your current data.
        </Notice>
      )}
      {result && (
        <div role="status" className="text-sm space-y-2">
          <p className="font-medium">
            {result.committed
              ? 'Transaction history is ready.'
              : 'Could not build transaction history. Previous data was kept.'}
          </p>
          <p>
            {result.importedFiles.length} statement files parsed; {result.totalTransactions}{' '}
            transactions; {result.appliedEdits} saved rules processed.
          </p>
          {result.unresolvedEditTargets > 0 && (
            <MissingRuleTargets count={result.unresolvedEditTargets} />
          )}
          {result.committed && (
            <p>
              {result.previousTransactionCount.toLocaleString()} →{' '}
              {result.totalTransactions.toLocaleString()} snapshot records (
              {result.newTransactions >= 0 ? '+' : ''}
              {result.newTransactions.toLocaleString()} net change). Source record counts include
              related payment and order records.
            </p>
          )}
          {result.failedFiles.length > 0 && (
            <ul className="list-disc pl-5">
              {result.failedFiles.map((file) => (
                <li key={file.path}>
                  <code>{file.path}</code>: {file.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
