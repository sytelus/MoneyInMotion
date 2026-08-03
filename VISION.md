# MoneyInMotion (MoneyAI)

MoneyInMotion (also referred to as MiM or MoneyAI) is a web app for the personal finance. The idea is that user can download statements from their various banks, credit card accounts and other such websites in some root folder and then point the app to that root folder. MiM then figures out everything that user might want to know about their personal finance effortlessly, reliably and accurately.

MiM absolutely tolerates various types of mistakes user might make allowing user to be lazy and forgetful while pointing them out. It also is robust against imperfect or limited data that financial institutions may provide. Furthermore, MiM tries to minimize effort from user by remembering various choices and being smart about it while also pointing them out so user is not in the dark. The goal of MiM to connect information from various accounts and through timeline so user can know the actual net cause and effect of various chain of transactions. For example, a deposit in the checking account may merely the transfer from savings account. Similarly, instead of showing there is charge from amazon.com for $52, it can connect to Amazon purchase history and show what exactly that charge was for. Another example is refunds down the line so user knows there was net no expense or can be informed that refund didn't actually got the user full money back and so on. This is the most important and defining aspect of MiM.

So let's start with some examples of mistakes or laziness users might possibly display. User may upload same statement files or same transactions multiple times or even in different formats and possibly in differently named files. Or perhaps user may upload two files with overlapping transactions. Or perhaps user may forget uploading one of their account entirely. Or the bank statements have limited information on transactions or may be names payee are cut-off due to limitations at bank side or may be transaction day is off by 2 days because of a long weekend.

Typical bank or credit card financial statements are messy. For example, there may be a transfer from checking to savings account but a naive software may interpret it as income and expense. Or there may be refund after a few day or may be in the next statement. MiM needs to handle all of these so users don't need to do continuous cleaning by themselves. MiM will identify such mess as automatically as possible but may sometime require user interaction or attention or informational message and then it will learn from them so as not to require the intervention again when possible.

MiM's goal is to present all information typical user may want to know from analysis and aggregation of all data user has provided so far. MiM's goal is provide as much information as possible while providing full causal information on that information so user may verify its truthfulness by UX methods such as drill down, hierarchical display, linking and so on. User may want to know, for example, how their money is spent last week or last month or some custom time period? Why expenses for this month is too high than normal? What were the anomalies? How is the expense trend looking like? Are there any fraudulent charges? Are there any fees that are being charged? What are the subscriptions or recurring expenses? How some expenses are going up (such as gas prices or some restaurant bill etc)? How their cash in-flow and outflow looks like? How is it changing over time? Is there any charge user should pay attention to? What are the businesses user is dealing frequently? What charge was expected but didn't happen (for example, did user forgot to pay something like rent)? And so on. We should think deeply about what are other such questions and delight user by providing them the answers.

All of these information should be presented so that user can gradually drill down from high level breakdown to low level details or could navigate through various details or some other UX techniques for sorting, filtering and navigating. MiM should automatically assist user by putting up comparisons and trends so user can understand what is doing on effortlessly. These UX  capabilities should be extensively provided everywhere where it makes sense. Furthermore, MiM should automatically point out issues, reg flags, lack of information so we can save user's time and protect their wealth and money. MiM should provide editing capabilities to fix issues in fastest possible way, for example, category or whatever inference was made on the transaction. The prime directive of MiM is to free up user's time as much as possible while providing robust, accurate, effective and all critical information that user should have and requiring minimum interventions at all times. Some examples of user interface features may include (but not limited to):

- Hierarchical Grouping: Income / Expenses / Transfers with entity and category sub-groups
- Monthly/Yearly Navigation: Browse transactions by time period
- Net Income Calculation: Automatic savings/deficit calculation
- Transaction Aggregates: Counts, positive/negative totals, grouped by reason
- Flagging and Notes: Mark transactions for follow-up with notes and flags
- Web-Based Account Management: Configure accounts through the browser
- Web-Based Settings: Configure data paths and application settings through the browser

To achieve above, MiM needs few capabilities. The primary one to categorize transactions into buckets. Next important one is to connect various transactions such as transfers, credit card payment from checking account to credit card account, refunds, subscriptions, invoices, purchase orders and so on. The next important capability is to make credit card transactions less opaque. For example, expense on Amazon doesn't disclose much unless we can connect that expense to amazon order so user can know exactly what purchase the money was spent. This purchase then can be categorize as usual like clothing, grocery etc.

Over more longer term, MiM should also provide suggestions and advice, for example, let's slow down on eating out. Or may be you are spending too much on grocery that seems way above usual. Or there are discounts at this business if you had used this credit card. These are longer term goal but need not be implemented now but we should keep them in mind so architecture and UX can absorb them in future more easily.

Few other core principles that MiM can follow:

- MiM can run locally so user's data never leaves their computer. There will also be web version of MiM.
- MiM never modifies input data in any way.
- MiM constructs and maintain its own data from the input data in the format that makes sense (for example, JSON, SQL database etc). This acts as one unified view of all the data provided by user so far. MiM imports transaction data from many heterogeneous sources (bank CSVs, credit card exports, PayPal, Amazon order history, Etsy, QuickBooks IIF) into a single unified view.
- MiM allows at least 3 levels to categorize transactions, each subsequent level able to override previous ones: automatic, rule based and manual edits. For example, MiM can apply categories to all matching transactions at once for given scope. MiM will provide great UX to maintain these rules as well as perform individual or batch edits. MiM should provide maximum flexibility so user can get work done in minimum time. Example of these capabilities may include:
  - Scope Filters: Apply edits to transactions matching criteria (entity name, account, amount range, transaction type)
  - Word based matching: Match by any/all words in entity name
  - Bulk Operations: Single edit can affect hundreds of matching transactions
  - Edit Voiding: Ability to revert edits back to original values
  - Edit History: Full audit trail of who changed what and when
- MiM maintains a full immutable audit trail that includes timestamps and sources so one can trace how current or historical values came into existent. As this is immutable data stream, all modifications happens as appending new "edits" in this data stream. For example, if user corrects some transaction then the original transaction is left as-is and a new edit is placed on the top of it.
- MiM should be able to reconstruct its current internal data at any time from original source files plus edits.
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
- MiM should allow tolerance as real world is not perfect, for example, ability configure time window in which transactions can be matched or small amount adjustments that can be made via edits for imperfect matches. For such adjustments, MiM may automatically create synthetic adjustment entries for rounding differences but should always some how indicate in UX so user understands the changes made.
- MiM should display detailed statistics as much as possible and at as many places as possible so user can know what happened and what's the current state. For example, while importing, it should show total transactions to be imported, duplicated found within import, duplicates found within existing, any stats on match issues and so on. MiM should include any statistics that user may find interesting. MiM may use mean, median, std dev and so on wherever it may be interesting.
- MiM should show proper progress bars with detailed progress activity state for long running tasks.
- MiM should provide fun and modern UX that data nerds would absolutely love to use.
- MiM should make import procedure very easy and fully configurable from UX. User should be easily able to tell how a certain file would be imported, which fields are expected, in which account and so on.
- User is never required read any readme or any documents. The UX should always have all information for explanations to inform and guide the user. For example, after install, we should show the next step, i.e., how to start application. After starting application, UX should be easy to navigate and use so that user can intuitively figure out how to import, how files will be treated, where to look for report, how to apply edits and how to get information that a typical user may want to know.
- MiM UX should have all the features necessary to complete tasks from UX without having to mess with low level details in the system such as configuration files.
- MiM UX should never shy away from giving detailed information about everything, such as error messages or statistics or any other details that may be interesting to user to understand what happened or what is going on.