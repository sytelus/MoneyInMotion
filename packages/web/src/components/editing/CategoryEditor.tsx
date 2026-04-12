/**
 * Dialog for editing the category of one or more transactions.
 *
 * Provides a text input for the category path with autocomplete suggestions
 * from existing categories, plus a ScopeFilterEditor for choosing scope.
 *
 * @module
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  ScopeType,
  createScopeFilter,
  editValue,
  type ScopeFilter,
  type Transaction,
  type TransactionEditData,
} from '@moneyinmotion/core';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { ScopeFilterEditor } from './ScopeFilterEditor.js';
import { EditConfirmDialog } from './EditConfirmDialog.js';
import { useApplyEdits } from '../../api/hooks.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { generateEditId } from '../../lib/utils.js';

export interface CategoryEditorProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to close the dialog. */
  onOpenChange: (open: boolean) => void;
  /** The transaction to edit. */
  transaction: Transaction;
}

/**
 * Parse a user-entered category string like "Shopping > Electronics" into
 * the path array `["Shopping", "Electronics"]`.
 */
function parseCategoryPath(input: string): string[] {
  return input
    .split('>')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Dialog component for editing a transaction's category path.
 * Includes autocomplete from existing category paths and a scope filter
 * for determining which transactions the edit applies to.
 */
export const CategoryEditor: React.FC<CategoryEditorProps> = ({
  open,
  onOpenChange,
  transaction,
}) => {
  const currentPath = transaction.categoryPath;
  const [categoryInput, setCategoryInput] = useState(
    currentPath.length > 0 ? currentPath.join(' > ') : '',
  );
  const [scopeFilters, setScopeFilters] = useState<ScopeFilter[]>([
    createScopeFilter(ScopeType.TransactionId, [transaction.id]),
  ]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyEdits = useApplyEdits();
  const transactions = useTransactionsStore((s) => s.transactions);

  // Build list of all unique category paths for autocomplete
  const allCategoryPaths = useMemo(() => {
    if (!transactions) return [];
    const pathSet = new Set<string>();
    for (const tx of transactions.topLevelTransactions) {
      const cp = tx.categoryPath;
      if (cp.length > 0) {
        pathSet.add(cp.join(' > '));
      }
    }
    return [...pathSet].sort();
  }, [transactions]);

  // Filter suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    if (!categoryInput.trim()) return allCategoryPaths.slice(0, 20);
    const lower = categoryInput.toLowerCase();
    return allCategoryPaths
      .filter((p) => p.toLowerCase().includes(lower))
      .slice(0, 20);
  }, [categoryInput, allCategoryPaths]);

  // Transaction(s) affected by the current edit, displayed in the
  // bulk-edit confirmation dialog before the edit is applied.
  const [pendingEdit, setPendingEdit] = useState<TransactionEditData | null>(null);
  const [affectedTxns, setAffectedTxns] = useState<Transaction[]>([]);

  const handleScopeChange = useCallback((filters: ScopeFilter[]) => {
    setScopeFilters(filters);
  }, []);

  /** Apply the edit to the server and close the dialog on success. */
  const applyEdit = useCallback(
    (edit: TransactionEditData) => {
      applyEdits.mutate([edit], {
        onSuccess: () => {
          setPendingEdit(null);
          onOpenChange(false);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to save category');
        },
      });
    },
    [applyEdits, onOpenChange],
  );

  const handleSubmit = () => {
    // Inline validation
    const path = parseCategoryPath(categoryInput);
    if (path.length === 0) {
      setError('Category path cannot be empty. Use "Shopping > Electronics" format.');
      return;
    }
    if (scopeFilters.length === 0) {
      setError('At least one scope filter is required.');
      return;
    }

    const edit: TransactionEditData = {
      id: generateEditId(),
      auditInfo: {
        createDate: new Date().toISOString(),
        createdBy: 'web-ui',
      },
      scopeFilters,
      values: {
        categoryPath: editValue(path),
      },
      sourceId: 'web-ui',
    };

    setError(null);

    // For bulk edits (anything beyond a single-transaction scope), show
    // the confirmation dialog with affected-row preview first.
    const isSingleTx =
      scopeFilters.length === 1 &&
      scopeFilters[0]!.type === ScopeType.TransactionId &&
      scopeFilters[0]!.parameters.length === 1;

    if (!isSingleTx && transactions) {
      const affected = transactions.filterTransactions(edit);
      if (affected.length > 1) {
        setPendingEdit(edit);
        setAffectedTxns(affected);
        return;
      }
    }

    applyEdit(edit);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit Category" description={`Set category for "${transaction.displayEntityNameNormalized}"`}>
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {/* Category input with autocomplete */}
          <div className="space-y-1.5">
            <label htmlFor="category-input" className="text-sm font-medium">
              Category Path
            </label>
            <div className="relative">
              <Input
                id="category-input"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="e.g. Shopping > Electronics"
                autoFocus
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {filteredSuggestions.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setCategoryInput(suggestion);
                          setShowSuggestions(false);
                        }}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Use &quot;&gt;&quot; to separate path segments (e.g. Food &gt; Groceries)
            </p>
          </div>

          {/* Scope filter */}
          <ScopeFilterEditor transaction={transaction} onChange={handleScopeChange} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={applyEdits.isPending}
          >
            {applyEdits.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Bulk-edit preview shown before applying a scope that matches >1 row */}
    <EditConfirmDialog
      open={pendingEdit !== null}
      onOpenChange={(o) => { if (!o) setPendingEdit(null); }}
      affectedCount={affectedTxns.length}
      affectedNames={affectedTxns.map((t) => t.displayEntityNameNormalized)}
      onConfirm={() => pendingEdit && applyEdit(pendingEdit)}
      isPending={applyEdits.isPending}
    />
    </>
  );
};

CategoryEditor.displayName = 'CategoryEditor';
