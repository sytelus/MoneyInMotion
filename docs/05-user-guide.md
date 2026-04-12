# MoneyInMotion - User Guide

## Getting Started

When you first open MoneyInMotion, you'll see the **Getting Started** guide at `/welcome`. It walks you through four steps:

1. **Configure Data Folder** -- Choose where MoneyInMotion stores your financial data (default: `~/.moneyinmotion/data`). The app creates `Statements/` and `Merged/` subfolders automatically.
2. **Add Accounts** -- Create accounts for each bank, credit card, or payment service.
3. **Add Statement Files** -- Download CSV/JSON/IIF files from your bank and upload them from the Accounts page, or place them in the account folders manually.
4. **Import & Explore** -- Click Import to scan for new files. The app deduplicates automatically, so re-importing is safe.

You can also reach the setup guide anytime by navigating to `/welcome` or clicking the link in the empty-state message.

### Setting Up Your Data Directory

1. Choose a location for your financial data (default: `~/.moneyinmotion/data`)
2. The application creates `Statements/` and `Merged/` subfolders automatically
3. Optionally, set a custom data path via the `MONEYAI_DATA_PATH` environment variable or the Settings page in the web UI

### Adding an Account

For each bank account or credit card:

1. Create a subfolder under `Statements/` named with a unique identifier (e.g., `chase-checking`, `amex-platinum`)
2. Create an `AccountConfig.json` file in that folder:
   ```json
   {
     "accountInfo": {
       "type": 1,
       "id": "amex-platinum",
       "title": "Amex Platinum Card",
       "instituteName": "AmericanExpress",
       "requiresParent": false,
       "interAccountNameTags": ["payment", "transfer"]
     },
     "fileFilters": ["*.csv"],
     "scanSubFolders": false
   }
   ```
3. Set the `type` based on account type:
   - `1` = Credit Card
   - `2` = Checking Account
   - `4` = Savings Account
   - `5` = Order History (Amazon, Etsy)
   - `6` = Electronic Payment (PayPal)
4. Set `instituteName` to match a supported parser (see below)

### Supported Institution Names

| Institution Name | Format | Description |
|-----------------|--------|-------------|
| `AmericanExpress` | CSV | American Express statements |
| `BarclayBank` | CSV | Barclaycard statements |
| `PayPal` | CSV/IIF | PayPal transaction history |
| `Amazon` | CSV | Amazon order history export |
| `Etsy` | JSON | Etsy buyer order history |
| (any other) | CSV | Generic CSV parser with auto-column detection |

### Importing Statements

1. Download statement files from your bank/credit card website
2. Upload the CSV/JSON/IIF files from the relevant account card on the **Accounts** page, or place them in the appropriate account folder under `Statements/`
3. Click the **Import** button in the top navigation bar
4. The application scans for new files, parses them, deduplicates, and merges
5. Click **Save** to persist the merged data to disk

---

## Using the Web Interface

### Starting the Application

```bash
cd MoneyInMotion
./run.sh              # dev mode -- http://localhost:5173
```

Or for a leaner production run (single port, minified assets):

```bash
./build.sh
./run.sh prod         # prod mode -- http://localhost:3001
```

Open the URL shown in the terminal. See
[Install and Build](04-install-and-build.md#dev-vs-production--whats-different)
for a detailed comparison of the two modes.

### Layout

The web interface uses a three-column layout:

- **Left sidebar** (hidden on small screens): Year/month navigation accordion
- **Center panel**: Transaction list with hierarchical grouping
- **Right sidebar** (hidden on medium and small screens): Transaction summary and details

The top navigation bar provides:
- **MoneyInMotion** title link (returns to main view)
- **Import** button: Scan and import new statement files
- **Save** button: Persist current data to disk
- **Accounts** link: Navigate to account management page
- **Rules** link: Review saved edit rules and revert them safely
- **Settings** link: Navigate to application settings page

### Navigating Transactions

1. Click a year in the left sidebar to expand its months
2. Click a month to filter transactions to that period
3. Transactions are grouped hierarchically:
   - **Income**: Paychecks, refunds, interest, credits
   - **Expenses**: Purchases, fees, ATM withdrawals
   - **Transfers**: Inter-account payments and transfers
   - **Unmatched**: Orphaned order items awaiting reconciliation

### Expanding and Collapsing Groups

- Click a group header to toggle its expanded/collapsed state
- Use **Right Arrow** key to expand the selected group
- Use **Left Arrow** key to collapse
- Use **Alt + Right Arrow** to expand all nested levels

### Selecting Transactions

- Click a transaction row to select it
- Use **Up/Down Arrow** keys to navigate between rows
- The right sidebar updates to show details and aggregates for the selection

---

## Editing Transactions

### Categorizing Transactions

1. Select a transaction or group
2. Press **Alt+T** or use the action menu
3. Type a category path (e.g., "Shopping > Electronics")
   - Autocomplete suggests existing categories
4. Configure scope options (which transactions to apply the category to):
   - **Apply to all similar names**: Applies to all transactions with the same normalized entity name
   - **Apply only for this account**: Limits to the current account
   - **Apply only for this amount range**: Limits to similar amounts
5. Confirm the edit
6. If multiple transactions are affected, a confirmation shows the count

### Adding Notes

1. Select a transaction
2. Press **Alt+N** or use the action menu
3. Enter your note text
4. Confirm (note is applied only to the selected transaction)

### Flagging Transactions

1. Select a transaction
2. Press **Alt+F** to toggle flag, or **Alt+Shift+F** to remove flag
3. Flagged transactions show a flag indicator in the list

### Fixing Transaction Attributes

1. Select a transaction
2. Press **Alt+E** or use the action menu
3. You can change:
   - **Transaction Reason** (e.g., change Purchase to Fee)
   - **Entity Name** (correct the merchant name)
   - **Amount** (fix incorrect amounts)
4. Configure scope options for bulk application
5. Confirm changes

### Managing Rules and History

Navigate to the Rules page via the **Rules** button in the top navigation bar.

The Rules page allows you to:
- Review every persisted edit rule in one place
- See the scope filters that determine which transactions a rule matches
- Preview the transactions currently affected by that rule
- Revert a rule safely without deleting audit history

Reverting from this page does **not** delete the original edit. Instead, MoneyInMotion appends a new voiding edit that restores the affected fields to their imported values while preserving the original rule in the history log.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Up Arrow | Select previous transaction |
| Down Arrow | Select next transaction |
| Left Arrow | Collapse selected group |
| Right Arrow | Expand selected group |
| Alt + Right Arrow | Expand all nested levels |
| Alt + N | Edit note on selected transaction |
| Alt + T | Edit category on selected transaction |
| Alt + E | Fix attributes on selected transaction |
| Alt + F | Toggle flag on selected transaction |
| Alt + Shift + F | Remove flag from selected transaction |
| Escape | Close popover or modal |
| ? | Show keyboard shortcuts help |

---

## Account Management

Navigate to the Accounts page via the **Accounts** button in the top navigation bar.

The Accounts page allows you to:
- View all configured accounts (discovered from `AccountConfig.json` files)
- Create new accounts (which creates the folder and `AccountConfig.json` file)
- Edit existing account settings, including file filters and match tags
- Delete an account configuration without deleting raw statement files
- Upload raw statement files directly into the correct account folder
- See per-account import status (transaction count and latest import timestamp)

When creating or editing an account, pay attention to **Match Tags** (`interAccountNameTags`). These are the name fragments MoneyInMotion uses to:
- Match inter-account transfers
- Match Amazon/Etsy order-history entries to the real credit-card charge

Deleting an account removes only `AccountConfig.json`. Previously imported transactions remain in merged data, and the original statement files are left on disk.

---

## Settings

Navigate to the Settings page via the **Settings** button in the top navigation bar.

The Settings page allows you to:
- View the current data directory path
- Change the data directory path (updates `~/.moneyinmotion/config.json`)
- View and change the server port

Both the data-path change and port change take effect only after restarting the server.

---

## Understanding the Display

### Transaction Row Information

Each transaction row shows:
- **Entity Name**: Merchant or payee (normalized for readability)
- **Amount**: Transaction amount (color-coded: red for expenses, green for income)
- **Reason**: Transaction type (Purchase, Fee, Return, etc.)
- **Date**: Transaction date
- **Account**: Account identifier

### Group Summary Information

Each group header shows:
- **Total Amount**: Sum of all transactions in the group
- **Transaction Count**: Number of transactions
- **Category**: Category assignments if present
- **Indicators**: Flag and note icons when applicable

### Special Indicators
- **Flag icon**: Transaction has been flagged for attention
- **Note icon**: Transaction has a note attached
- **Red amount**: Negative (outgoing) transaction
- **Green amount**: Positive (incoming) transaction

---

## Data Management

### Where Data Is Stored

- **Raw Statements**: `Statements/[AccountId]/` -- Never modified by the application
- **Merged Data**: `Merged/LatestMerged.json` -- All transactions merged into one file
- **User Edits**: `Merged/LatestMergedEdits.json` -- All categorizations, notes, flags
- **Backups**: `Merged/*.backup.json` -- Timestamped copies before each save
- **App Config**: `~/.moneyinmotion/config.json` -- Server configuration (data path, port)

### Sharing Edit Rules

Since edits are stored separately as JSON:
1. Export `LatestMergedEdits.json`
2. Share with another user
3. They can import and apply your categorization rules to their own data

### Reconstructing Data

To rebuild from scratch:
1. Delete `Merged/LatestMerged.json`
2. Keep `Merged/LatestMergedEdits.json` (your categorization rules)
3. Open the application and click **Import** -- it will re-import all statements and re-apply edits
