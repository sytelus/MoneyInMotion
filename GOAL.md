# MoneyInMotion (MoneyAI)

MoneyInMotion (also referred to as MiM or MoneyAI) is a web app for doing personal finance. The idea is that user can download statements from their bank, credit card and other websites, upload this folder to MiM and MiM figures out everything that user might want to know with least amount of interaction and time investment from user's part.

MiM absolutely tolerates various types of mistakes user might make or user being lazy or forgetful. It also absolutely robust against imperfect or limited data that financial institutions provides. This is the most important and defining aspect of MiM.

So let's start with what kind of mistakes users might possibly make? As an example, user may upload same statement files multiple times or same transactions but in differently named files. Or may be user might upload two files with overlapping transactions. Or user may forget uploading one of his account entirely. Or the bank statements have limited information on transactions or may be names payee are cut-off sometimes or may be transaction day is off by 2 days because of a long weekend.

Typical bank or credit card financial statements are messy. For example, there may be a transfer from checking to savings account but a naive software may interpret it as income and expense. Or there may be refund after a few day or may be in next statement. MiM needs to handle all of these so users don't need to do continuous cleaning. MiM will identify such mess as automatically as possible but may sometime require user interaction and then it will learn from them so as not to require intervention again if possible.

MiM's goal is to present all information typical user may want to know from analysis and aggregation of all data user has provided so far. What user may want to know? They may want to know, for example, how their money is spent? Why expenses for this month is too high? What were the anomalies this year? How is the expense trend looking like? Are there any fraudulent charges? Are there any fees that are being charged silently? How their cash in-flow looks like? How is it changing over time? Is there any charge user should pay attention to? What are the businesses user is dealing frequently? And so on.

All of these information should be presented so that user can gradually drill down from high level breakdown to low level details. MiM should automatically assist user by putting up comparisons and trends so user can understand what is doing on effortlessly. The drilldown capabilities should be provided everywhere that can be. Furthermore, MiM should automatically point out issues, reg flags, lack of information so we can save user's time from having to dig deeper. MiM should provide editing capabilities to fix issues in fastest possible way. The prime directive of MiM is to free up user's time as much as possible while providing robust, accurate, effective and all critical information that user should have and requiring minimum interventions at all times. Some examples of user interface features may include:

- Hierarchical Grouping: Income / Expenses / Transfers with entity and category sub-groups
- Monthly/Yearly Navigation: Browse transactions by time period
- Net Income Calculation: Automatic savings/deficit calculation
- Transaction Aggregates: Counts, positive/negative totals, grouped by reason
- Flagging and Notes: Mark transactions for follow-up with notes and flags
- Web-Based Account Management: Configure accounts through the browser
- Web-Based Settings: Configure data paths and application settings through the browser

To achieve above, MiM needs few capabilities. The primary one to categorize transactions into buckets. Next important one is to connect various transactions such as transfers, credit card payment from checking account to credit card account, refunds and so on. The next important capability is to make credit card transactions less opaque. For example, expense on Amazon doesn't disclose much unless we can connect that expense to amazon order so user can know exactly what purchase the money was spent. This purchase then can be categorize as usual like clothing, grocery etc.

Over more longer term, MiM should also provide suggestions and advice, for example, let's slow down on eating out. Or may be you are spending too much on grocery that seems way above usual. Or there are discounts at this business if you had used this credit card. These are longer term goal but need not be implemented now but we should keep them in mind so architecture and UX can absorb them in future more easily.

Few other core principles that MiM will always follow:

- MiM can run locally so user's data never leaves their computer. There will also be web version of MiM.
- MiM never modifies input data in any way.
- All output data from MiM is stored as JSON files.
- MiM important transaction data from many heterogeneous sources (bank CSVs, credit card exports, PayPal, Amazon order history, Etsy, QuickBooks IIF) into a single unified view.
- MiM allows 3 levels to categorize transactions, each subsequent level able to override previous ones: automatic, rule based and manual edits. For example, MiM can apply categories to all matching transactions at once for given scope. MiM will provide great UX to maintain these rules as well as perform individual or batch edits. MiM should provide maximum flexibility so user can get work done in minimum time. Example of these capabilities may include:
  - Scope Filters: Apply edits to transactions matching criteria (entity name, account, amount range, transaction type)
  - Word based matching: Match by any/all words in entity name
  - Bulk Operations: Single edit can affect hundreds of matching transactions
  - Edit Voiding: Ability to revert edits back to original values
  - Edit History: Full audit trail of who changed what and when
- Never alter original source data. All modifications are stored as separate edit files, maintaining a full immutable audit trail that includes timestamps.
- Be able to reconstruct all outputs at any time from original source files plus edits.
- Automatically detect and merge duplicate transactions imported from overlapping sources using smart techniques such as content hashing.
- Match parent-child relationships (e.g., Amazon order may have multiple items to a single credit card charge) and identify inter-account transfers.
- Provide instant hierarchical summaries of income, expenses, fees and transfers grouped by entity, category, time period, and transaction type.
- MiM makes importing transactions as easy as possible. It automatically identifies institution and account from file name. It can import  following types of data:
  - Bank Statements: Generic CSV parser with auto-column detection
  - American Express: Specialized CSV parser with phone/category extraction
  - Barclaycard: CSV parser with banner line handling
  - PayPal: CSV and IIF (QuickBooks Interchange) format support with timezone handling
  - Amazon Order History: CSV parser matching order items to credit card charges
  - Etsy Buyer History: JSON format parser for Etsy purchase reconciliation
  - QuickBooks IIF: Standard accounting interchange format
  - Generic JSON: Array-of-objects format support
- MiM should perform Entity Name Normalization, automatic cleanup and standardization of merchant names
- MiM should support transaction splitting, line-item breakdowns of orders.
- MiM should allow tolerance as real world is not perfect, for example, ability configure time window in which transactions can be matched or small amount adjustments that can be made via edits for imperfect matches. For such adjustments, MiM may automatically create synthetic adjustment entries for rounding differences
