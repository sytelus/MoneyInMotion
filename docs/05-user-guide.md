# MoneyInMotion - User Guide

## Getting Started

### Setting Up Your Data Directory
1. Create a folder for your financial data (default: `[Dropbox]/MoneyAI/`)
2. Inside, create two subfolders:
   - `Statements/` - for raw bank/credit card exports
   - `Merged/` - the application creates this automatically for processed data

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
2. Place the CSV/JSON/IIF files in the appropriate account folder
3. Launch the application
4. The application will automatically scan and import new statement files

---

## Using the Web Interface

### Layout
The web interface has three main panels:
- **Left Panel**: Year/Month navigation
- **Center Panel**: Transaction list with grouping
- **Right Panel**: Transaction summary and details

### Navigating Transactions
1. Click a year in the left panel to expand its months
2. Click a month to filter transactions to that period
3. Transactions are grouped hierarchically:
   - **Income**: Paychecks, refunds, interest, credits
   - **Expenses**: Purchases, fees, ATM withdrawals
   - **Transfers**: Inter-account payments and transfers
   - **Unmatched**: Orphaned order items awaiting reconciliation

### Expanding and Collapsing Groups
- Click the **+** button to expand a group and see its transactions
- Click the **-** button to collapse a group
- Use **Right Arrow** key to expand the selected group
- Use **Left Arrow** key to collapse
- Use **Alt + Right Arrow** to expand all nested levels

### Selecting Transactions
- Click a transaction row to select it
- Use **Up/Down Arrow** keys to navigate between rows
- The right panel updates to show details of the selected transaction

### Editing Transactions

#### Categorizing Transactions
1. Select a transaction or group
2. Click the dropdown menu (or press **Alt+T**)
3. Select "Edit Category"
4. Type a category path (e.g., "Shopping > Electronics")
   - The autocomplete will suggest existing categories
5. Configure scope options (which transactions to apply the category to):
   - **Apply to all similar names**: Applies to all transactions with the same normalized entity name
   - **Apply only for this account**: Limits to current account
   - **Apply only for this amount range**: Limits to similar amounts
6. Click OK
7. If multiple transactions are affected, a confirmation dialog shows the count
8. Review affected transactions if desired, then confirm

#### Adding Notes
1. Select a transaction
2. Press **Alt+N** or use the dropdown menu -> "Edit Note"
3. Enter your note text
4. Click OK (note is applied only to the selected transaction)

#### Flagging Transactions
1. Select a transaction
2. Press **Alt+F** to toggle flag, or **Alt+Shift+F** to remove flag
3. Flagged transactions show a flag icon in the list

#### Fixing Transaction Attributes
1. Select a transaction
2. Press **Alt+E** or use the dropdown menu -> "Fix Attribute Errors"
3. You can change:
   - **Transaction Reason** (e.g., change Purchase to Fee)
   - **Entity Name** (correct the merchant name)
   - **Amount** (fix incorrect amounts)
4. Configure scope options for bulk application
5. Confirm changes

### Marking Transactions by Date Range
1. Click "Mark Transactions" in the right panel
2. Enter a start date and end date
3. Matching transactions are highlighted in blue italic
4. Marked transaction totals appear separately in group summaries

### Keyboard Shortcuts
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
| Alt + S | Confirm save in modal dialogs |

---

## Using the Windows Forms Client

### Main Window Layout
- **Menu Bar**: File, Edit, View, Tools
- **Left Panel**: Category tree view
- **Center Panel**: Transaction list (ObjectListView grid)
- **Bottom Panel**: Log/status messages

### Key Operations
1. **Add Account**: Menu -> Add Account -> Fill in account details
2. **Scan Statements**: Menu -> Scan Statements -> Select folder to scan
3. **View Transactions**: Click categories in tree view to filter
4. **Edit Transaction**: Double-click a transaction or right-click for context menu
5. **Print**: File -> Print to print the current transaction list

---

## Understanding the Display

### Transaction Row Information
Each transaction row shows:
- **Entity Name**: Merchant or payee (normalized)
- **Amount**: Transaction amount (red if negative/expense)
- **Reason**: Transaction type (Purchase, Fee, Return, etc.)
- **Date**: Transaction date
- **Account**: First 5 characters of account ID

### Group Summary Information
Each group header shows:
- **Total Amount**: Sum of all transactions in the group
- **Transaction Types**: Count of each transaction reason type
- **Accounts**: Which accounts are represented
- **Categories**: Category assignments
- **Indicators**: Flag and note icons

### Special Indicators
- **Flag icon**: Transaction has been flagged for attention
- **Note icon**: Transaction has a note attached
- **Blue italic**: Transaction is within the marked date range
- **Red amount**: Negative (outgoing) transaction

---

## Data Management

### Where Data Is Stored
- **Raw Statements**: `Statements/[AccountId]/` - Never modified by the application
- **Merged Data**: `Merged/LatestMerged.json` - All transactions merged into one file
- **User Edits**: `Merged/LatestMergedEdits.json` - All categorizations, notes, flags
- **Backups**: `Merged/*.backup.json` - Timestamped copies before each save

### Sharing Edit Rules
Since edits are stored separately as JSON:
1. Export `LatestMergedEdits.json`
2. Share with another user
3. They can import and apply your categorization rules to their own data

### Reconstructing Data
To rebuild from scratch:
1. Delete `Merged/LatestMerged.json`
2. Keep `Merged/LatestMergedEdits.json` (your categorization rules)
3. Run the application - it will re-import all statements and re-apply edits
