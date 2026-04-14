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
    "type": 1,
    "id": "chase-checking",
    "title": "Chase Checking Account",
    "instituteName": "Chase",
    "requiresParent": false,
    "interAccountNameTags": ["transfer"]
  },
  "fileFilters": ["*.csv"],
  "scanSubFolders": true
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

The `AccountConfig` interface is defined in `@moneyinmotion/core` (`packages/core/src/models/account-config.ts`) and consists of `accountInfo` (an `AccountInfo` object), `fileFilters` (glob patterns for statement file discovery), and `scanSubFolders` (whether to recurse into subdirectories).

---

## 2. Statement Import and Parsing

### File Discovery
`FileRepository.getStatementLocations()` scans the Statements directory:
1. Finds all `AccountConfig.json` files (recursively)
2. For each account, scans for files matching the `fileFilters` glob patterns
3. Creates `FileLocation` objects with import metadata (address, content type, account config, import info)

Raw statement files can reach the `Statements/` tree in two ways:

- Uploaded from the Accounts page in the web UI via `POST /api/accounts/:id/upload`
- Placed there manually by the user outside the app

### File Format Detection
Content type is auto-detected from file extension:
- `.csv`, `.newcsv` -> CSV (parsed with papaparse)
- `.json` -> JSON
- `.iif` -> QuickBooks IIF

### Statement Parsing Pipeline
```
Raw File
    |
    v
FileFormatParser (CsvFileParser / JsonFileParser / IifFileParser)
    -> Produces: Array<Record<string, string>> (column-value pairs)
    |
    v
StatementParser (institution-specific)
    -> Maps columns to StatementColumnTypes
    -> Infers TransactionReason from amount sign and keywords
    -> Returns ImportedValues objects
    |
    v
Transaction.create()
    -> Validates required fields
    -> Computes content hash and transaction ID
    -> Creates immutable Transaction instance
```

File format parsing is handled by the parsers in `packages/server/src/parsers/file-format/`. The CSV parser uses papaparse for robust CSV handling including quoted fields, different delimiters, and header detection.

Statement parsers in `packages/server/src/parsers/statement/` extend `StatementParserBase` and implement institution-specific column mapping. The server selects the appropriate parser based on the `instituteName` field in the account configuration via `getStatementParser()`.

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
Each transaction gets an MD5 hash (via the `ts-md5` library) computed from:
```
AccountId \t TransactionReason \t Amount \t EntityIdOrName(UPPER) \t PostedDate(UTC) \t TransactionDate(UTC) \t InstituteReference
```

This hash serves as the primary deduplication key. When importing the same statement file twice, or when two sources describe the same transaction, the content hash prevents duplicates.

The hashing function is in `@moneyinmotion/core` at `packages/core/src/utils/hash.ts`.

### Transaction ID
The unique transaction ID is an MD5 hash of:
```
ContentHash + TransactionDate + InstituteReference
```

This allows distinguishing between transactions that have identical content but different metadata.

---

## 4. Transaction Merging

When new statements are imported (via `POST /api/import/scan`), they are merged with existing transactions in `Transactions.merge()`:

1. **Hash Lookup**: For each new transaction, check if a transaction with the same content hash already exists
2. **Enrichment**: If the transaction exists but came from a different format, enrich the existing transaction with additional data from the new source
3. **Addition**: If no matching hash exists, add the transaction as new
4. **Metadata Update**: Update account and import metadata collections

After merging, `matchTransactions()` is called to run parent-child and inter-account transfer matching on the full set.

---

## 5. Parent-Child Matching

Order history accounts (Amazon, Etsy) produce line-item transactions that must be matched to corresponding credit card charges. The matching logic is in `@moneyinmotion/core` at `packages/core/src/matching/`.

### How It Works
1. Identify transactions from `requiresParent` accounts (order history)
2. Find matching parent transactions in regular accounts by:
   - Exact match first by `amount + transactionDate`
   - Fuzzy fallback of amount ±$1 and date ±2 days, ranked by
     `abs(amountDelta) * (daysDelta + 1)`
   - Line-item children instead match by `ParentChildMatchFilter`
     (Amazon order ID + tracking; Etsy receipt ID)
3. Link children to parent via `ParentId` field
4. Handle discrepancies:
   - Small rounding differences (< 2% of parent or < $0.50): Create synthetic adjustment transactions
   - Sum within half a cent of the parent amount is treated as balanced
     (avoids spurious `HasMissingChild` from IEEE-754 rounding)
   - Otherwise mark parent with `HasMissingChild = true`

### Amazon Order Matching (`AmazonOrderMatcher`)
- Attributes tracked: shipping charge, tax charged, total promotions
- Items identified by `item subtotal` attribute presence
- ParentChildMatchFilter format: `{order_id}|{carrier_tracking}`

### Etsy Order Matching (`EtsyOrderMatcher`)
- Attributes tracked: total_shipping_cost, total_tax_cost, discount_amt
- Orders identified by `grandtotal` attribute
- ParentChildMatchFilter uses `receipt_id`

---

## 6. Inter-Account Transfer Detection

Transfers between accounts (e.g., checking to credit card payment) appear as two separate transactions: a debit in one account and a credit in another. The matching logic is in `GenericTxMatcher`.

### Matching Algorithm
1. Find unmatched transactions with reason `InterAccountPayment`, `InterAccountTransfer`, or `OtherCredit`
2. For each, search other accounts for a transaction with:
   - Opposite amount (e.g., -$500 matches +$500)
   - Date within tolerance (default 3 days)
   - Entity name containing the account's `interAccountNameTags` (e.g., "transfer", "wire")
3. Link matched pairs via `RelatedTransferId`
4. Optional second pass for same-institution matching with looser criteria

---

## 7. Entity Name Normalization

Raw entity names from bank statements are often messy (e.g., `"AMAZON.COM*MK4TL02S3 AMZN.COM/BILL WA 12345"`). The normalizer in `@moneyinmotion/core` (`packages/core/src/normalization/entity-name-normalizer.ts`) cleans these up:

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

The edit system is defined in `@moneyinmotion/core` at `packages/core/src/models/transaction-edit.ts` and `transaction-edits.ts`.

### Edit Structure
Every edit consists of:
- **ScopeFilters**: Define which transactions this edit applies to
- **EditedValues**: The fields being changed
- **AuditInfo**: Who created it and when
- **ID**: UUID for unique identification
- **SourceId**: Identifies the origin of the edit

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
- CategoryPath (hierarchical: `["Shopping", "Electronics"]`)

### Edit Application
When an edit is applied via `Transactions.apply()`:
1. Check each scope filter against transaction properties
2. If all filters match, merge edit values into the transaction's `MergedEdit`
3. Three-way merge logic:
   - **New value** (EditValue present, not voided) -> Apply new value
   - **No change** (EditValue null) -> Keep existing
   - **Void** (EditValue present, voided) -> Revert to original

### Persistence
Edits are saved to `LatestMergedEdits.json` with automatic timestamped backup before each save. The server auto-saves after every edit application via `TransactionCache.applyEdits()`.

---

## 9. Display and Aggregation

### Hierarchical Grouping (NetAggregator)
The `NetAggregator` in `@moneyinmotion/core` (`packages/core/src/aggregation/net-aggregator.ts`) groups transactions into a tree structure:
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
Each group maintains running totals via `TransactionAggregates`:
- Count of transactions
- Positive total (income)
- Negative total (expenses)
- Net total
- Breakdown by TransactionReason
- Metadata counters: flags, notes, categories, accounts, dates

### Monthly Navigation
The React UI provides year/month navigation:
- `YearMonthNav` component renders a collapsible accordion of years with month selectors
- Selecting a year/month updates the Zustand store (`selectYearMonth()`)
- `getFilteredTransactions()` filters the transaction list to the selected period

---

## 10. API Communication

### REST Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness payload (status, uptime, environment) |
| `GET` | `/api/config` | Returns server configuration |
| `PUT` | `/api/config` | Updates data path or port; requires server restart to take effect |
| `GET` | `/api/accounts` | Returns all configured accounts plus per-account import stats |
| `POST` | `/api/accounts` | Creates a new account folder and `AccountConfig.json` |
| `POST` | `/api/accounts/:id/upload` | Uploads raw statement files into the target account folder |
| `PUT` | `/api/accounts/:id` | Updates an existing account configuration |
| `DELETE` | `/api/accounts/:id` | Removes `AccountConfig.json` (statement files kept) |
| `GET` | `/api/transactions` | Returns all transactions as serialized JSON |
| `POST` | `/api/transaction-edits` | Applies edit rules, returns affected count |
| `POST` | `/api/import/scan` | Scans and imports new statement files; returns `{ newTransactions, totalTransactions, importedFiles, failedFiles }` |
| `POST` | `/api/import/save` | Persists data to disk |

All endpoints accept and return JSON. Request bodies are validated using Zod schemas on the server.

### Request/Response Flow
```
React Client                         Express Server
     |                                     |
     |-- GET /api/transactions ----------->|
     |                                     |- TransactionCache.getTransactions()
     |                                     |- Lazy load from disk if needed
     |                                     |- Serialize to JSON
     |<--- TransactionsData JSON ----------|
     |                                     |
     |-- POST /api/transaction-edits ----->|
     |   (TransactionEditData[] JSON)      |- Zod validation
     |                                     |- TransactionCache.applyEdits()
     |                                     |- Auto-save to disk (with backup)
     |<--- { affectedTransactionsCount } --|
     |                                     |
     | React Query invalidates cache       |
     |-- GET /api/transactions ----------->|  (automatic refetch)
```

### Client-Side API Layer
The web package uses a two-layer approach:
1. **API Client** (`packages/web/src/api/client.ts`): Thin `fetch` wrapper with error handling, targeting the `/api` prefix (proxied by Vite in development)
2. **React Query Hooks** (`packages/web/src/api/hooks.ts`): `useQuery` for reads (`useTransactions`, `useAccounts`) and `useMutation` for writes (`useApplyEdits`, `useScanStatements`, `useSaveData`), with automatic cache invalidation on success

### Caching Strategy
- **Server-side**: `TransactionCache` with lazy loading and chokidar file watcher for invalidation (2-second debounce, 5-second self-change cooldown)
- **Client-side**: React Query caches API responses (5-minute stale time, single retry), Zustand store holds deserialized objects for immediate rendering
