/**
 * Public API for the core domain model types.
 *
 * @module
 */

export {
  TransactionReason,
  type TransactionReasonValue,
  UnknownAdjustment,
  NetOutgoing,
  NetIncoming,
  NetInterAccount,
  intersects,
  isOutgoing,
  isIncoming,
  isInterAccount,
  type TransactionReasonInfo,
  transactionReasonInfo,
  transactionReasonTitleLookup,
  transactionReasonPluralTitleLookup,
  transactionReasonCategoryLookup,
} from './transaction-reason.js';

export {
  type AuditInfo,
  createAuditInfo,
  updateAuditInfo,
} from './audit-info.js';

export { type ImportInfo } from './import-info.js';

export { LineItemType } from './line-item-type.js';

export { AccountType, type AccountInfo } from './account-info.js';

export { type AccountConfig } from './account-config.js';

export {
  ScopeType,
  validateScopeFilter,
  type ScopeFilter,
  createScopeFilter,
  type EditValue,
  editValue,
  voidedEditValue,
  type EditedValues,
  mergeEditedValues,
  type TransactionEditData,
} from './transaction-edit.js';

export {
  type ImportedValues,
  type TransactionData,
  Transaction,
} from './transaction.js';

export { TransactionEdits } from './transaction-edits.js';

export {
  Transactions,
  type TransactionsData,
  deserializeDictionary,
} from './transactions.js';
