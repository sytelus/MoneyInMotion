# MoneyInMotion (MoneyAI) — Product Vision

MoneyInMotion (MiM, also called MoneyAI) is a personal finance web app: it is used through the browser and works the same whether the user's computer runs Windows, Mac, or Linux. The user downloads statements from their banks, credit cards, and shopping sites into some root folder (organized into whatever subfolders they like), points MiM at that folder, and MiM figures out everything they might want to know about their money — effortlessly, reliably, and accurately. The prime directive: free up the user's time as much as possible from managing, processing, maintaining and presenting the data while giving them robust, accurate, and complete information, requiring the minimum possible intervention.

This vision describes what MiM does and promises, never how it is built. The choice of storage format (JSON files, a SQL database, and so on), code libraries, frameworks, and programming languages is entirely up to the implementor.

## The defining idea: the connected money story

Raw statements show isolated entries. MiM's most important and defining capability is connecting them into the true story of the user's money, across accounts and across time:

- A deposit in checking may just be a transfer from savings — naive software would count that single move twice, as income in one account and an expense in the other. Likewise, a credit card payment is not an expense; the individual charges on the card are.
- A charge of "$52 AMAZON.COM" becomes the actual items purchased once connected to Amazon order history, and each item can then be categorized properly (groceries, clothing, and so on).
- A refund weeks later — even in the next statement — means an expense was partly or fully undone. MiM shows the net effect with details needed to understand it, and points out important things such as when a refund didn't return the full amount or if it was returned on different account.

Every number MiM shows must be traceable through this chain back to the original statement lines, so the user can verify any figure rather than taking it on faith.

## Forgiving by design

Users will be lazy and forgetful, and financial institutions provide imperfect data. MiM must absorb both gracefully:

- The same statement uploaded twice, in different formats or under different file names, or two files with overlapping transactions: MiM detects and merges the duplicates automatically, recognizing a transaction by its content (for example, by hashing it etc) rather than by file name or position.
- A forgotten account or missing months: MiM shows what time period each account covers and flags the gaps, so the user always knows when totals may be incomplete.
- Limited or imperfect statement data — payee names cut off by the bank, transaction dates off by a couple of days (a long weekend, and so on), small rounding differences: MiM matches with sensible tolerance — how far apart in time, how different in amount — that the user can adjust. Imperfect matches are completed with small adjustment entries, recorded as ordinary edits so they stay as traceable and reversible as everything else.
- A file imported by mistake — into the wrong account, or one the user simply regrets: it can be removed as easily as it was added, without harming the rest of the data.

Messy statements are straightened out automatically. When MiM cannot resolve something on its own, it asks the user — briefly and rarely — and learns from the answer so it doesn't have to ask again. More broadly, MiM remembers the choices the user makes and applies them smartly, while keeping what it remembered visible so the user is never in the dark.

## The questions MiM answers

MiM should answer the questions a person actually has about their money, without being asked:

- How was money spent last week, last month, or in any custom period? How is the trend looking?
- Why is this month's spending higher than normal? What were the anomalies?
- Are there charges that look fraudulent, or fees being quietly charged?
- What subscriptions and recurring expenses exist? Which prices are creeping up — gas, a favorite restaurant?
- How does cash flow in and out, and how is that changing over time?
- Which businesses does the user deal with most often?
- Is there any charge the user should pay attention to? What expected charge didn't happen — did they forget to pay the rent?

MiM should keep thinking of more questions like these and delight the user with answers they didn't think to ask for.

## The experience

- Information is layered: a clear high-level picture first, with every detail one drill-down away. Summaries feel instant.
- MiM offers comparisons and trends on its own so the user understands what is going on without effort, and proactively points out problems, red flags, and missing information to protect their money as well as their time.
- Fixing anything MiM inferred — a category, a match, a merge — takes the fewest possible clicks, individually or in bulk.
- MiM never shies away from detail: statistics (counts, totals, mean, median, and similar wherever interesting) and full explanations are always available, and long-running work shows real progress with meaningful status.
- MiM explains itself: the next step is always visible — after install, after starting, and on every empty screen — so the user can intuitively figure out how to import files, apply edits, and find the information they want.
- The look and feel is fun and modern; data nerds should love using it.

## Minimum feature set

These are the baseline capabilities MiM provides, in addition to everything described above.

Importing:

- Import from generic bank and credit card CSV exports, American Express, Barclaycard, PayPal (CSV and QuickBooks IIF), Amazon order history, Etsy purchase history (JSON), QuickBooks IIF, and generic CSV and JSON files (an array of transaction records, and so on). New sources should be easy to add, and a user-configurable generic importer — one that detects columns automatically from headers and the like — covers everything else.
- Every source has its own quirks, and MiM absorbs them so the user never has to: American Express files carry extra details worth extracting (phone numbers, provider categories), Barclaycard files begin with banner lines, PayPal exports need time zone care and include activity rows that are not real transactions, and so on.
- Files can be uploaded in the app or simply dropped into the data folder. MiM recognizes the institution and account automatically (from the file name, its contents, and so on), shows how a file will be interpreted before committing, and lets the user control the details — which fields are expected and which account the file belongs to.
- Every import reports what happened: transactions imported, duplicates found within the file and against existing data, matches made, and any issues.

Connecting and understanding:

- Transactions are categorized automatically, in at least three layers, each able to override the one before: automatic, rule-based, then manual edits.
- Related transactions are connected: inter-account transfers, credit card payments, refunds to their original charges, subscriptions, invoices, and purchase orders — including several order line items matched to the single card charge that paid for them.
- Merchant names are cleaned and standardized so the same business always appears the same way.
- Transactions can be split into line items.

Viewing and analyzing:

- Instant hierarchical summaries of income, expenses, fees, and transfers, grouped by entity, category, time period, and transaction type.
- Navigation by month, year, or any custom period, with automatic net income (savings or deficit) calculation.
- Aggregates wherever useful: counts, positive and negative totals, and breakdowns by transaction reason.
- Sorting, filtering, searching, and linking wherever they make sense.

Editing and correcting:

- Individual and bulk edits with scope filters — entity name (matching any or all words), account, amount range, transaction type — so a single edit can fix hundreds of transactions at once. Maintaining rules and making edits offers maximum flexibility while taking the least possible time.
- Any edit can later be voided, reverting the affected transactions to their previous values.
- Transactions can be flagged and annotated with notes for follow-up.

Managing:

- Accounts, the data folder location, and application settings are fully manageable in the browser.

## Must-haves

- Local-first privacy: MiM runs on the user's own computer and their financial data stays there. If a hosted version is offered, using it is an explicit opt-in and it must keep the same privacy promise.
- MiM builds and maintains its own unified view of all imported data, and can rebuild it at any time from the original source files plus the recorded edits.
- Continuity: data created by the original MoneyAI (C#) application continues to load and work.
- All changes are append-only: a correction never overwrites the original, and a full audit trail records who and what changed, when, and by what means (import, rule, or manual edit). Everything is reversible, including bulk operations and MiM's own automatic decisions.
- Anything MiM inferred or created itself — a category, a match, a merge, a synthetic adjustment entry — is visibly marked, with its reason available, and is correctable on the spot.
- The user's edits and rules are precious: a failed or repeated import must never corrupt or lose them, and backing them up and restoring them is easy.
- No lock-in: the user can export their data — transactions, categories, and edits — in open formats at any time.
- MiM stays fast and pleasant even with many accounts and many years of history.

## Must-never-dos

- Never modify or delete the user's input files in any way.
- Never send the user's data off their machine without explicit consent.
- Never silently drop, alter, or invent a transaction.
- Never fail silently: every error tells the user what happened and what to do next.
- Never require reading documentation or editing configuration files to get something done.

## Longer term

Eventually MiM should offer suggestions and advice: "eating out is trending up — maybe slow down," "grocery spending is well above your usual," "this business offers a discount with a card you already have." These need not be built now, but the architecture and UX should be able to absorb them naturally later.
