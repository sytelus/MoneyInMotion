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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
} from '@moneyinmotion/core';
import { Header } from './Header.js';
import { YearMonthNav } from '../navigation/YearMonthNav.js';
import { TransactionList } from '../transactions/TransactionList.js';
import { TransactionSummary } from '../transactions/TransactionSummary.js';
import { CategoryEditor } from '../editing/CategoryEditor.js';
import { NoteEditor } from '../editing/NoteEditor.js';
import { AttributeEditor } from '../editing/AttributeEditor.js';
import { AlertCircle, CalendarRange, PanelRight, Sparkles, X } from 'lucide-react';
import { buttonClassName } from '../ui/button.js';
import { useTransactions, useApplyEdits, useAccounts } from '../../api/hooks.js';
import { ExistingStatements } from '../importing/ExistingStatements.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';

type EditDialog = 'category' | 'note' | 'attributes' | null;

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
  const setTransactions = useTransactionsStore((s) => s.setTransactions);
  const transactions = useTransactionsStore((s) => s.transactions);
  const selectedIds = useTransactionsStore((s) => s.selectedTransactionIds);
  const selectedYear = useTransactionsStore((s) => s.selectedYear);
  const selectedMonth = useTransactionsStore((s) => s.selectedMonth);

  const applyEdits = useApplyEdits();

  const [activeDialog, setActiveDialog] = useState<EditDialog>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [quickEditError, setQuickEditError] = useState<string | null>(null);
  const [compactPanel, setCompactPanel] = useState<'period' | 'details' | null>(null);

  // Push server data into the Zustand store when it arrives
  useEffect(() => {
    if (data) {
      setTransactions(data);
    }
  }, [data, setTransactions]);

  // Get the currently selected transaction (first in selection)
  const selectedTransaction = useMemo(() => {
    if (!transactions || selectedIds.size === 0) return null;
    const firstId = [...selectedIds][0];
    return firstId ? (transactions.getTransaction(firstId) ?? null) : null;
  }, [transactions, selectedIds]);

  // Edit dialog openers
  const openEditDialog = useCallback(
    (dialog: EditDialog, tx?: Transaction) => {
      const target = tx ?? selectedTransaction;
      if (!target) return;
      setEditingTransaction(target);
      setActiveDialog(dialog);
    },
    [selectedTransaction],
  );

  const closeDialogs = useCallback(() => {
    setActiveDialog(null);
    setEditingTransaction(null);
  }, []);

  // Flag toggle handler
  const handleToggleFlag = useCallback(
    (tx?: Transaction) => {
      const target = tx ?? selectedTransaction;
      if (!target) return;

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
        onError: (error) => {
          setQuickEditError(error instanceof Error ? error.message : 'Failed to update the flag.');
        },
      });
    },
    [selectedTransaction, applyEdits],
  );

  // Flag remove handler
  const handleRemoveFlag = useCallback(
    (tx?: Transaction) => {
      const target = tx ?? selectedTransaction;
      if (!target) return;

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
        onError: (error) => {
          setQuickEditError(error instanceof Error ? error.message : 'Failed to remove the flag.');
        },
      });
    },
    [selectedTransaction, applyEdits],
  );

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    onEditCategory: () => openEditDialog('category'),
    onEditNote: () => openEditDialog('note'),
    onEditAttributes: () => openEditDialog('attributes'),
    onToggleFlag: () => handleToggleFlag(),
    onRemoveFlag: () => handleRemoveFlag(),
    onEscape: closeDialogs,
  });

  // Callbacks for TransactionList rows
  const handleRowEditCategory = useCallback(
    (tx: Transaction) => openEditDialog('category', tx),
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
    <div className="flex flex-col h-screen">
      <Header />

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
          <aside className="hidden md:block w-64 border-r border-border overflow-y-auto shrink-0">
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
            <aside className="hidden lg:block w-80 border-l border-border overflow-y-auto shrink-0">
              <TransactionSummary />
            </aside>
          )}
        </div>
      )}

      {/* Edit Dialogs */}
      {editingTransaction && activeDialog === 'category' && (
        <CategoryEditor
          open={true}
          onOpenChange={(open) => {
            if (!open) closeDialogs();
          }}
          transaction={editingTransaction}
        />
      )}

      {editingTransaction && activeDialog === 'note' && (
        <NoteEditor
          open={true}
          onOpenChange={(open) => {
            if (!open) closeDialogs();
          }}
          transaction={editingTransaction}
        />
      )}

      {editingTransaction && activeDialog === 'attributes' && (
        <AttributeEditor
          open={true}
          onOpenChange={(open) => {
            if (!open) closeDialogs();
          }}
          transaction={editingTransaction}
        />
      )}
    </div>
  );
};

AppShell.displayName = 'AppShell';
