/**
 * Dialog for fixing transaction attributes (type, entity name, amount).
 *
 * Allows the user to selectively override one or more fields and choose
 * the scope of the edit via ScopeFilterEditor.
 *
 * @module
 */

import React, { useState, useCallback } from 'react';
import {
  createAuditInfo,
  ScopeType,
  createScopeFilter,
  editValue,
  transactionReasonInfo,
  type ScopeFilter,
  type Transaction,
  type TransactionEditData,
  type EditedValues,
} from '@moneyinmotion/core';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Select, type SelectOption } from '../ui/select.js';
import { ScopeFilterEditor } from './ScopeFilterEditor.js';
import { EditConfirmDialog } from './EditConfirmDialog.js';
import { useApplyEdits } from '../../api/hooks.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { generateEditId } from '../../lib/utils.js';

export interface AttributeEditorProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback to close the dialog. */
  onOpenChange: (open: boolean) => void;
  /** The transaction to edit. */
  transaction: Transaction;
}

/** Build dropdown options from TransactionReason info. */
const reasonOptions: SelectOption[] = transactionReasonInfo.map((info) => ({
  value: String(info.value),
  label: info.title,
}));

/**
 * Dialog for editing transaction attributes: transaction type (reason),
 * entity name, and amount. Each field can be individually enabled or
 * disabled via checkboxes.
 */
export const AttributeEditor: React.FC<AttributeEditorProps> = ({
  open,
  onOpenChange,
  transaction,
}) => {
  const [changeType, setChangeType] = useState(false);
  const [changeName, setChangeName] = useState(false);
  const [changeAmount, setChangeAmount] = useState(false);

  const [reason, setReason] = useState(String(transaction.transactionReason));
  const [entityName, setEntityName] = useState(transaction.displayEntityNameNormalized);
  const [amount, setAmount] = useState(String(transaction.amount));

  const [scopeFilters, setScopeFilters] = useState<ScopeFilter[]>([
    createScopeFilter(ScopeType.TransactionId, [transaction.id]),
  ]);
  const [error, setError] = useState<string | null>(null);

  // Transaction(s) affected by the current edit, displayed in the
  // bulk-edit confirmation dialog before the edit is applied.
  const [pendingEdit, setPendingEdit] = useState<TransactionEditData | null>(null);
  const [affectedTxns, setAffectedTxns] = useState<Transaction[]>([]);

  const applyEdits = useApplyEdits();
  const transactions = useTransactionsStore((s) => s.transactions);

  const handleScopeChange = useCallback((filters: ScopeFilter[]) => {
    setScopeFilters(filters);
  }, []);

  const hasChanges = changeType || changeName || changeAmount;

  /** Apply the edit to the server and close the dialog on success. */
  const applyEdit = useCallback(
    (edit: TransactionEditData) => {
      applyEdits.mutate([edit], {
        onSuccess: () => {
          setPendingEdit(null);
          onOpenChange(false);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to save attributes');
        },
      });
    },
    [applyEdits, onOpenChange],
  );

  const handleSubmit = () => {
    // Validation
    if (!hasChanges) {
      setError('Enable at least one attribute to change.');
      return;
    }
    if (scopeFilters.length === 0) {
      setError('At least one scope filter is required.');
      return;
    }

    const values: EditedValues = {};

    if (changeType) {
      const reasonNum = parseInt(reason, 10);
      if (Number.isNaN(reasonNum)) {
        setError('Pick a valid transaction type.');
        return;
      }
      values.transactionReason = editValue(reasonNum);
    }
    if (changeName) {
      if (!entityName.trim()) {
        setError('Entity name cannot be blank.');
        return;
      }
      values.entityName = editValue(entityName.trim());
    }
    if (changeAmount) {
      const parsedAmount = parseFloat(amount);
      if (Number.isNaN(parsedAmount)) {
        setError('Amount must be a number.');
        return;
      }
      values.amount = editValue(parsedAmount);
    }

    const edit: TransactionEditData = {
      id: generateEditId(),
      auditInfo: createAuditInfo('web-ui'),
      scopeFilters,
      values,
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
      <DialogContent title="Fix Attributes" description={`Edit attributes for "${transaction.displayEntityNameNormalized}"`}>
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {/* Transaction Type */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={changeType}
                onChange={(e) => setChangeType(e.target.checked)}
                className="accent-primary"
              />
              <span className="font-medium">Change Transaction Type</span>
            </label>
            {changeType && (
              <div className="ml-6">
                <Select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  options={reasonOptions}
                />
              </div>
            )}
          </div>

          {/* Entity Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={changeName}
                onChange={(e) => setChangeName(e.target.checked)}
                className="accent-primary"
              />
              <span className="font-medium">Change Entity Name</span>
            </label>
            {changeName && (
              <div className="ml-6">
                <Input
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="Entity name"
                />
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={changeAmount}
                onChange={(e) => setChangeAmount(e.target.checked)}
                className="accent-primary"
              />
              <span className="font-medium">Change Amount</span>
            </label>
            {changeAmount && (
              <div className="ml-6">
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                />
              </div>
            )}
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

AttributeEditor.displayName = 'AttributeEditor';
