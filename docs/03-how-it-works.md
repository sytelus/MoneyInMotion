# MoneyInMotion - How Everything Works

## Overview

MoneyInMotion processes personal financial data through a pipeline: **Import -> Parse -> Merge -> Match -> Edit -> Display**. This document explains each stage in detail.

---

## 1. Account Configuration

Before importing data, each account (bank, credit card, PayPal, etc.) must be configured with an `AccountConfig.json` file placed in the account's statement folder.

### AccountConfig.json Structure
```json
{
  "accountInfo": {
    "type": 1,                              // AccountType enum
    "id": "chase-checking",                 // Unique identifier
    "title": "Chase Checking Account",      // Display name
    "instituteName": "Chase",               // Bank/institution name
    "requiresParent": false,                // True for order history accounts
    "interAccountNameTags": ["transfer"]    // Keywords identifying transfers
  },
  "fileFilters": ["*.csv"],                 // File patterns to scan
  "scanSubFolders": true                    // Recursive scanning
}
```

### Account Types
| Value | Type | Description |
|-------|------|-------------|
| 1 | CreditCard | Credit card accounts |
| 2 | BankChecking | Bank checking accounts |
| 4 | BankSavings | Bank savings accounts |
| 5 | OrderHistory | Order history (Amazon, Etsy) - requires parent matching |
| 6 | EPayment | Electronic payment services (PayPal) |

---

## 2. Statement Import and Parsing

### File Discovery
`FileRepository.GetStatementLocations()` scans the Statements directory:
1. Finds all `AccountConfig.json` files
2. For each account, scans for files matching `fileFilters` patterns
3. Creates `FileLocation` objects with import metadata

### File Format Detection
Content type is auto-detected from file extension:
- `.csv`, `.newcsv` -> CSV
- `.json` -> JSON
- `.iif` -> QuickBooks IIF

### Statement Parsing Pipeline
```
Raw File
    |
    v
FileFormatParser (CSV/JSON/IIF)
    -> Produces: IEnumerable<IDictionary<string, string>> (column-value pairs)
    |
    v
StatementParser (institution-specific)
    -> Maps columns to StatementColumnTypes
    -> Infers TransactionReason from amount sign and keywords
    -> Creates Transaction objects
```

### Column Auto-Detection
The generic parser maps column headers to types:
| Column Header | Maps To |
|--------------|---------|
| `date`, `trans date`, `transaction date` | TransactionDate |
| `post date` | PostedDate |
| `description`, `title`, `payee` | EntityName |
| `amount` | Amount |
| `type` | TransactionReason |
| `debit` | DebitAmount |
| `credit` | CreditAmount |
| `reference` | InstituteReference |
| `category` | ProviderCategoryName |
| `account` | AccountNumber |
| `chkref` | CheckReference |

Unmapped columns become `ProviderAttributes` (preserved but not directly used).

### Transaction Reason Inference
When the transaction type is not explicitly provided in the source data, the system infers it from amount sign and entity name keywords:

**Negative amounts (outgoing):**
- Entity name contains "FEE" -> `Fee`
- Entity name contains "ATM" -> `AtmWithdrawal`
- Entity name contains "loan" -> `LoanPayment`
- Has check reference -> `CheckPayment`
- Default -> `Purchase`

**Positive amounts (incoming):**
- Entity name contains "Interest" -> `Interest`
- Entity name contains "POINTS CREDIT" -> `PointsCredit`
- Entity name contains "refund" or "return" -> `Return`
- Has check reference -> `CheckRecieved`
- Default -> `OtherCredit`

---

## 3. Content Hashing and Deduplication

### Content Hash Computation
Each transaction gets an MD5 hash computed from:
```
AccountId \t TransactionReason \t Amount \t EntityIdOrName(UPPER) \t PostedDate(UTC) \t TransactionDate(UTC) \t InstituteReference
```

This hash serves as the primary deduplication key. When importing the same statement file twice, or when two sources describe the same transaction, the content hash prevents duplicates.

### Transaction ID
The unique transaction ID is an MD5 hash of:
```
ContentHash + TransactionDate + InstituteReference
```

This allows distinguishing between transactions that have identical content but different metadata.

---

## 4. Transaction Merging

When new statements are imported, they are merged with existing transactions:

1. **Hash Lookup**: For each new transaction, check if a transaction with the same content hash already exists
2. **Enrichment**: If the transaction exists but came from a different format, enrich the existing transaction with additional data from the new source
3. **Addition**: If no matching hash exists, add the transaction as new
4. **Metadata Update**: Update account and import metadata collections

---

## 5. Parent-Child Matching

Order history accounts (Amazon, Etsy) produce line-item transactions that must be matched to corresponding credit card charges.

### How It Works
1. Identify transactions from `RequiresParent` accounts (order history)
2. Find matching parent transactions in regular accounts by:
   - Matching date (within tolerance window, default 3 days)
   - Matching total amount (sum of children = parent amount)
   - Using `ParentChildMatchFilter` for order ID correlation
3. Link children to parent via `ParentId` field
4. Handle discrepancies:
   - Small rounding differences (< 2% of parent or < $0.50): Create synthetic adjustment transactions
   - Missing children: Mark parent with `HasMissingChild = true`

### Amazon Order Matching
- Attributes tracked: shipping charge, tax charged, total promotions
- Items identified by `item subtotal` attribute presence
- ParentChildMatchFilter format: `{order_id}|{carrier_tracking}`

### Etsy Order Matching
- Attributes tracked: total_shipping_cost, total_tax_cost, discount_amt
- Orders identified by `grandtotal` attribute
- ParentChildMatchFilter uses `receipt_id`

---

## 6. Inter-Account Transfer Detection

Transfers between accounts (e.g., checking to credit card payment) appear as two separate transactions: a debit in one account and a credit in another.

### Matching Algorithm
1. Find unmatched transactions with reason `InterAccountPayment`, `InterAccountTransfer`, or `OtherCredit`
2. For each, search other accounts for a transaction with:
   - Opposite amount (e.g., -$500 matches +$500)
   - Date within tolerance (default 3 days)
   - Entity name containing account's `InterAccountNameTags` (e.g., "transfer", "wire")
3. Link matched pairs via `RelatedTransferId`
4. Optional second pass for same-institution matching with looser criteria

---

## 7. Entity Name Normalization

Raw entity names from bank statements are often messy (e.g., `"AMAZON.COM*MK4TL02S3 AMZN.COM/BILL WA 12345"`). The normalizer cleans these up:

1. **Tokenize**: Split by whitespace
2. **Clean tokens**: Remove leading/trailing non-letter characters
3. **Remove noise**: Drop short numeric-only trailing parts
4. **Case normalize**:
   - ALL CAPS -> Title Case (unless contains dots, then lowercase)
   - Already mixed case -> leave as-is
5. **Join**: Recombine cleaned tokens

Result: `"Amazon.com Amzn.com/bill"` (more readable, better for grouping)

---

## 8. The Edit System

### Edit Structure
Every edit consists of:
- **ScopeFilters**: Define which transactions this edit applies to
- **EditedValues**: The fields being changed
- **AuditInfo**: Who created it and when
- **ID**: UUID for unique identification

### Scope Filter Types
| Type | Description | Parameters |
|------|-------------|------------|
| None | Matches nothing | - |
| All | Matches everything | - |
| TransactionId | Exact transaction match | Transaction ID(s) |
| EntityName | Exact name match | Entity name(s) |
| EntityNameNormalized | Normalized name match | Normalized name(s) |
| EntityNameAnyTokens | Any word matches | Token(s) |
| EntityNameAllTokens | All words must match | Token(s) |
| AccountId | Account filter | Account ID(s) |
| TransactionReason | Reason type filter | Reason code(s) |
| AmountRange | Amount range filter | Min, Max |

Multiple scope filters can be combined (AND logic).

### Editable Fields
- TransactionReason (categorization)
- TransactionDate
- Amount
- EntityName
- IsFlagged (boolean)
- Note (free text)
- CategoryPath (hierarchical: ["Shopping", "Electronics"])

### Edit Application
When an edit is applied:
1. Check each scope filter against transaction properties
2. If all filters match, merge edit values into transaction's `MergedEdit`
3. Three-way merge logic:
   - **New value** (EditValue present, not voided) -> Apply new value
   - **No change** (EditValue null) -> Keep existing
   - **Void** (EditValue present, voided) -> Revert to original

### Persistence
Edits are saved to `LatestMergedEdits.json` with automatic timestamped backup before each save.

---

## 9. Display and Aggregation

### Hierarchical Grouping (NetAggregator)
Transactions are grouped into a tree structure:
```
Root (Net)
+-- Income
|   +-- [Entity Name]
|       +-- [Category] (if assigned)
|           +-- Transaction 1
|           +-- Transaction 2
+-- Expenses
|   +-- [Entity Name]
|       +-- [Category]
|           +-- Transaction 3
+-- Transfers
|   +-- [Entity Name]
|       +-- Transaction 4
+-- Unmatched
    +-- (Orphaned order items)
```

### Transaction Aggregates
Each group maintains running totals:
- Count of transactions
- Positive total (income)
- Negative total (expenses)
- Net total
- Breakdown by TransactionReason
- Metadata counters: flags, notes, categories, accounts, dates

### Monthly Navigation
The web UI provides year/month navigation:
- Year panels with month selectors
- URL fragment state: `#year=2024&month=03`
- Filters transaction display to selected period

---

## 10. API Communication

### REST Endpoints
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/transactions` | Returns all transactions as JSON |
| POST | `/api/transactionedits` | Applies edit rules, returns affected count |

### Request/Response Flow
```
Client                          Server
  |                               |
  |-- GET /api/transactions ----->|
  |                               |- Load from cache or file
  |                               |- Serialize to JSON
  |<--- JSON transaction data ----|
  |                               |
  |-- POST /api/transactionedits->|
  |   (TransactionEdit[] JSON)    |- Deserialize edits
  |                               |- Apply to transactions
  |                               |- Save to file (with backup)
  |                               |- Invalidate cache
  |<--- { affectedCount: N } -----|
```

### Caching Strategy
- Server-side: `Lazy<T>` per-user with `FileSystemWatcher` for invalidation
- Client-side: Repository caches last API response until explicit refresh
- Corrected values memoized on Transaction objects after first computation
