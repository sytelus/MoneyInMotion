import React, { useState } from 'react';
import type { Transaction, Transactions } from '@moneyinmotion/core';
import { Download } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Dialog, DialogContent, DialogFooter } from '../ui/dialog.js';
import { transactionsCsv } from '../../lib/transaction-explorer.js';
import { downloadText } from '../../lib/download.js';

interface Props {
  results: Transaction[];
  selected: Set<string>;
  collection: Transactions;
  basis: 'reporting' | 'records';
  period: string;
}

export function TransactionExport({ results, selected, collection, basis, period }: Props) {
  const [open, setOpen] = useState(false);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const [provenance, setProvenance] = useState(true);
  const selectedRows = results.filter((tx) => selected.has(tx.id));
  const rows = selectionOnly ? selectedRows : results;
  return (
    <>
      <Button variant="outline" size="sm" disabled={!results.length} onClick={() => setOpen(true)}>
        <Download className="mr-1 h-4 w-4" />
        Export results
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Export transactions"
          description="Download a CSV to your device. Original statement files are not changed."
          className="space-y-4"
        >
          <p className="text-sm font-medium">
            {period} · {basis === 'records' ? 'Source records' : 'Reporting items'}
          </p>
          <fieldset className="space-y-3 text-sm">
            <legend className="mb-2 font-semibold">Which records?</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="export-scope"
                checked={!selectionOnly}
                onChange={() => setSelectionOnly(false)}
              />
              All {results.length.toLocaleString()} filtered results, in the displayed sort order
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="export-scope"
                checked={selectionOnly}
                disabled={!selectedRows.length}
                onChange={() => setSelectionOnly(true)}
              />
              Only selected results ({selectedRows.length.toLocaleString()})
            </label>
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={provenance}
              onChange={(e) => setProvenance(e.target.checked)}
            />
            Include source path/row, original values, applied rule IDs, and related record IDs
          </label>
          {basis === 'records' && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Source records may include both a payment and its order details. Do not add these rows
              together as spending. Use Reporting items for non-duplicated totals.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The file contains private financial information. Text cells are protected against
            spreadsheet formulas. Amounts retain their recorded numeric values; currency is not
            recorded in the current model.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!rows.length}
              onClick={() => {
                downloadText(
                  transactionsCsv(rows, { collection, provenance, basis }),
                  `moneyinmotion-${basis}-${selectionOnly ? 'selected' : 'filtered'}.csv`,
                );
                setOpen(false);
              }}
            >
              Download {rows.length.toLocaleString()} rows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
