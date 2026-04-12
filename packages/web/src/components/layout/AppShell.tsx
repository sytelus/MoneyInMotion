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
import { Sparkles } from 'lucide-react';
import { Button } from '../ui/button.js';
import { useTransactions, useApplyEdits } from '../../api/hooks.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';
import { generateEditId } from '../../lib/utils.js';

type EditDialog = 'category' | 'note' | 'attributes' | null;

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
    return firstId ? transactions.getTransaction(firstId) ?? null : null;
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
        id: generateEditId(),
        auditInfo: {
          createDate: new Date().toISOString(),
          createdBy: 'web-ui',
        },
        scopeFilters: [createScopeFilter(ScopeType.TransactionId, [target.id])],
        values: {
          isFlagged: editValue(!target.isUserFlagged),
        },
        sourceId: 'web-ui',
      };

      applyEdits.mutate([edit]);
    },
    [selectedTransaction, applyEdits],
  );

  // Flag remove handler
  const handleRemoveFlag = useCallback(
    (tx?: Transaction) => {
      const target = tx ?? selectedTransaction;
      if (!target) return;

      const edit: TransactionEditData = {
        id: generateEditId(),
        auditInfo: {
          createDate: new Date().toISOString(),
          createdBy: 'web-ui',
        },
        scopeFilters: [createScopeFilter(ScopeType.TransactionId, [target.id])],
        values: {
          isFlagged: voidedEditValue<boolean>(),
        },
        sourceId: 'web-ui',
      };

      applyEdits.mutate([edit]);
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
          <div>
            <h2 className="text-xl font-semibold mb-2">Welcome to MoneyInMotion!</h2>
            <p className="text-muted-foreground max-w-md">
              Set up your accounts and import statement files to get started.
            </p>
          </div>
          <Link to="/welcome">
            <Button size="lg">
              Get Started
            </Button>
          </Link>
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
            {/* Inline banner for users who have transactions but haven't selected a period */}
            {transactions && transactions.topLevelTransactionCount > 0 && !selectedYear && !selectedMonth && (
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border text-sm">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">
                  New here? Check the{' '}
                  <Link to="/welcome" className="text-primary underline underline-offset-4 hover:text-primary/80">
                    Getting Started guide
                  </Link>
                </span>
              </div>
            )}
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
          <aside className="hidden lg:block w-72 border-l border-border overflow-y-auto shrink-0">
            <TransactionSummary />
          </aside>
        </div>
      )}

      {/* Edit Dialogs */}
      {editingTransaction && activeDialog === 'category' && (
        <CategoryEditor
          open={true}
          onOpenChange={(open) => { if (!open) closeDialogs(); }}
          transaction={editingTransaction}
        />
      )}

      {editingTransaction && activeDialog === 'note' && (
        <NoteEditor
          open={true}
          onOpenChange={(open) => { if (!open) closeDialogs(); }}
          transaction={editingTransaction}
        />
      )}

      {editingTransaction && activeDialog === 'attributes' && (
        <AttributeEditor
          open={true}
          onOpenChange={(open) => { if (!open) closeDialogs(); }}
          transaction={editingTransaction}
        />
      )}
    </div>
  );
};

AppShell.displayName = 'AppShell';
