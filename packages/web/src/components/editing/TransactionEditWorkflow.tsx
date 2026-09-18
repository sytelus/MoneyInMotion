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

function defaultValues(transactions: Transaction[], field?: keyof EditedValues): EditedValues {
  if (!field) return {};
  const first = transactions[0];
  const defaults: Record<keyof EditedValues, string | number | boolean | string[]> = {
    categoryPath: first?.categoryPath ?? [''],
    note: first?.note ?? '',
    isFlagged: true,
    entityName: first?.displayEntityNameNormalized ?? '',
    amount: first?.correctedAmount ?? 0,
    transactionDate: first?.correctedTransactionDate ?? '',
    transactionReason: first?.correctedTransactionReason ?? 0,
  };
  return { [field]: editValue(defaults[field]) };
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
