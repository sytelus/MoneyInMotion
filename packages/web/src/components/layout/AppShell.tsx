/**
 * Main application shell providing a three-column layout:
 *   - Left sidebar (w-64): Year/month navigation
 *   - Center: Transaction list
 *   - Right sidebar (w-72): Transaction details / summary
 *
 * Integrates keyboard shortcuts and editing dialogs for transactions.
 *
 * @module
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '@moneyinmotion/core';
import {
  createAuditInfo,
  createUUID,
  ScopeType,
  createScopeFilter,
  editValue,
  voidedEditValue,
  type TransactionEditData,
  type EditedValues,
} from '@moneyinmotion/core';
import { Header } from './Header.js';
import { YearMonthNav } from '../navigation/YearMonthNav.js';
import { TransactionList } from '../transactions/TransactionList.js';
import { TransactionSummary } from '../transactions/TransactionSummary.js';
import { TransactionEditWorkflow } from '../editing/TransactionEditWorkflow.js';
import { useTransactionNavigation } from '../../hooks/useTransactionNavigation.js';
import { AlertCircle, CalendarRange, PanelRight, Sparkles, X } from 'lucide-react';
import { buttonClassName } from '../ui/button.js';
import { useTransactions, useApplyEdits, useAccounts } from '../../api/hooks.js';
import { ExistingStatements } from '../importing/ExistingStatements.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';

type EditDialog = 'categoryPath' | 'note' | 'isFlagged' | 'attributes' | null;

const EmptyTransactions: React.FC = () => {
  const accounts = useAccounts();
  if (accounts.isLoading) return <p>Checking existing statements…</p>;
  if (accounts.error)
    return (
      <div role="alert">
        <p>Could not check existing accounts: {accounts.error.message}</p>
        <Link to="/accounts" className={buttonClassName({ variant: 'outline' })}>
          Review accounts
        </Link>
        <Link to="/settings" className={buttonClassName({ variant: 'outline' })}>
          Settings
        </Link>
      </div>
    );
  if (accounts.data?.some((account) => account.hasStatementFiles)) {
    return <ExistingStatements accounts={accounts.data} />;
  }
  return (
    <>
      <h2 className="text-xl font-semibold">No transaction history yet</h2>
      <p className="text-muted-foreground">
        {accounts.data?.length
          ? 'Your accounts are configured. Add statements to build your history.'
          : 'Set up your accounts and add statement files to get started.'}
      </p>
      <Link to="/welcome" className={buttonClassName({ size: 'lg' })}>
        Get Started
      </Link>
      <Link to="/rules" className={buttonClassName({ variant: 'outline' })}>
        View saved rules
      </Link>
    </>
  );
};

/**
 * Root layout component. Fetches transactions on mount and renders the
 * three-column layout with header, navigation sidebar, transaction list,
 * and detail sidebar. Manages edit dialog state and keyboard shortcuts.
 */
export const AppShell: React.FC = () => {
  const { data, isLoading, error } = useTransactions();
  useTransactionNavigation(data);
  const transactions = useTransactionsStore((s) => s.transactions);
  const selectedIds = useTransactionsStore((s) => s.selectedTransactionIds);
  const selectedYear = useTransactionsStore((s) => s.selectedYear);
  const selectedMonth = useTransactionsStore((s) => s.selectedMonth);

  const applyEdits = useApplyEdits();

  const [activeDialog, setActiveDialog] = useState<EditDialog>(null);
  const [editingTransactions, setEditingTransactions] = useState<Transaction[]>([]);
  const [editDefaults, setEditDefaults] = useState<EditedValues | undefined>(undefined);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [compactPanel, setCompactPanel] = useState<'period' | 'details' | null>(null);

  const selectedTransactions = useMemo(() => {
    if (!transactions) return [];
    return [...selectedIds].flatMap((id) => transactions.getTransaction(id) ?? []);
  }, [transactions, selectedIds]);
  const selectedTransaction = selectedTransactions.length === 1 ? selectedTransactions[0] : null;

  // Edit dialog openers
  const openEditDialog = useCallback(
    (dialog: EditDialog, tx?: Transaction) => {
      const targets = tx ? [tx] : selectedTransactions;
      if (!targets.length) return;
      setEditingTransactions(targets);
      setEditDefaults(undefined);
      setActiveDialog(dialog);
    },
    [selectedTransactions],
  );

  const closeDialogs = useCallback(() => {
    setActiveDialog(null);
    setEditingTransactions([]);
  }, []);

  // Flag toggle handler
  const handleToggleFlag = useCallback(
    (tx?: Transaction) => {
      if (!tx && selectedTransactions.length > 1) {
        openEditDialog('isFlagged');
        return;
      }
      const target = tx ?? selectedTransaction;
      if (!target || applyEdits.isPending) return;

      const edit: TransactionEditData = {
        id: createUUID(),
        auditInfo: createAuditInfo('web-ui'),
        scopeFilters: [createScopeFilter(ScopeType.TransactionId, [target.id])],
        values: {
          isFlagged: editValue(!target.isUserFlagged),
        },
        sourceId: 'web-ui',
      };

      setQuickEditError(null);
      applyEdits.mutate([edit], {
        onSuccess: () =>
          setSuccess(
            target.isUserFlagged
              ? 'Review mark cleared. Original statement values are unchanged.'
              : 'Transaction marked for review. This does not exclude it from totals.',
          ),
        onError: (error) => {
          setQuickEditError(error instanceof Error ? error.message : 'Failed to update the flag.');
        },
      });
    },
    [selectedTransaction, selectedTransactions.length, openEditDialog, applyEdits],
  );

  // Flag remove handler
  const handleRemoveFlag = useCallback(
    (tx?: Transaction) => {
      if (!tx && selectedTransactions.length > 1) {
        openEditDialog('isFlagged');
        setEditDefaults({ isFlagged: voidedEditValue<boolean>() });
        return;
      }
      const target = tx ?? selectedTransaction;
      if (!target || applyEdits.isPending) return;

      const edit: TransactionEditData = {
        id: createUUID(),
        auditInfo: createAuditInfo('web-ui'),
        scopeFilters: [createScopeFilter(ScopeType.TransactionId, [target.id])],
        values: {
          isFlagged: voidedEditValue<boolean>(),
        },
        sourceId: 'web-ui',
      };

      setQuickEditError(null);
      applyEdits.mutate([edit], {
        onSuccess: () => setSuccess('Review mark restored to its imported state.'),
        onError: (error) => {
          setQuickEditError(error instanceof Error ? error.message : 'Failed to remove the flag.');
        },
      });
    },
    [selectedTransaction, selectedTransactions.length, openEditDialog, applyEdits],
  );

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    onEditCategory: () => openEditDialog('categoryPath'),
    onEditNote: () => openEditDialog('note'),
    onEditAttributes: () => openEditDialog('attributes'),
    onToggleFlag: () => handleToggleFlag(),
    onRemoveFlag: () => handleRemoveFlag(),
    onEscape: closeDialogs,
  });

  // Callbacks for TransactionList rows
  const handleRowEditCategory = useCallback(
    (tx: Transaction) => openEditDialog('categoryPath', tx),
    [openEditDialog],
  );
  const handleRowEditNote = useCallback(
    (tx: Transaction) => openEditDialog('note', tx),
    [openEditDialog],
  );
  const handleRowEditAttributes = useCallback(
    (tx: Transaction) => openEditDialog('attributes', tx),
    [openEditDialog],
  );
  const handleRowToggleFlag = useCallback(
    (tx: Transaction) => handleToggleFlag(tx),
    [handleToggleFlag],
  );
  const handleRowRemoveFlag = useCallback(
    (tx: Transaction) => handleRemoveFlag(tx),
    [handleRemoveFlag],
  );

  return (
    <div className="flex flex-col h-dvh">
      <Header />
      {(success || applyEdits.isPending) && (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900"
        >
          <span className="flex-1">{applyEdits.isPending ? 'Saving review mark…' : success}</span>
          <button type="button" aria-label="Dismiss update message" onClick={() => setSuccess('')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {quickEditError && (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{quickEditError}</span>
          <button
            type="button"
            onClick={() => setQuickEditError(null)}
            className="rounded p-1 hover:bg-destructive/10"
            aria-label="Dismiss flag update error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading / error states */}
      {isLoading && (
        <div className="flex items-center justify-center flex-1 text-muted-foreground">
          Loading transactions...
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center flex-1 text-destructive">
          Failed to load transactions: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {/* Empty state: no transactions loaded at all */}
      {!isLoading && !error && transactions && transactions.topLevelTransactionCount === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center p-8">
          <Sparkles className="h-12 w-12 text-muted-foreground/50" />
          <EmptyTransactions />
        </div>
      )}

      {/* Main three-column layout */}
      {!isLoading && !error && (!transactions || transactions.topLevelTransactionCount > 0) && (
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar: year/month navigation */}
          <aside
            aria-label="Transaction periods"
            className="hidden md:block w-52 border-r border-border overflow-y-auto shrink-0"
          >
            <YearMonthNav />
          </aside>

          {/* Center: transaction list */}
          <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {/* Compact access to controls hidden by the desktop sidebars. */}
            <div className="grid shrink-0 grid-cols-2 border-b border-border bg-background md:grid-cols-1 lg:hidden">
              <button
                type="button"
                aria-expanded={compactPanel === 'period'}
                aria-controls="compact-period"
                onClick={() => setCompactPanel(compactPanel === 'period' ? null : 'period')}
                className="flex items-center justify-center gap-2 border-r border-border px-3 py-2 text-sm font-medium hover:bg-accent md:hidden"
              >
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                {selectedYear && selectedMonth
                  ? `${selectedYear}-${selectedMonth}`
                  : 'Choose period'}
              </button>
              <button
                type="button"
                aria-expanded={compactPanel === 'details'}
                aria-controls="compact-details"
                onClick={() => setCompactPanel(compactPanel === 'details' ? null : 'details')}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <PanelRight className="h-4 w-4 text-muted-foreground" />
                {selectedIds.size > 0 ? 'Selection details' : 'Summary'}
              </button>
              <div
                id="compact-period"
                hidden={compactPanel !== 'period'}
                className="col-span-full max-h-[35dvh] overflow-y-auto border-t border-border bg-background md:hidden"
              >
                <YearMonthNav />
              </div>
              <div
                id="compact-details"
                hidden={compactPanel !== 'details'}
                className="col-span-full max-h-[35dvh] overflow-y-auto border-t border-border bg-background"
              >
                <TransactionSummary />
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <TransactionList
                onEditCategory={handleRowEditCategory}
                onEditNote={handleRowEditNote}
                onEditAttributes={handleRowEditAttributes}
                onToggleFlag={handleRowToggleFlag}
                onRemoveFlag={handleRowRemoveFlag}
              />
            </div>
          </main>

          {/* Right sidebar: transaction summary / details */}
          {selectedIds.size > 0 && (
            <aside
              aria-label="Selection details"
              className="hidden lg:block w-80 xl:w-96 border-l border-border overflow-y-auto shrink-0"
            >
              <div className="flex items-center justify-between border-b p-3 text-sm font-semibold">
                Selection details
                <button
                  type="button"
                  aria-label="Close selection details"
                  onClick={() => useTransactionsStore.getState().clearSelection()}
                  className="rounded p-1 hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <TransactionSummary />
            </aside>
          )}
        </div>
      )}

      {/* Edit Dialogs */}
      {editingTransactions.length > 0 && activeDialog && (
        <TransactionEditWorkflow
          transactions={editingTransactions}
          open
          initialField={activeDialog === 'attributes' ? undefined : activeDialog}
          initialValues={editDefaults}
          onOpenChange={(open) => {
            if (!open) closeDialogs();
          }}
          onSaved={(result) =>
            setSuccess(
              `Saved correction. ${result.affectedTransactionsCount.toLocaleString()} records changed; original statements are preserved.`,
            )
          }
        />
      )}
    </div>
  );
};

AppShell.displayName = 'AppShell';
