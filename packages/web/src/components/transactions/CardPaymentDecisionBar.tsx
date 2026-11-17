/**
 * Lets the user settle bank payments to a card that may be counted twice.
 * Like the income decision, each choice opens the normal preview-and-save
 * edit flow with the type preset, so it is an ordinary saved correction.
 */
import { CreditCard } from 'lucide-react';
import type { Transaction } from '@moneyinmotion/core';
import { Button } from '../ui/button.js';
import {
  CARD_PAYMENT_DECISION_REASON,
  KEEP_SPENDING_DECISION_REASON,
} from '../../lib/cash-flow.js';
import { countLabel } from '../../lib/utils.js';

export function CardPaymentDecisionBar({
  payments,
  showHint,
  onDecide,
}: {
  /** Selected card payments that may be counted twice. */
  payments: Transaction[];
  /** Show guidance even when nothing is selected (the review filter is active). */
  showHint: boolean;
  onDecide: (targets: Transaction[], reason: number) => void;
}) {
  if (!payments.length && !showHint) return null;
  return (
    <div
      role="region"
      aria-label="Card payment decision"
      className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      <CreditCard aria-hidden className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {payments.length
          ? `${countLabel(payments.length, 'selected card payment')} may be counted twice: the card's own purchases for that time are imported. A card payment is left out of spending; keep it as spending only if those purchases are missing.`
          : 'These bank payments go to a card whose purchases are also imported, but the card shows no matching payment. Select one or more to decide.'}
      </span>
      {payments.length > 0 && (
        <span className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onDecide(payments, CARD_PAYMENT_DECISION_REASON)}>
            Count as card payment
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDecide(payments, KEEP_SPENDING_DECISION_REASON)}
          >
            Keep as spending
          </Button>
        </span>
      )}
    </div>
  );
}
