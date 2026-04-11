# MoneyInMotion (MoneyAI)

**Personal Finance with Smarts** - A comprehensive personal finance management application that aggregates transactions from multiple banks, credit cards, and online services into a unified view with intelligent categorization and analysis.

## Why MoneyInMotion?

- **Your data stays yours** - All data stored locally as JSON files, no cloud dependency
- **Multi-source aggregation** - Import from banks, credit cards, PayPal, Amazon, Etsy, and more
- **Intelligent matching** - Automatically links Amazon order items to credit card charges, detects inter-account transfers
- **Non-destructive editing** - Original data is never modified; all changes stored as revertible edit rules
- **Rule-based categorization** - Categorize one transaction and automatically apply to all similar ones
- **Full audit trail** - Every change is tracked with who, what, and when

## Quick Start

### Prerequisites
- Visual Studio 2013+ (with .NET 4.5 support)
- Node.js (16 LTS recommended)
- Git

### Build

```bash
# Clone the repository
git clone https://github.com/sytelus/MoneyInMotion.git
cd MoneyInMotion

# Initialize submodules
git submodule update --init --recursive

# Restore .NET packages and build
nuget restore MoneyAI.sln
msbuild MoneyAI.sln /p:Configuration=Release

# Build JavaScript frontend
cd MoneyAI.JS
npm install
npx bower install
npx grunt build
```

Or open `MoneyAI.sln` in Visual Studio, restore NuGet packages, and build (Ctrl+Shift+B).

### Set Up Data

1. Create a data directory (default: `[Dropbox]/MoneyAI/Statements/`)
2. For each bank account or credit card, create a folder with an `AccountConfig.json`:
   ```json
   {
     "accountInfo": {
       "type": 2,
       "id": "my-checking",
       "title": "My Checking Account",
       "instituteName": "Generic"
     },
     "fileFilters": ["*.csv"]
   }
   ```
3. Drop your bank CSV export files into the account folder
4. Run the application - it auto-imports and deduplicates

Account types: `1` = Credit Card, `2` = Checking, `4` = Savings, `5` = Order History, `6` = E-Payment (PayPal)

### Run

- **Web UI**: Set `MoneyAI.WebApi` as startup project in Visual Studio, press F5
- **Desktop**: Set `MoneyAI.WinForms` as startup project, press F5

## Features

### Supported Import Sources

| Source | Format | Special Features |
|--------|--------|---------|
| Generic Banks | CSV | Auto-column detection |
| American Express | CSV | Phone/category extraction |
| Barclaycard | CSV | Banner line handling |
| PayPal | CSV/IIF | Timezone-aware, activity filtering |
| Amazon Orders | CSV | Order-to-charge matching |
| Etsy Orders | JSON | Receipt reconciliation |
| QuickBooks | IIF | Standard interchange format |

### Transaction Management

- **Categorize**: Hierarchical categories (e.g., "Food > Groceries > Organic")
- **Flag**: Mark transactions for follow-up
- **Note**: Add free-text annotations
- **Fix**: Correct merchant names, amounts, or transaction types
- **Scope Rules**: Apply edits to all matching transactions at once (by entity name, account, amount range, etc.)
- **Deduplication**: Content hashing prevents duplicate imports from overlapping sources

### Intelligent Matching

- **Parent-Child**: Links Amazon/Etsy order line items to corresponding credit card charges
- **Inter-Account Transfers**: Matches debits and credits across accounts by amount and date proximity
- **Entity Normalization**: Cleans up messy bank entity names for consistent grouping

### Analysis

- Monthly/yearly navigation with hierarchical grouping (Income / Expenses / Transfers)
- Category-level spending summaries
- Net income (savings/deficit) calculation
- Date range transaction highlighting
- Transaction aggregation with flag and note indicators

### Keyboard Shortcuts (Web UI)

| Key | Action |
|-----|--------|
| Up/Down Arrow | Navigate transaction rows |
| Left/Right Arrow | Collapse/Expand groups |
| Alt + Right Arrow | Expand all nested levels |
| Alt + T | Edit category |
| Alt + N | Edit note |
| Alt + E | Fix transaction attributes |
| Alt + F | Toggle flag |
| Alt + Shift + F | Remove flag |

## Architecture

```
MoneyAI             Core domain (transactions, edits, matching logic)
MoneyAI.Repositories File-based data access, statement parsers (CSV/JSON/IIF)
MoneyAI.WebApi      REST API server (ASP.NET Web API 5.0)
MoneyAI.JS          Web frontend SPA (Knockout.js + RequireJS + Bootstrap 3)
MoneyAI.WinForms    Windows desktop client (ObjectListView grid)
CommonUtils         Shared utilities (JSON serialization, CSV parsing, hashing)
```

**Design Principles:**
- Original source files are never altered
- All changes stored as separate, revertible edit rules
- Full audit trail on every modification
- Data can be reconstructed from source files + edits at any time

## Documentation

| Document | Description |
|----------|-------------|
| [Purpose and Goals](docs/01-purpose-and-goals.md) | Project motivation, goals, and feature overview |
| [Architecture](docs/02-architecture.md) | System design, layer diagram, and data flow |
| [How It Works](docs/03-how-it-works.md) | Detailed walkthrough of import, matching, editing, and display |
| [Install and Build](docs/04-install-and-build.md) | Prerequisites, build steps, and full dependency listing |
| [User Guide](docs/05-user-guide.md) | End-user guide for web and desktop interfaces |
| [TODO Items](docs/06-todo.md) | Prioritized list of bugs, features, and technical debt |
| [Business Rules](docs/07-rules.md) | Comprehensive catalog of all business rules in the system |

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | .NET Framework | 4.5 |
| API | ASP.NET Web API | 5.0 |
| Frontend | Knockout.js + RequireJS | - |
| UI Framework | Bootstrap | 3.x |
| Build Tools | Grunt + Bower | 0.4.x |
| Serialization | Newtonsoft.Json | 5.0.8 |
| Storage | JSON files | Local filesystem |

## Author

Shital Shah ([@sytelus](https://github.com/sytelus))
