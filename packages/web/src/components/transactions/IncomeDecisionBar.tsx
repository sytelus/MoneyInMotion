/**
 * Lets the user settle credits MiM can't classify. Each choice opens the normal
 * preview-and-save edit flow with the type preset, so the decision is an
 * ordinary saved correction that can be broadened into a rule or removed.
 */
import { HelpCircle } from 'lucide-react';
import type { Transaction } from '@moneyinmotion/core';
import { Button } from '../ui/button.js';
import { INCOME_DECISION_REASON, SPENDING_DECISION_REASON } from '../../lib/cash-flow.js';

export function IncomeDecisionBar({
  undecided,
  showHint,
  onDecide,
}: {
  /** Selected transactions that still need a decision. */
  undecided: Transaction[];
  /** Show guidance even when nothing is selected (the undecided filter is active). */
  showHint: boolean;
  onDecide: (targets: Transaction[], reason: number) => void;
}) {
  if (!undecided.length && !showHint) return null;
  return (
    <div
      role="region"
      aria-label="Income decision"
      className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      <HelpCircle aria-hidden className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {undecided.length
          ? `${undecided.length.toLocaleString()} selected ${undecided.length === 1 ? 'credit needs' : 'credits need'} a decision. Income raises savings; a refund or discount reduces spending.`
          : 'These credits are left out of income and spending. Select one or more to decide.'}
      </span>
      {undecided.length > 0 && (
        <span className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onDecide(undecided, INCOME_DECISION_REASON)}>
            Count as income
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDecide(undecided, SPENDING_DECISION_REASON)}
          >
            Count against spending
          </Button>
        </span>
      )}
    </div>
  );
}
