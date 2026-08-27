# MoneyInMotion overview

- The user selects a **data root**. Downloaded statements live below
  `<root>/Statements`; generated files normally live below `<root>/Merged`.

- Statement directories contain `AccountConfig.json`. Configuration supplies
  account identity, account type, institution, parent-matching behavior,
  inter-account name tags, file filters, and recursive-scan behavior. A
  configuration may be inherited by nested directories.

- The user starts **Scan Statements** to build a new financial snapshot. The
  current user workflow scans all configured files; it is a full rebuild, not
  an incremental scan of only newly added transactions.

- MiM parses statement rows into normalized transactions, deduplicates records
  that overlap across files, and can enrich a transaction when the same record
  is available in different formats.

- MiM builds parent/child hierarchies for supported order-history accounts,
  matches order totals to payment transactions, links transfers and credit-card
  payments across accounts, and creates small balancing adjustments where the
  matching rules allow them.

- Reporting uses completed child details instead of also counting their
  parents. Linked transfers remain as transactions but are reported separately
  from income and expenses. Transactions that require a parent but cannot be
  matched remain explicitly unmatched.

- The user may correct amounts, dates, transaction reasons, names, categories,
  notes, and flags. An edit may target specific transactions or act as a rule
  over a broader scope.

- In the primary rebuild workflow, **Keep edits** first preserves the edit set
  from the previous snapshot, rebuilds from the statements, and then replays
  those edits. The rebuilt result remains in memory until the user saves it.

- `LatestMerged.json` is the complete saved financial snapshot. It includes
  the transaction hierarchy, matching results, applied values, and edit
  history; it is sufficient by itself for normal viewing.

- `LatestMergedEdits.json` is an optional aggregate replay copy of the edit
  history. It is not one file per edit and is not automatically combined with
  `LatestMerged.json` whenever the snapshot is loaded.

- Reconstructing outputs from retained statements and edits is a core design
  goal. The current version does not guarantee byte-for-byte or fully
  deterministic reconstruction; see
  [Features and limitations](features-and-limitations.md).
