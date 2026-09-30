import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  Copy,
  CreditCard,
  FolderOpen,
  Pencil,
  ShoppingBag,
  Trash2,
  Wallet,
} from 'lucide-react';
import { AccountType } from '@moneyinmotion/core';
import type { AccountSummary } from '../../api/client.js';
import type { StatementEntry } from '../../api/imports.js';
import { transactionsHref } from '../../lib/transaction-navigation.js';
import { Button, buttonClassName } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { HelpHint } from '../ui/help-hint.js';
import {
  accountTypeLabels,
  badgeVariantForType,
  formatInstitutionName,
  formatRecordBuildDate,
} from './AccountFormDialog.js';

/** Keep frequent actions visible and infrequent configuration details folded away. */
export function AccountCard({
  account,
  folder,
  dataPath,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  account: AccountSummary;
  folder?: StatementEntry;
  dataPath: string | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const info = account.config.accountInfo;
  const Icon =
    info.type === AccountType.CreditCard
      ? CreditCard
      : info.type === AccountType.OrderHistory
        ? ShoppingBag
        : info.type === AccountType.EPayment
          ? Wallet
          : Building2;
  const color =
    info.type === AccountType.OrderHistory
      ? 'border-l-amber-500 bg-amber-50 text-amber-900'
      : info.type === AccountType.CreditCard
        ? 'border-l-indigo-500 bg-indigo-50 text-indigo-900'
        : 'border-l-teal-500 bg-teal-50 text-teal-900';
  return (
    <article
      aria-label={info.title || info.id}
      className={`rounded-xl border border-border border-l-4 bg-background shadow-sm ${color.split(' ')[0]}`}
    >
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-base font-semibold">{info.title || info.id}</h2>
          <p className="mt-0.5 break-words text-xs text-muted-foreground">
            {formatInstitutionName(info.instituteName)} · {info.id}
          </p>
          <span className="mt-1 block sm:hidden">
            <Badge variant={badgeVariantForType(info.type)}>
              {accountTypeLabels[info.type] ?? 'Account'}
            </Badge>
          </span>
        </div>
        <Badge className="hidden sm:inline-flex" variant={badgeVariantForType(info.type)}>
          {accountTypeLabels[info.type] ?? 'Account'}
        </Badge>
        <div className="ml-auto text-right">
          <p className="text-lg font-semibold tabular-nums">
            {account.stats.transactionCount.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">transactions</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3 text-xs text-muted-foreground">
        <Link
          className="inline-flex items-center gap-1.5 font-medium text-primary underline underline-offset-4"
          to={`/imports?${new URLSearchParams({ tab: 'files', folder: account.relativeDirectory })}`}
        >
          <FolderOpen className="h-4 w-4" aria-hidden />
          {folder
            ? `${folder.fileCount} statement files · ${folder.eligibleCount} eligible`
            : 'Browse statement files'}
        </Link>
        <span className="min-w-0 break-all">Statements/{account.relativeDirectory}/</span>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 py-2">
        <Link
          to={transactionsHref({ account: info.id, basis: 'records', view: 'list' })}
          className={buttonClassName({ variant: 'secondary', size: 'sm' })}
        >
          View transactions
          <ArrowUpRight className="ml-1 h-4 w-4" aria-hidden />
        </Link>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={onDuplicate}>
          <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Duplicate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Remove account
        </Button>
      </div>
      <details className="border-t border-border px-4 py-2 text-xs">
        <summary className="cursor-pointer font-medium text-muted-foreground">
          Account settings &amp; source details
        </summary>
        <div className="mt-3 space-y-2 pb-2 text-muted-foreground">
          <p>
            Files to process: {account.config.fileFilters.join(', ')} ·{' '}
            {account.config.scanSubFolders ? 'Includes subfolders' : 'Top-level files only'}
          </p>
          <p>Matching names: {info.interAccountNameTags?.join(', ') || 'None'}</p>
          <code className="block break-all">
            {dataPath ? `${dataPath}/` : ''}Statements/{account.relativeDirectory}/
          </code>
          <p className="flex items-center">
            Latest record build: {formatRecordBuildDate(account.stats.lastImportedAt)}
            <HelpHint title="Transaction counts and dates">
              <p>
                Counts include payments and order details for this account. Use Overview for
                spending totals. This date is when the latest transaction record was built, not its
                first import date.
              </p>
            </HelpHint>
          </p>
        </div>
      </details>
    </article>
  );
}
