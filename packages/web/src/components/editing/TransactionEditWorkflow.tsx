/** One preview-and-save workflow for single, checkbox-selected, and filtered-batch edits. */
import React, { useState } from 'react';
import {
  ScopeType,
  createScopeFilter,
  editValue,
  type EditedValues,
  type Transaction,
} from '@moneyinmotion/core';
import type { RuleChange, RuleChangeResult } from '../../api/client.js';
import { useTransactionsStore } from '../../store/transactions-store.js';
import { RuleEditor } from './RuleEditor.js';
import { RuleChangePreview } from './RuleChangePreview.js';

/**
 * Start the chosen field from the selection's current value. When the
 * selected records disagree, start empty rather than proposing one record's
 * value for all of them.
 */
function defaultValues(transactions: Transaction[], field?: keyof EditedValues): EditedValues {
  if (!field) return {};
  const current = (tx: Transaction): string | number | boolean | string[] => {
    switch (field) {
      case 'categoryPath':
        return tx.categoryPath;
      case 'note':
        return tx.note ?? '';
      case 'isFlagged':
        return true;
      case 'entityName':
        return tx.displayEntityNameNormalized;
      case 'amount':
        return tx.correctedAmount;
      case 'transactionDate':
        return tx.correctedTransactionDate;
      case 'transactionReason':
        return tx.correctedTransactionReason;
    }
  };
  const values = transactions.map(current);
  const same = values.every((value) => JSON.stringify(value) === JSON.stringify(values[0]));
  const empty =
    field === 'categoryPath'
      ? ['']
      : field === 'amount'
        ? 0
        : field === 'transactionReason'
          ? values[0]!
          : '';
  return { [field]: editValue(same ? values[0]! : empty) };
}

export function TransactionEditWorkflow({
  transactions,
  open,
  onOpenChange,
  onSaved,
  initialField,
  initialValues,
}: {
  transactions: Transaction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (result: RuleChangeResult) => void;
  initialField?: keyof EditedValues;
  initialValues?: EditedValues;
}) {
  const collection = useTransactionsStore((state) => state.transactions);
  const [changes, setChanges] = useState<RuleChange[] | null>(null);
  if (!collection || !transactions.length || !open) return null;
  const close = () => onOpenChange(false);
  return (
    <>
      <RuleEditor
        rules={[]}
        transactions={collection}
        open={!changes}
        title={`Edit ${transactions.length === 1 ? 'transaction' : `${transactions.length.toLocaleString()} selected transactions`}`}
        description="Starts with only the records you selected. Changing the conditions can create an automation for existing and future imports. Preview before saving; original statements stay unchanged."
        initialScopes={[
          createScopeFilter(
            ScopeType.TransactionId,
            transactions.map((tx) => tx.id),
          ),
        ]}
        initialValues={initialValues ?? defaultValues(transactions, initialField)}
        onClose={close}
        onReview={setChanges}
      />
      {changes && (
        <RuleChangePreview
          transactions={collection}
          changes={changes}
          onClose={close}
          onBack={() => setChanges(null)}
          onSaved={(result) => {
            close();
            onSaved?.(result);
          }}
        />
      )}
    </>
  );
}
