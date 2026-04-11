# MoneyInMotion - Architecture

## Solution Structure

```
MoneyAI.sln (Visual Studio 2013, Format Version 12.00)
|
+-- MoneyAI/                    Core domain library (Class Library, .NET 4.5)
+-- MoneyAI.Repositories/       Data access layer (Class Library, .NET 4.5)
+-- MoneyAI.WebApi/             REST API + web host (ASP.NET Web API 5.0, .NET 4.5)
+-- MoneyAI.JS/                 JavaScript SPA frontend (RequireJS + Knockout.js)
+-- MoneyAI.WinForms/           Windows Forms desktop client (.NET 4.5)
+-- MoneyAI.Wpf/                WPF desktop client - stub (.NET 4.5)
+-- ObjectListView/             Third-party ListView control (Class Library)
+-- ListViewPrinter/            ListView printing support (Class Library)
+-- External/
|   +-- DotNetCommonUtils/
|       +-- CommonUtils/        Shared utility library (Class Library, .NET 4.5)
|       +-- CommonUtilsTests/   Unit tests for CommonUtils
+-- Notes/                      Architecture notes (HTML)
+-- packages/                   NuGet package cache
```

## Layer Architecture

```
+----------------------------------------------------------+
|                    USER INTERFACES                         |
|  +------------------+  +------------+  +---------------+  |
|  |   MoneyAI.JS     |  |  WinForms  |  |     WPF       |  |
|  |  (Web SPA)       |  |  (Desktop) |  |   (Desktop)   |  |
|  |  Knockout/AMD    |  |  ObjListVw |  |   (Stub)      |  |
|  +--------+---------+  +------+-----+  +-------+-------+  |
|           |                   |                |           |
+----------------------------------------------------------+
            |                   |                |
+-----------v-------------------v----------------v-----------+
|                    WEB API LAYER                            |
|  +-------------------------------------------------------+ |
|  |  MoneyAI.WebApi (ASP.NET Web API 5.0)                 | |
|  |  - TransactionsController (GET /api/transactions)     | |
|  |  - TransactionEditsController (POST /api/edits)       | |
|  |  - TransactionCache (in-memory + file watcher)        | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
            |
+-----------v------------------------------------------------+
|                 DATA ACCESS LAYER                           |
|  +-------------------------------------------------------+ |
|  |  MoneyAI.Repositories                                 | |
|  |  - FileRepository (JSON file-based storage)           | |
|  |  - TransactionsStorage / TransactionEditsStorage      | |
|  |  - Statement Parsers (Amex, PayPal, Amazon, etc.)     | |
|  |  - File Format Parsers (CSV, JSON, IIF)               | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
            |
+-----------v------------------------------------------------+
|                    CORE DOMAIN                              |
|  +-------------------------------------------------------+ |
|  |  MoneyAI                                              | |
|  |  - Transaction (immutable entity)                     | |
|  |  - Transactions (collection + merge logic)            | |
|  |  - TransactionEdit / TransactionEdits (edit system)   | |
|  |  - AccountInfo / AccountConfig                        | |
|  |  - ImportInfo / AuditInfo                             | |
|  |  - Parent-Child Matchers                              | |
|  |  - Entity Name Normalizer                             | |
|  |  - Transaction Aggregates                             | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
            |
+-----------v------------------------------------------------+
|                   SHARED UTILITIES                          |
|  +-------------------------------------------------------+ |
|  |  CommonUtils (External/DotNetCommonUtils)             | |
|  |  - JsonSerializer<T>                                  | |
|  |  - CsvParser / TsvReader                              | |
|  |  - Hasher / CompactID                                 | |
|  |  - CloudStorage (Dropbox integration)                 | |
|  |  - QuickbooksIifParser                                | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
            |
+-----------v------------------------------------------------+
|                    FILE SYSTEM                              |
|  Statements/   - Raw imported CSV/JSON/IIF files           |
|  Merged/       - LatestMerged.json, LatestMergedEdits.json |
|  AccountConfig.json - Per-account configuration            |
+------------------------------------------------------------+
```

## Key Design Patterns

### Immutability Pattern
Transactions are immutable once created. All modifications are captured as `TransactionEdit` objects, maintaining a complete audit trail. Edits are stored separately from source data and can be voided (reverted). This enables:
- Lossless data preservation
- Full reconstruction from source files + edits
- Safe sharing of edit rules between users

### Content Hashing for Deduplication
Every transaction gets an MD5 content hash computed from: `AccountId | TransactionReason | Amount | EntityName | PostedDate | TransactionDate | InstituteReference`. When merging imports, transactions with matching content hashes are deduplicated rather than duplicated.

### Scope-Based Edit System
Edits use `ScopeFilter` objects to define which transactions they affect. This enables:
- **Single transaction edits**: Scope by transaction ID
- **Bulk categorization**: Scope by entity name (all "AMAZON" transactions get category "Shopping")
- **Pattern matching**: Scope by name tokens (any transaction containing "GROCERY")
- **Conditional edits**: Scope by account, amount range, or transaction reason

### Plugin Architecture
- **Statement Parsers**: `StatementParserBase` with institution-specific implementations (AmexParser, PayPalParser, etc.)
- **File Format Parsers**: `IFileFormatParser` with CSV, JSON, and IIF implementations
- **Parent-Child Matchers**: `IParentChildMatch` interface with Amazon, Etsy, and generic implementations

### Repository Abstraction
`IRepository` and `IStorage<T>` interfaces abstract data access. Current implementation is `FileRepository` (JSON files on local filesystem), but the architecture supports alternative backends.

### MVVM on Web
The JavaScript frontend uses Knockout.js for MVVM data binding, RequireJS for AMD module loading, and Handlebars for templating. Client-side models mirror the C# domain objects (Transaction, TransactionEdit, Transactions, EditedValues).

## Data Flow

### Import Flow
```
Raw Files (CSV/JSON/IIF)
    |
    v
StatementParser (institution-specific)
    |
    v
Transaction objects (with content hashes)
    |
    v
Transactions.Merge() -- deduplication via content hash
    |
    v
Parent-Child Matching (Amazon/Etsy order reconciliation)
    |
    v
Inter-Account Transfer Matching (by amount + date proximity)
    |
    v
LatestMerged.json (serialized to filesystem)
```

### Edit Flow
```
User Action (categorize, flag, note, fix error)
    |
    v
TransactionEdit created (with ScopeFilters + EditedValues)
    |
    v
Applied to all matching transactions in-memory
    |
    v
Saved to LatestMergedEdits.json (with timestamped backup)
    |
    v
POST /api/transactionedits (Web UI sends to API)
    |
    v
TransactionCache invalidated, reloaded on next GET
```

### Display Flow
```
GET /api/transactions
    |
    v
TransactionCache (lazy-loaded, file-watcher refresh)
    |
    v
JSON serialized to client
    |
    v
Transactions.js (client-side model construction)
    |
    v
NetAggregator (hierarchical grouping: Income/Expense/Transfers)
    |
    v
TxListView (Handlebars rendering with Knockout bindings)
```

## File Storage Layout

```
[DropBox Folder]/MoneyAI/
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
    +-- NamedLocations.json       (file path mapping)
    +-- *.backup.json             (timestamped backups)
```

## Concurrency and Caching

### Web API Cache (TransactionCache)
- Per-user `Lazy<T>` initialization with thread-safe double-check locking
- FileSystemWatcher monitors for external file changes
- 5-second debounce on file change to avoid reload storms
- Lock-based synchronization for concurrent read/write access
- Cache invalidation on edit save

### Client-Side Caching
- Transaction corrected values memoized after first computation
- Aggregator expand/collapse state preserved in static map across refreshes
- Repository caches API response until explicit invalidation
