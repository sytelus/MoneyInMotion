/** Present only recorded evidence; file timestamps must never be called import times. */
import type { Transaction, Transactions } from '@moneyinmotion/core';

export function transactionProvenance(transaction: Transaction, transactions: Transactions) {
  const source = transactions.getImportInfo(transaction.importId);
  const data = transaction.toData();
  return {
    source,
    sourceRow: data.lineNumber,
    postedDate: data.postedDate,
    institutionReference: data.instituteReference,
    recordCreatedAt: data.auditInfo.createDate,
    recordCreatedBy: data.auditInfo.createdBy,
    recordUpdatedAt: data.auditInfo.updateDate,
    recordUpdatedBy: data.auditInfo.updatedBy,
    relatedIds: [
      ...new Set(
        [
          data.parentId,
          data.relatedTransferId,
          data.combinedFromId,
          data.combinedToId,
          ...Object.keys(data.children ?? {}),
        ].filter((id): id is string => Boolean(id) && id !== transaction.id),
      ),
    ],
  };
}

/** Preserve time and UTC so same-day imports/corrections can be distinguished. */
export function provenanceTimestamp(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : `${date.toISOString().replace('T', ' ').replace('.000Z', '')} UTC`;
}
