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
import { useApplyEdits } from '../../api/hooks.js';
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

  const applyEdits = useApplyEdits();

  const handleScopeChange = useCallback((filters: ScopeFilter[]) => {
    setScopeFilters(filters);
  }, []);

  const hasChanges = changeType || changeName || changeAmount;

  const handleSubmit = () => {
    if (!hasChanges) return;

    const values: EditedValues = {};

    if (changeType) {
      values.transactionReason = editValue(parseInt(reason, 10));
    }
    if (changeName && entityName.trim()) {
      values.entityName = editValue(entityName.trim());
    }
    if (changeAmount) {
      const parsedAmount = parseFloat(amount);
      if (!isNaN(parsedAmount)) {
        values.amount = editValue(parsedAmount);
      }
    }

    const edit: TransactionEditData = {
      id: generateEditId(),
      auditInfo: {
        createDate: new Date().toISOString(),
        createdBy: 'web-ui',
      },
      scopeFilters,
      values,
      sourceId: 'web-ui',
    };

    setError(null);
    applyEdits.mutate([edit], {
      onSuccess: () => {
        onOpenChange(false);
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to save attributes');
      },
    });
  };

  return (
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
            disabled={!hasChanges || applyEdits.isPending}
          >
            {applyEdits.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

AttributeEditor.displayName = 'AttributeEditor';
