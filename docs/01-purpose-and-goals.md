# MoneyInMotion (MoneyAI) - Purpose, Goals, and Features

## Purpose

MoneyInMotion (also referred to as MoneyAI) is a personal finance management application that aggregates financial transactions from multiple sources (banks, credit cards, payment services, and online retailers), then provides tools to categorize, edit, analyze, and track spending and income. The tagline is "Personal Finance with Smarts."

The application is designed for power users who want full control over their financial data without relying on third-party cloud services. All data remains local, stored as JSON files on the user's filesystem (optionally synced via any cloud storage provider such as Dropbox or OneDrive).

The application is built as a TypeScript monorepo with a React frontend, Express API server, and a shared core domain library. It runs entirely on Node.js and can be launched from any platform that supports it.

## Core Goals

1. **Aggregate**: Import transaction data from many heterogeneous sources (bank CSVs, credit card exports, PayPal, Amazon order history, Etsy, QuickBooks IIF) into a single unified view.
2. **Categorize**: Allow rule-based and manual categorization of transactions, with intelligent scope filters that can apply a category to all matching transactions at once.
3. **Preserve**: Never alter original source data. All modifications are stored as separate edit files, maintaining a full audit trail.
4. **Reconstruct**: Be able to reconstruct all outputs at any time from original source files plus edits.
5. **Deduplicate**: Automatically detect and merge duplicate transactions imported from overlapping sources using content hashing.
6. **Reconcile**: Match parent-child relationships (e.g., Amazon order items to credit card charges) and identify inter-account transfers.
7. **Analyze**: Provide hierarchical summaries of income, expenses, and transfers grouped by entity, category, time period, and transaction type.

## Key Features

### Multi-Source Import
- **Bank Statements**: Generic CSV parser with auto-column detection
- **American Express**: Specialized CSV parser with phone/category extraction
- **Barclaycard**: CSV parser with banner line handling
- **PayPal**: CSV and IIF (QuickBooks Interchange) format support with timezone handling
- **Amazon Order History**: CSV parser matching order items to credit card charges
- **Etsy Buyer History**: JSON format parser for Etsy purchase reconciliation
- **QuickBooks IIF**: Standard accounting interchange format
- **Generic JSON**: Array-of-objects format support

### Transaction Management
- **Immutable Transactions**: Original transaction data is never modified
- **Non-Destructive Editing**: All changes stored as edit objects with full audit trail
- **Content Hash Deduplication**: MD5-based content hashing prevents duplicate imports
- **Entity Name Normalization**: Automatic cleanup and standardization of merchant names
- **Transaction Splitting**: Support for line-item breakdowns of orders

### Rule-Based Editing
- **Scope Filters**: Apply edits to transactions matching criteria (entity name, account, amount range, transaction type)
- **Token Matching**: Match by any/all words in entity name
- **Bulk Operations**: Single edit can affect hundreds of matching transactions
- **Edit Voiding**: Ability to revert edits back to original values
- **Edit History**: Full audit trail of who changed what and when

### Transaction Reconciliation
- **Parent-Child Matching**: Automatically links order line items to parent transactions
- **Inter-Account Transfer Detection**: Matches transfers across accounts by amount and date proximity
- **Tolerance Handling**: Configurable date windows and small amount adjustments for imperfect matches
- **Adjustment Transactions**: Automatically creates synthetic adjustment entries for rounding differences

### Analysis and Reporting
- **Hierarchical Grouping**: Income / Expenses / Transfers with entity and category sub-groups
- **Monthly/Yearly Navigation**: Browse transactions by time period
- **Net Income Calculation**: Automatic savings/deficit calculation
- **Transaction Aggregates**: Counts, positive/negative totals, grouped by reason
- **Flagging and Notes**: Mark transactions for follow-up with notes and flags

### User Interface
- **React Web UI**: Single-page application with three-column layout, Radix UI components, keyboard shortcuts, and Tailwind CSS styling
- **REST API**: Express server providing transaction data and accepting edits
- **Web-Based Account Management**: Configure accounts through the browser
- **Web-Based Settings**: Configure data paths and application settings through the browser

### Data Storage
- **File-Based Repository**: JSON files stored locally on filesystem
- **Cloud Sync Compatible**: Default storage location supports syncing via any cloud storage provider
- **No Database Required**: Entirely file-based persistence
- **Backup on Save**: Timestamped backups created when saving edits
