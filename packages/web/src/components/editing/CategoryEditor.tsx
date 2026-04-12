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

  const handleScopeChange = useCallback((filters: ScopeFilter[]) => {
    setScopeFilters(filters);
  }, []);

  const handleSubmit = () => {
    const path = parseCategoryPath(categoryInput);
    if (path.length === 0) return;

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
    applyEdits.mutate([edit], {
      onSuccess: () => {
        onOpenChange(false);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to save category');
      },
    });
  };

  return (
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
            disabled={parseCategoryPath(categoryInput).length === 0 || applyEdits.isPending}
          >
            {applyEdits.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

CategoryEditor.displayName = 'CategoryEditor';
