/**
 * Scope filter editor for choosing which transactions an edit applies to.
 *
 * Ported from the legacy txEditRule.html + ScopeFiltersViewModel. Allows the
 * user to pick a primary scope (single transaction, all with same name, or
 * matching all tokens) and optional secondary filters (account, type, amount).
 *
 * @module
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ScopeType,
  createScopeFilter,
  type ScopeFilter,
  type Transaction,
} from '@moneyinmotion/core';

export interface ScopeFilterEditorProps {
  /** The transaction being edited, used to derive default filter values. */
  transaction: Transaction;
  /** Callback invoked whenever the scope filter selection changes. */
  onChange: (filters: ScopeFilter[]) => void;
}

type PrimaryScopeChoice = 'transactionId' | 'entityNameNormalized' | 'entityNameAllTokens';

/**
 * UI for selecting the scope of a transaction edit. Provides radio buttons
 * for the primary scope and optional checkboxes for narrowing filters.
 */
export const ScopeFilterEditor: React.FC<ScopeFilterEditorProps> = ({ transaction, onChange }) => {
  const [primaryScope, setPrimaryScope] = useState<PrimaryScopeChoice>('transactionId');
  const [includeAccount, setIncludeAccount] = useState(false);
  const [includeReason, setIncludeReason] = useState(false);
  const [includeAmountRange, setIncludeAmountRange] = useState(false);
  const [words, setWords] = useState(transaction.entityNameNormalized || transaction.entityName);
  const [minimum, setMinimum] = useState((Math.abs(transaction.amount) * 0.9).toFixed(2));
  const [maximum, setMaximum] = useState((Math.abs(transaction.amount) * 1.1).toFixed(2));
  const invalidWords = primaryScope === 'entityNameAllTokens' && !words.trim();
  const invalidRange =
    includeAmountRange &&
    (!minimum.trim() ||
      !maximum.trim() ||
      !Number.isFinite(Number(minimum)) ||
      !Number.isFinite(Number(maximum)) ||
      Number(minimum) < 0 ||
      Number(maximum) < Number(minimum));

  const buildFilters = useCallback((): ScopeFilter[] => {
    if (invalidWords || (primaryScope !== 'transactionId' && invalidRange)) return [];
    const filters: ScopeFilter[] = [];

    // Primary scope filter
    switch (primaryScope) {
      case 'transactionId':
        filters.push(createScopeFilter(ScopeType.TransactionId, [transaction.id]));
        break;
      case 'entityNameNormalized':
        filters.push(
          createScopeFilter(ScopeType.EntityNameNormalized, [
            transaction.entityNameNormalized || transaction.entityName,
          ]),
        );
        break;
      case 'entityNameAllTokens': {
        const tokens = words.split(/\s+/).filter((t) => t.length > 0);
        if (tokens.length > 0) {
          filters.push(createScopeFilter(ScopeType.EntityNameAllTokens, tokens));
        }
        break;
      }
    }

    // Optional narrowing filters
    if (primaryScope !== 'transactionId' && includeAccount) {
      filters.push(createScopeFilter(ScopeType.AccountId, [transaction.accountId]));
    }
    if (primaryScope !== 'transactionId' && includeReason) {
      filters.push(
        createScopeFilter(ScopeType.TransactionReason, [String(transaction.transactionReason)]),
      );
    }
    if (primaryScope !== 'transactionId' && includeAmountRange) {
      const min = minimum;
      const max = maximum;
      const amountRangeParameters = transaction.amount < 0 ? [min, max, 'true'] : [min, max];
      filters.push(createScopeFilter(ScopeType.AmountRange, amountRangeParameters));
    }

    return filters;
  }, [
    primaryScope,
    includeAccount,
    includeReason,
    includeAmountRange,
    transaction,
    words,
    minimum,
    maximum,
    invalidWords,
    invalidRange,
  ]);

  // Notify parent whenever the selection changes
  useEffect(() => {
    onChange(buildFilters());
  }, [buildFilters, onChange]);

  const entityName = transaction.entityNameNormalized || transaction.entityName;
  const tokens = entityName.split(/\s+/).filter((t) => t.length > 0);

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground mb-2">Apply to</legend>

      {/* Primary scope radio group */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="primaryScope"
            value="transactionId"
            checked={primaryScope === 'transactionId'}
            onChange={() => setPrimaryScope('transactionId')}
            className="accent-primary"
          />
          This transaction only
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="primaryScope"
            value="entityNameNormalized"
            checked={primaryScope === 'entityNameNormalized'}
            onChange={() => setPrimaryScope('entityNameNormalized')}
            className="accent-primary"
          />
          <span>
            All transactions named{' '}
            <span className="font-medium text-foreground">&quot;{entityName}&quot;</span>
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="primaryScope"
            value="entityNameAllTokens"
            checked={primaryScope === 'entityNameAllTokens'}
            onChange={() => setPrimaryScope('entityNameAllTokens')}
            className="accent-primary"
          />
          <span>
            Transactions matching all words:{' '}
            <span className="font-medium text-foreground">{tokens.join(', ')}</span>
          </span>
        </label>
      </div>

      {primaryScope === 'entityNameAllTokens' && (
        <label className="block text-sm">
          Required words
          <input
            className="mt-1 block w-full rounded-md border border-input p-2"
            value={words}
            onChange={(e) => setWords(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            Separate words with spaces. Every word must occur in the name.
          </span>
        </label>
      )}
      {invalidWords && (
        <p role="alert" className="text-sm text-destructive">
          Enter at least one word before saving.
        </p>
      )}

      {/* Optional narrowing filters (only shown when not single-transaction) */}
      {primaryScope !== 'transactionId' && (
        <div className="ml-6 space-y-2 border-l-2 border-border pl-4">
          <p className="text-xs text-muted-foreground mb-1">Narrow further:</p>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeAccount}
              onChange={(e) => setIncludeAccount(e.target.checked)}
              className="accent-primary"
            />
            Only for account <span className="font-medium">{transaction.accountId}</span>
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeReason}
              onChange={(e) => setIncludeReason(e.target.checked)}
              className="accent-primary"
            />
            Only for this transaction type
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeAmountRange}
              onChange={(e) => setIncludeAmountRange(e.target.checked)}
              className="accent-primary"
            />
            Only for amount range (starts at &plusmn;10%)
          </label>
          {includeAmountRange && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                Minimum magnitude
                <input
                  className="mt-1 w-full rounded-md border border-input p-2"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minimum}
                  onChange={(e) => setMinimum(e.target.value)}
                />
              </label>
              <label className="text-xs">
                Maximum magnitude
                <input
                  className="mt-1 w-full rounded-md border border-input p-2"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maximum}
                  onChange={(e) => setMaximum(e.target.value)}
                />
              </label>
              <p className="col-span-2 text-xs text-muted-foreground">
                Matches {transaction.amount < 0 ? 'outgoing (negative)' : 'incoming (positive)'}{' '}
                amounts using positive magnitudes.
              </p>
            </div>
          )}
          {invalidRange && (
            <p role="alert" className="text-sm text-destructive">
              Enter a valid minimum and maximum, with 0 ≤ minimum ≤ maximum.
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
};

ScopeFilterEditor.displayName = 'ScopeFilterEditor';
