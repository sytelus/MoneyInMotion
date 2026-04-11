# MoneyInMotion - Business Rules

This document catalogs all business rules implemented in the application, organized by domain area.

---

## Core Design Principles

These principles (from `Notes/Principles.html`) govern the entire architecture:

1. **Never alter or delete original source transaction files**
2. **Always be able to reconstruct all outputs at any time** from source files + edits
3. **Never alter source transaction information** - originals are immutable
4. **All changes are created as edits**, saved in separate files
5. **User edits are kept separately** and can be applied on top of any transactions or shared with other users
6. **Most edits should be in form of rules** (scope-based, not one-off)

---

## Transaction Validation Rules

### Amount-Reason Consistency
- Transactions with `NetOutgoing` reasons (Purchase, Fee, CheckPayment, AtmWithdrawal, LoanPayment, ExpenseAdjustment, MatchAdjustmentDebit, CashAdvance) must have **negative** amounts
- Transactions with `NetIncoming` reasons (Return, PointsCredit, OtherCredit, CheckRecieved, Interest, DiscountRecieved, IncomeAdjustment, MatchAdjustmentCredit, PaymentRecieved) must have **positive** amounts
- A transaction with `UnknownAdjustment` reason is invalid and must be resolved before saving

### Required Fields
- `ImportId` must have a value
- `AccountId` must not be empty
- `EntityName` must not be empty
- `TransactionDate` must be set
- `AuditInfo` must be provided

### Content Hash
- Computed as MD5 of: `AccountId \t TransactionReason \t Amount \t EntityIdOrName(UPPER) \t PostedDate(UTC) \t TransactionDate(UTC) \t InstituteReference`
- Two transactions with the same content hash are considered duplicates
- Content hash is used for merge deduplication across imports

### Transaction ID
- Computed as MD5 of: `ContentHash + TransactionDate + InstituteReference`
- Must be unique within the merged transaction collection

---

## Transaction Reason Classification

### Outgoing (Negative Amount Required)
| Reason | Description |
|--------|-------------|
| Purchase | General purchase (default for negative amounts) |
| Fee | Service fees, bank fees |
| CheckPayment | Payment by check |
| AtmWithdrawal | ATM cash withdrawal |
| LoanPayment | Loan installment payment |
| ExpenseAdjustment | Expense-side adjustment |
| MatchAdjustmentDebit | System-generated debit adjustment for matching |
| CashAdvance | Cash advance on credit card |

### Incoming (Positive Amount Required)
| Reason | Description |
|--------|-------------|
| Return | Refund or return credit |
| PointsCredit | Rewards points credit |
| OtherCredit | Miscellaneous credit (default for positive amounts) |
| CheckRecieved | Check deposit |
| Interest | Interest earned |
| DiscountRecieved | Discount or rebate |
| IncomeAdjustment | Income-side adjustment |
| MatchAdjustmentCredit | System-generated credit adjustment for matching |
| PaymentRecieved | Payment received (for business accounts) |

### Inter-Account (Either Sign)
| Reason | Description |
|--------|-------------|
| InterAccountPayment | Payment between own accounts |
| InterAccountTransfer | Transfer between own accounts |

---

## Transaction Reason Inference Rules

When a statement does not explicitly provide a transaction type, the system infers it using these ordered rules:

### For Negative Amounts
1. Entity name contains "FEE" (case-insensitive) -> `Fee`
2. Entity name contains "ATM" (case-insensitive) -> `AtmWithdrawal`
3. Entity name contains "loan" (case-insensitive) -> `LoanPayment`
4. Transaction has a check reference number -> `CheckPayment`
5. Default -> `Purchase`

### For Positive Amounts
1. Entity name contains "Interest" (case-insensitive) -> `Interest`
2. Entity name contains "POINTS CREDIT" (case-insensitive) -> `PointsCredit`
3. Entity name contains "refund" or "return" (case-insensitive) -> `Return`
4. Transaction has a check reference number -> `CheckRecieved`
5. Default -> `OtherCredit`

---

## PayPal Transaction Reason Rules

PayPal transactions are classified by the PayPal "type" field:

| PayPal Type | Mapped Reason |
|-------------|---------------|
| Payment Sent | Purchase |
| Donation Sent | Purchase |
| BillPay | Purchase |
| Refund | Return |
| Charge From ... Card | InterAccountPayment |
| Credit To ... Card | InterAccountTransfer |
| Add Funds from a Bank Account | InterAccountTransfer |
| Payment Received | PaymentRecieved |

### PayPal Ignorable Activities
These PayPal activity types are skipped during import:
- Denied, Removed, Placed, Canceled, Cleared, Failed, Refunded, Authorization, Temporary Hold

---

## Entity Name Normalization Rules

1. **Split** entity name into tokens by whitespace
2. **For each token**:
   - Extract letter-containing core using pattern: `[non-letters][letters+...][non-letters]`
   - Remove trailing numeric-only tokens shorter than 4 characters (likely reference numbers)
3. **Case normalization**:
   - ALL UPPERCASE: Convert to Title Case
   - ALL UPPERCASE with dots (e.g., "AMAZON.COM"): Convert to lowercase ("amazon.com")
   - Mixed case: Leave unchanged
4. **Rejoin** cleaned tokens with spaces

### Examples
| Original | Normalized |
|----------|-----------|
| `AMAZON.COM*MK4TL02S3` | `amazon.com` |
| `WHOLEFDS MKT 10234` | `Wholefds Mkt` |
| `PAYMENT - THANK YOU` | `Payment - Thank You` |

---

## Parent-Child Matching Rules

### When Parent-Child Matching Applies
- Account type is `OrderHistory` (Amazon, Etsy)
- Account has `requiresParent = true`
- Transaction has `ParentChildMatchFilter` set

### Matching Criteria
1. Date match: Child transaction date within `transferDayTolerance` days of parent date (default: 3 days)
2. Amount match: Sum of child amounts equals parent amount (within tolerance)
3. Filter match: `ParentChildMatchFilter` value matches (e.g., order ID)

### Tolerance Rules for Incomplete Parents
When child transactions don't sum exactly to parent amount:
- If `|missingAmount| < 0.02 * |parentAmount|` OR `|missingAmount| < $0.50`:
  - Create a synthetic adjustment transaction for the difference
  - Use `MatchAdjustmentCredit` for positive adjustments
  - Use `MatchAdjustmentDebit` for negative adjustments
- If missing amount exceeds tolerance:
  - Mark parent with `HasMissingChild = true`
  - Leave unmatched for manual review

### Amazon-Specific Rules
- Line items identified by presence of `item subtotal` attribute
- Item amount = `item subtotal * -1` (negated for expense)
- Order amount = `total charged * -1`
- Shipping, tax, and promotions extracted from provider attributes
- Orders with status "shipment planned" or "shipping soon" are rejected (not yet shipped)
- Invalid character (U+FFFD) in amounts treated as 0

### Etsy-Specific Rules
- Orders identified by presence of `grandtotal` attribute
- Line items don't have `grandtotal`
- Timestamps are Unix epoch in `creation_tsz` and `paid_tsz` fields
- Amounts are negated (purchases become negative)

---

## Inter-Account Transfer Matching Rules

### Matching Criteria
1. **Amount**: Opposite values (e.g., -500 in checking matches +500 in credit card)
2. **Date**: Within `transferDayTolerance` days (default: 3)
3. **Name tags**: Entity name must contain one of the account's `interAccountNameTags` (e.g., "transfer", "wire", "payment")
4. **Different accounts**: Must be from different account IDs

### Matching Priority
1. First: Cross-institution matching (different `instituteName`)
2. Second: Same-institution matching with looser criteria (amount tolerance +-$1, date tolerance +-2 days)

### Match Result
- Both transactions get `RelatedTransferId` set to each other's ID
- This is bidirectional linking

---

## Edit System Rules

### Scope Filter Evaluation
- Multiple scope filters on a single edit are evaluated with **AND** logic (all must match)
- Within a single filter, multiple parameters are evaluated with **OR** logic (any can match)
- Exception: `EntityNameAllTokens` uses **AND** logic (all tokens must be present)

### Scope Filter Parameter Requirements
| Scope Type | Required Parameters |
|------------|-------------------|
| None, All | 0 parameters |
| TransactionId | 1+ transaction ID(s) |
| EntityName | 1+ entity name(s) |
| EntityNameNormalized | 1+ normalized name(s) |
| EntityNameAnyTokens | 1+ token(s) - OR matching |
| EntityNameAllTokens | 1+ token(s) - AND matching |
| AccountId | 1+ account ID(s) |
| TransactionReason | 1+ reason code(s) |
| AmountRange | Exactly 2 parameters (min, max) |

### Edit Merge Rules
When multiple edits apply to the same transaction:
1. Edits are applied in order of creation (by audit timestamp)
2. Each edit's values are merged into the cumulative `MergedEdit`:
   - `null` value in edit -> Keep previous value (no change)
   - Non-null, `isVoided = false` -> Apply new value
   - Non-null, `isVoided = true` -> Revert to original (void the edit)
3. Later edits override earlier edits for the same field

### Edit Audit Rules
- Every edit must have `AuditInfo` with creator identity and timestamp
- Edit IDs are recorded in `AppliedEditIdsDescending` on each transaction
- Timestamp backups are created before saving edits to prevent data loss

---

## Data Persistence Rules

### File Repository Rules
- Statements directory is read-only (never modified by the application)
- Merged directory is the only writable location
- Named locations are stored in `NamedLocations.json` for path resolution
- Edits are saved with timestamped backup: `{filename}.{yyyyMMddHHmmssffff}.{ext}`

### Merge Rules
- Transactions with matching content hashes are merged (not duplicated)
- When same transaction appears in different formats, the later import enriches the existing record
- Account and import metadata is always updated/added during merge
- After merge, parent-child matching and transfer matching are re-run

### Serialization Rules
- All domain objects use `[DataContract]` / `[DataMember]` attributes
- JSON serialization via `System.Runtime.Serialization` and Newtonsoft.Json
- Dates serialized in UTC format
- Content hashes and IDs serialized as Base64 strings

---

## Web API Rules

### Caching Rules
- Transactions are cached per-user in `Lazy<T>` containers
- Cache is invalidated when `FileSystemWatcher` detects file changes
- 5-second debounce on file change events to prevent rapid reloads
- Cache is invalidated after edit save operations

### Request Rules
- `GET /api/transactions` returns the full transaction set for the current user
- `POST /api/transactionedits` accepts an array of `TransactionEdit` objects
- Edit response includes `AffectedTransactionsCount` for client verification

---

## UI Display Rules

### Amount Formatting
- Negative amounts displayed in red
- Currency formatted with `accounting.js`: `$1,234.56`
- Amount ranges for scope filters use 0.9x (min) and 1.1x (max) of actual amount

### Entity Name Truncation
- Entity names truncated based on hierarchy depth
- More indentation = more truncation
- Full name shown in tooltip on hover

### Group Visibility
- Groups with `isOptional = true` and single child are auto-collapsed
- Empty groups are hidden
- Visibility propagates from parent to children

### Date Display
- Dates formatted using moment.js locale settings
- Default format follows browser locale
- Navigation shows year/month selectors

### Marked Transactions
- Transactions within marked date range get blue italic styling
- Marked totals shown separately in group summaries
- Marking is session-only (not persisted)
