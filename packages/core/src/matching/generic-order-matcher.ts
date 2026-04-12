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
import { parseDate } from '../utils/date-utils.js';
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
                let parents = nonLineitemParents.get(exactKey) ?? null;

                if (parents == null || parents.length === 0) {
                    // Fuzzy match: amount +/- 1, date +/- 2 days
                    const childDate = parseDate(child.transactionDate);
                    const fuzzyMatches: Transaction[] = [];

                    for (const txArray of nonLineitemParents.values()) {
                        for (const tx of txArray) {
                            const amountDelta = Math.abs(tx.amount - child.amount);
                            const txDate = parseDate(tx.transactionDate);
                            const daysDelta = Math.abs(
                                (txDate.getTime() - childDate.getTime()) / 86_400_000,
                            );
                            const hasChildren = tx.children != null && Object.keys(tx.children).length > 0;

                            if (amountDelta <= 1 && daysDelta <= 2 && !hasChildren) {
                                fuzzyMatches.push(tx);
                            }
                        }
                    }

                    // Sort by delta score: amount_delta * (days_delta + 1)
                    fuzzyMatches.sort((a, b) => {
                        const aAmountDelta = Math.abs(a.amount - child.amount);
                        const aDate = parseDate(a.transactionDate);
                        const aDaysDelta = Math.abs(
                            (aDate.getTime() - childDate.getTime()) / 86_400_000,
                        );
                        const aScore = aAmountDelta * (aDaysDelta + 1);

                        const bAmountDelta = Math.abs(b.amount - child.amount);
                        const bDate = parseDate(b.transactionDate);
                        const bDaysDelta = Math.abs(
                            (bDate.getTime() - childDate.getTime()) / 86_400_000,
                        );
                        const bScore = bAmountDelta * (bDaysDelta + 1);

                        return aScore - bScore;
                    });

                    parents = fuzzyMatches;
                }

                if (parents.length > 0) {
                    results.push({ child, parent: parents[0]! });
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
        const promotionsAmount = parseFloat(attrs[this.discountAttribute] ?? '0') || 0;
        const shippingAmount = parseFloat(attrs[this.shippingAttribute] ?? '0') || 0;
        const taxAmount = parseFloat(attrs[this.taxAttribute] ?? '0') || 0;

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
