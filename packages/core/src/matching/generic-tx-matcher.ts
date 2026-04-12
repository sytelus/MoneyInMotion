/**
 * Generic parent-child matcher for transactions.
 *
 * Ported from C# `GenericTxParentChildMatcher`. This matcher does not support
 * finding parents (only order-history matchers do); it only handles incomplete
 * parents by creating small adjustment children when the missing amount is
 * within tolerance.
 *
 * @module
 */

import type { ParentChildMatch } from './parent-child-match.js';
import { Transaction, type ImportedValues } from '../models/transaction.js';
import type { Transactions } from '../models/transactions.js';
import { TransactionReason } from '../models/transaction-reason.js';
import type { ImportInfo } from '../models/import-info.js';

const IMPORT_INFO_ID = 'CreatedBy.GenericTxParentChildMatcher';

/**
 * Determine whether the missing child amount is small enough to be covered
 * by an automatic adjustment.
 *
 * The missing amount is tolerable when it is less than 2% of the parent
 * amount (rounded to 2 decimal places) **or** less than $0.50.
 */
export function isMissingAmountTolerable(parent: Transaction, missingChildAmount: number): boolean {
    return (
        Math.abs(missingChildAmount) < Math.round(Math.abs(parent.amount) * 0.02 * 100) / 100 ||
        Math.abs(missingChildAmount) < 0.50
    );
}

/**
 * Create and register a synthetic adjustment child transaction.
 *
 * @param parent                - The parent transaction.
 * @param availableTransactions - The collection to add the adjustment to.
 * @param amount                - The adjustment amount.
 * @param transactionReason     - The reason code for the adjustment.
 * @param tag                   - A label prefix for the entity name (e.g. "Adjustment").
 * @param importInfoId          - The import info ID to use for the synthetic transaction.
 */
export function addAdjustmentChild(
    parent: Transaction,
    availableTransactions: Transactions,
    amount: number,
    transactionReason: number,
    tag: string,
    importInfoId: string,
): void {
    let matcherImportInfo: ImportInfo;

    if (availableTransactions.hasImportInfo(importInfoId)) {
        matcherImportInfo = availableTransactions.getImportInfo(importInfoId);
    } else {
        matcherImportInfo = {
            id: importInfoId,
            portableAddress: importInfoId,
            contentHash: importInfoId,
            format: null,
            updateDate: null,
            createDate: null,
        };
    }

    const accountInfo = availableTransactions.getAccountInfo(parent.accountId);

    if (amount !== 0) {
        const importedValues: ImportedValues = {
            amount,
            entityName: `${tag} - ${parent.entityName}`,
            entityNameNormalized: `${tag} - ${parent.entityName}`,
            instituteReference: `${tag}.${parent.instituteReference ?? ''}`,
            requiresParent: true,
            subAccountName: parent.subAccountName ?? undefined,
            transactionDate: parent.transactionDate,
            transactionReason,
            lineNumber: undefined,
        };

        const tx = Transaction.create(
            matcherImportInfo.id,
            accountInfo.id,
            true,
            importedValues,
        );

        availableTransactions.addNew(tx, accountInfo, matcherImportInfo, false);
        availableTransactions.relateParentChild(parent.id, tx.id);
    }
}

/**
 * Generic parent-child matcher that only handles incomplete parents
 * by creating adjustment children for small discrepancies.
 */
export class GenericTxParentChildMatcher implements ParentChildMatch {
    getParents(
        _children: Transaction[],
        _availableTransactions: Transactions,
    ): Array<{ child: Transaction; parent: Transaction }> {
        throw new Error('GenericTxParentChildMatcher does not support parent search');
    }

    handleIncompleteParent(
        parent: Transaction,
        availableTransactions: Transactions,
        missingChildAmount: number,
    ): boolean {
        if (missingChildAmount === 0) {
            return true;
        }

        if (isMissingAmountTolerable(parent, missingChildAmount)) {
            const finalMissingAmount = -1 * missingChildAmount;
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
