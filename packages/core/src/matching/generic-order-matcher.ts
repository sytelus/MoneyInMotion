/**
 * Generic order-history parent-child matcher.
 *
 * Ported from C# `GenericOrderMatcher`. This is the base class for
 * Amazon and Etsy order matchers. It matches line-item children to
 * order parents by match filter, and non-line-item children to
 * credit-card parents by amount + date.
 *
 * @module
 */

import type { ParentChildMatch } from './parent-child-match.js';
import type { AccountInfo } from '../models/account-info.js';
import { Transaction } from '../models/transaction.js';
import type { Transactions } from '../models/transactions.js';
import { TransactionReason } from '../models/transaction-reason.js';
import { LineItemType } from '../models/line-item-type.js';
import { parseDate, daysBetween } from '../utils/date-utils.js';
import { isMissingAmountTolerable, addAdjustmentChild } from './generic-tx-matcher.js';

const IMPORT_INFO_ID = 'CreatedBy.GenericOrderMatcher';

/**
 * Build a key for non-line-item indexing: `"amount|date"`.
 *
 * Mirrors the C# `GetNonLineItemKey` method. Amount is formatted to
 * two decimal places, date is formatted as a short date string.
 */
function getNonLineItemKey(tx: Transaction): string {
  const amountStr = tx.amount.toFixed(2);
  const d = parseDate(tx.transactionDate);
  const dateStr = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  return `${amountStr}|${dateStr}`;
}

/**
 * Generic order-history matcher. Constructor accepts the provider-specific
 * attribute names for shipping, tax, and discount fields.
 */
export class GenericOrderMatcher implements ParentChildMatch {
  protected accountInfo: AccountInfo;
  protected shippingAttribute: string;
  protected taxAttribute: string;
  protected discountAttribute: string;

  constructor(
    accountInfo: AccountInfo,
    shippingAttribute: string,
    taxAttribute: string,
    discountAttribute: string,
  ) {
    this.accountInfo = accountInfo;
    this.shippingAttribute = shippingAttribute;
    this.taxAttribute = taxAttribute;
    this.discountAttribute = discountAttribute;
  }

  getParents(
    children: Transaction[],
    availableTransactions: Transactions,
  ): Array<{ child: Transaction; parent: Transaction }> {
    // Build index of line-item parents: same account, LineItemType.None, has matchFilter
    const lineitemParents = new Map<string, Transaction[]>();
    for (const tx of availableTransactions.allParentChildTransactions) {
      if (
        tx.accountId === this.accountInfo.id &&
        tx.lineItemType === LineItemType.None &&
        tx.parentChildMatchFilter != null
      ) {
        const key = tx.parentChildMatchFilter;
        const arr = lineitemParents.get(key) ?? [];
        arr.push(tx);
        lineitemParents.set(key, arr);
      }
    }

    // Build index of non-line-item parents: different account, not requiresParent,
    // entity name contains one of this account's interAccountNameTags
    const nameTags = this.accountInfo.interAccountNameTags ?? [];
    const nonLineitemParents = new Map<string, Transaction[]>();
    for (const tx of availableTransactions.allParentChildTransactions) {
      if (
        tx.accountId !== this.accountInfo.id &&
        !availableTransactions.getAccountInfo(tx.accountId).requiresParent &&
        nameTags.some((nt) => tx.entityName.toLowerCase().includes(nt.toLowerCase()))
      ) {
        const key = getNonLineItemKey(tx);
        const arr = nonLineitemParents.get(key) ?? [];
        arr.push(tx);
        nonLineitemParents.set(key, arr);
      }
    }

    const results: Array<{ child: Transaction; parent: Transaction }> = [];
    // Financial statement charges are one-to-one with order records. Reserve
    // a selected charge while building the result set because relationships
    // are not actually mutated until this method returns. Line-item parents
    // are deliberately not reserved: one order can contain many line items.
    const reservedNonLineitemParentIds = new Set<string>();

    for (const child of children) {
      if (child.lineItemType !== LineItemType.None) {
        // Line item: find parent by match filter
        const parents = lineitemParents.get(child.parentChildMatchFilter ?? '') ?? null;

        if (parents != null && parents.length === 1) {
          results.push({ child, parent: parents[0]! });
        } else if (parents != null && parents.length > 0) {
          throw new Error(
            `${parents.length} parents for Child ID ${child.id} were found in AccountID ${child.accountId}`,
          );
        }
      } else {
        // Non-line-item: find parent by amount+date key, or fuzzy match
        const exactKey = getNonLineItemKey(child);
        let parents = (nonLineitemParents.get(exactKey) ?? []).filter(
          (parent) =>
            !reservedNonLineitemParentIds.has(parent.id) &&
            (parent.children == null || Object.keys(parent.children).length === 0),
        );

        if (parents.length === 0) {
          // Fuzzy match: amount +/- 1, date +/- 2 days.
          // Rank lexicographically by amount difference and then date
          // difference. Multiplying the two deltas made every exact-amount
          // candidate score zero, regardless of how far apart its date was.
          const childDate = parseDate(child.transactionDate);
          const fuzzyMatches: Array<{
            tx: Transaction;
            amountDelta: number;
            daysDelta: number;
          }> = [];

          for (const txArray of nonLineitemParents.values()) {
            for (const tx of txArray) {
              if (reservedNonLineitemParentIds.has(tx.id)) continue;

              const amountDelta = Math.abs(tx.amount - child.amount);
              const daysDelta = daysBetween(parseDate(tx.transactionDate), childDate);
              const hasChildren = tx.children != null && Object.keys(tx.children).length > 0;

              if (amountDelta <= 1 && daysDelta <= 2 && !hasChildren) {
                fuzzyMatches.push({
                  tx,
                  amountDelta,
                  daysDelta,
                });
              }
            }
          }

          fuzzyMatches.sort(
            (a, b) =>
              a.amountDelta - b.amountDelta ||
              a.daysDelta - b.daysDelta ||
              a.tx.id.localeCompare(b.tx.id),
          );
          parents = fuzzyMatches.map((m) => m.tx);
        }

        if (parents.length > 0) {
          const parent = parents[0]!;
          reservedNonLineitemParentIds.add(parent.id);
          results.push({ child, parent });
        }
      }
    }

    return results;
  }

  handleIncompleteParent(
    parent: Transaction,
    availableTransactions: Transactions,
    missingChildAmount: number,
  ): boolean {
    if (missingChildAmount === 0) {
      return true;
    }

    const attrs = parent.providerAttributes ?? {};
    const numericAttribute = (attribute: string): number => {
      const raw = attrs[attribute];
      if (raw == null || raw.trim() === '') return 0;
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw new Error(`Order attribute "${attribute}" is not a valid amount: "${raw}"`);
      }
      return value;
    };
    const promotionsAmount = numericAttribute(this.discountAttribute);
    const shippingAmount = numericAttribute(this.shippingAttribute);
    const taxAmount = numericAttribute(this.taxAttribute);

    const updatedMissingChildAmount =
      missingChildAmount - (promotionsAmount + shippingAmount + taxAmount);

    if (isMissingAmountTolerable(parent, updatedMissingChildAmount)) {
      addAdjustmentChild(
        parent,
        availableTransactions,
        promotionsAmount,
        TransactionReason.DiscountRecieved,
        'Discount',
        IMPORT_INFO_ID,
      );
      addAdjustmentChild(
        parent,
        availableTransactions,
        shippingAmount,
        TransactionReason.Purchase,
        'Shipping',
        IMPORT_INFO_ID,
      );
      addAdjustmentChild(
        parent,
        availableTransactions,
        taxAmount,
        TransactionReason.Purchase,
        'Tax',
        IMPORT_INFO_ID,
      );

      const finalMissingAmount = -1 * updatedMissingChildAmount;
      addAdjustmentChild(
        parent,
        availableTransactions,
        finalMissingAmount,
        finalMissingAmount >= 0
          ? TransactionReason.MatchAdjustmentCredit
          : TransactionReason.MatchAdjustmentDebit,
        'Adjustment',
        IMPORT_INFO_ID,
      );

      return true;
    }

    return false;
  }
}
