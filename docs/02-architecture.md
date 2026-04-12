# MoneyInMotion - Architecture

## Monorepo Structure

MoneyInMotion is organized as an npm workspaces monorepo with three packages:

```
MoneyInMotion/
|
+-- packages/
|   +-- core/              @moneyinmotion/core    Shared domain models, matching, aggregation
|   +-- server/            @moneyinmotion/server  Express API, parsers, storage, caching
|   +-- web/               @moneyinmotion/web     React SPA frontend
|
+-- scripts/
|   +-- lib.sh             Shared bash helpers for run.sh and build.sh
+-- docs/                  Documentation
+-- legacy/                Original .NET/JS codebase (archived for reference)
+-- install.sh             One-line install / update
+-- run.sh                 Start the app in dev or prod mode
+-- build.sh               Production build
+-- package.json           Root workspace configuration
+-- tsconfig.json          Root TypeScript project references
+-- tsconfig.base.json     Shared TypeScript compiler options
+-- vitest.config.ts       Root Vitest config (aggregates all three packages)
```

### Package Dependency Graph

```
@moneyinmotion/core       (no internal dependencies)
        ^
        |
@moneyinmotion/server     (depends on core)
        ^
        |
@moneyinmotion/web        (depends on core)
```

Both `server` and `web` depend on `core`. The server and web packages do not depend on each other; they communicate via HTTP at runtime.

---

## Layer Architecture

```
+----------------------------------------------------------+
|                     USER INTERFACE                         |
|  +-----------------------------------------------------+ |
|  |  @moneyinmotion/web                                 | |
|  |  React 19 + React Router 7 + Tailwind CSS           | |
|  |  State: Zustand (client) + React Query (server)     | |
|  |  UI: Radix UI primitives + Lucide icons             | |
|  |  Build: Vite 6                                      | |
|  +---------------------------+-------------------------+ |
+----------------------------------------------------------+
                               |
                          HTTP / JSON
                               |
+------------------------------v---------------------------+
|                     API SERVER                            |
|  +-----------------------------------------------------+ |
|  |  @moneyinmotion/server                              | |
|  |  Express 5 + Zod validation                         | |
|  |  TransactionCache (in-memory, chokidar file watch)  | |
|  |  Statement Parsers (papaparse CSV, JSON, IIF)       | |
|  |  FileRepository (JSON file-based storage)           | |
|  +-----------------------------------------------------+ |
+----------------------------------------------------------+
                               |
+------------------------------v---------------------------+
|                     CORE DOMAIN                           |
|  +-----------------------------------------------------+ |
|  |  @moneyinmotion/core                                | |
|  |  Transaction / Transactions (immutable entities)    | |
|  |  TransactionEdit / TransactionEdits (edit system)   | |
|  |  AccountInfo / AccountConfig                        | |
|  |  Parent-Child Matchers (Amazon, Etsy, generic)      | |
|  |  Inter-Account Transfer Matcher                     | |
|  |  Entity Name Normalizer                             | |
|  |  NetAggregator / TransactionAggregates              | |
|  |  Content hashing (ts-md5)                           | |
|  +-----------------------------------------------------+ |
+----------------------------------------------------------+
                               |
+------------------------------v---------------------------+
|                     FILE SYSTEM                           |
|  Statements/   Raw imported CSV/JSON/IIF files            |
|  Merged/       LatestMerged.json, LatestMergedEdits.json  |
|  AccountConfig.json   Per-account configuration           |
+----------------------------------------------------------+
```

---

## Package Details

### @moneyinmotion/core

The shared domain library. Contains all business logic, models, and algorithms with zero Node.js-specific APIs (pure TypeScript). Key modules:

| Directory | Contents |
|-----------|----------|
| `models/` | Transaction, Transactions, TransactionEdit, TransactionEdits, AccountInfo, AccountConfig, AuditInfo, ImportInfo, LineItemType, TransactionReason |
| `matching/` | ParentChildMatch, AmazonOrderMatcher, EtsyOrderMatcher, GenericOrderMatcher, GenericTxMatcher |
| `normalization/` | EntityNameNormalizer |
| `aggregation/` | NetAggregator, TransactionAggregates, TransactionReasonUtils, KeyCounter |
| `utils/` | Hash (ts-md5), DateUtils, StringUtils, CollectionUtils |

### @moneyinmotion/server

The Express API server. Handles HTTP requests, file I/O, statement parsing, and in-memory caching. Key modules:

| Directory | Contents |
|-----------|----------|
| `routes/` | Config, Accounts, Transactions, TransactionEdits, Import |
| `parsers/file-format/` | CsvFileParser (papaparse), JsonFileParser, IifFileParser |
| `parsers/statement/` | GenericStatementParser, AmexParser, PayPalParser, AmazonOrdersParser, EtsyBuyerParser, BarclayParser |
| `storage/` | FileRepository, FileLocation, TransactionsStorage, TransactionEditsStorage |
| `cache/` | TransactionCache (lazy load, chokidar file watcher, debounced invalidation) |
| `middleware/` | CORS, ErrorHandler |

### @moneyinmotion/web

The React single-page application. Key modules:

| Directory | Contents |
|-----------|----------|
| `components/layout/` | AppShell (three-column layout), Header (navigation bar), KeyboardShortcutsDialog |
| `components/navigation/` | YearMonthNav (year/month accordion sidebar) |
| `components/transactions/` | TransactionList, TransactionGroup, TransactionRow, TransactionSummary, AmountDisplay |
| `components/editing/` | CategoryEditor, NoteEditor, AttributeEditor, ScopeFilterEditor, EditConfirmDialog, TransactionContextMenu |
| `components/ui/` | Button, Dialog, Input, Select, Textarea, Badge (shared UI primitives) |
| `pages/` | WelcomePage (first-run setup), AccountsPage (create/edit/delete + status), SettingsPage (data path + port + import/save) |
| `api/` | HTTP client functions, React Query hooks |
| `store/` | Zustand transactions store (filtering, selection, expansion state) |
| `hooks/` | useKeyboardShortcuts (global keyboard navigation and editing shortcuts) |
| `lib/` | cn/format helpers (utils), canonical keyboard-shortcut list (shortcuts) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config` | Returns current server configuration (`port`, `dataPath`, `statementsDir`, `mergedDir`) |
| `PUT` | `/api/config` | Updates configuration (`dataPath` and/or `port`). Validates with Zod. |
| `GET` | `/api/accounts` | Scans `statementsDir` for `AccountConfig.json` files and returns each account plus import stats |
| `POST` | `/api/accounts` | Creates a new account folder and AccountConfig.json |
| `PUT` | `/api/accounts/:id` | Updates an existing account configuration |
| `DELETE` | `/api/accounts/:id` | Removes `AccountConfig.json` without deleting raw statement files |
| `GET` | `/api/transactions` | Returns all transactions as serialized JSON from the in-memory cache |
| `POST` | `/api/transaction-edits` | Applies an array of edits, returns `{ affectedTransactionsCount }` |
| `POST` | `/api/import/scan` | Triggers scan of statement files, merges new transactions, returns import stats |
| `POST` | `/api/import/save` | Persists cached transactions and/or edits to disk |

---

## Data Flow

### Import Flow

```
Statement files (CSV/JSON/IIF) in Statements/[AccountId]/
    |
    v
POST /api/import/scan
    |
    v
FileRepository.getStatementLocations()
    -> Discovers AccountConfig.json + statement files
    |
    v
FileFormatParser (CsvFileParser / JsonFileParser / IifFileParser)
    -> Produces column-value record arrays
    |
    v
StatementParser (institution-specific: Amex, PayPal, Amazon, Etsy, Barclay, Generic)
    -> Maps columns to ImportedValues
    -> Infers TransactionReason from amount sign and keywords
    |
    v
Transaction.create() + content hash computation (ts-md5)
    |
    v
Transactions.merge() -- deduplication via content hash
    |
    v
Transactions.matchTransactions()
    -> Parent-Child matching (Amazon/Etsy order reconciliation)
    -> Inter-Account transfer matching (by amount + date proximity)
    |
    v
Apply saved edits from LatestMergedEdits.json
    |
    v
Return { newTransactions, totalTransactions, importedFiles }
```

### Edit Flow

```
User action in React UI (categorize, flag, note, fix attribute)
    |
    v
Build TransactionEditData with ScopeFilters + EditedValues
    |
    v
POST /api/transaction-edits  (array of edits)
    |
    v
Zod validation on request body
    |
    v
TransactionCache.applyEdits()
    -> Transactions.apply() for each edit
    -> Matches scope filters against all transactions
    -> Merges edited values into matching transactions
    |
    v
Auto-save to LatestMerged.json + LatestMergedEdits.json (with timestamped backup)
    |
    v
Return { affectedTransactionsCount }
    |
    v
React Query invalidates transactions cache -> UI refreshes
```

### Display Flow

```
React app mounts AppShell
    |
    v
useTransactions() hook -> React Query -> GET /api/transactions
    |
    v
TransactionCache.getTransactions()
    -> Lazy load from LatestMerged.json + apply edits
    -> Return serialized TransactionsData
    |
    v
Zustand store: Transactions.fromData(data)
    -> Deserialize into Transaction objects
    |
    v
YearMonthNav: selectYearMonth() filters transactions
    |
    v
getFilteredTransactions() -> filter by year/month
    |
    v
NetAggregator groups into hierarchy: Income / Expenses / Transfers
    |
    v
TransactionList -> TransactionGroup -> TransactionRow (React components)
    |
    v
TransactionSummary: aggregates for selected transactions
```

---

## File Storage Layout

```
[Data Directory]/
|
+-- Statements/
|   +-- [AccountId]/
|   |   +-- AccountConfig.json
|   |   +-- statement-2024-01.csv
|   |   +-- statement-2024-02.csv
|   |   +-- ...
|   +-- [AnotherAccountId]/
|       +-- AccountConfig.json
|       +-- ...
|
+-- Merged/
    +-- LatestMerged.json         (all merged transactions)
    +-- LatestMergedEdits.json    (all user edits/rules)
    +-- *.backup.json             (timestamped backups)
```

The data directory defaults to `~/.moneyinmotion/data` and can be overridden via the `MONEYAI_DATA_PATH` environment variable or the `~/.moneyinmotion/config.json` file.

---

## Key Design Patterns

### Immutability Pattern
Transactions are immutable once created. All modifications are captured as `TransactionEdit` objects, maintaining a complete audit trail. Edits are stored separately from source data and can be voided (reverted). This enables:
- Lossless data preservation
- Full reconstruction from source files + edits
- Safe sharing of edit rules between users

### Content Hashing for Deduplication
Every transaction gets an MD5 content hash (via `ts-md5`) computed from: `AccountId | TransactionReason | Amount | EntityName | PostedDate | TransactionDate | InstituteReference`. When merging imports, transactions with matching content hashes are deduplicated rather than duplicated.

### Scope-Based Edit System
Edits use `ScopeFilter` objects to define which transactions they affect. This enables:
- **Single transaction edits**: Scope by transaction ID
- **Bulk categorization**: Scope by entity name (all "AMAZON" transactions get category "Shopping")
- **Pattern matching**: Scope by name tokens (any transaction containing "GROCERY")
- **Conditional edits**: Scope by account, amount range, or transaction reason

### State Management (Dual Layer)
- **Server state** (React Query): Manages data fetching, caching, background refetching, and cache invalidation for API data. Stale time is set to 5 minutes.
- **Client state** (Zustand): Manages UI-only concerns such as year/month filter selection, transaction selection, and group expand/collapse state.

### Plugin Architecture for Parsers
- **File Format Parsers**: CSV (via papaparse), JSON, and IIF implementations behind a common interface
- **Statement Parsers**: `StatementParserBase` with institution-specific implementations (AmexParser, PayPalParser, AmazonOrdersParser, EtsyBuyerParser, BarclayParser, GenericStatementParser)
- **Parent-Child Matchers**: Amazon, Etsy, and generic matcher implementations

---

## Concurrency and Caching

### Server-Side Cache (TransactionCache)
- Lazy initialization: transactions loaded from disk on first request
- Chokidar file watcher monitors the Merged directory for external changes
- 2-second debounce on file change events to avoid reload storms
- Self-triggered changes (saves) are ignored via `isSaving` flag and a 5-second cooldown
- Cache invalidated on external file change; reloaded on next `getTransactions()` call

### Client-Side Caching
- React Query caches API responses with a 5-minute stale time and single retry
- Zustand store holds deserialized Transaction objects for immediate UI rendering
- React Query invalidation triggers automatic refetch after mutations (edits, imports)
