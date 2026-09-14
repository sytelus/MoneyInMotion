# Domain rules

This is the behavioral map for maintainers. The implementation and tests are
authoritative; this document explains the invariants behind them so a cleanup
does not accidentally change financial meaning.

## Identity and source metadata

- Account IDs are stable and participate in transaction identity. Renaming an
  account after import is therefore prohibited.
- Import IDs are deterministic hashes of portable statement addresses. Files
  are discovered in sorted order and addresses use `/` separators so server OS
  differences do not reorder the model.
- Transaction identity is derived from imported content and source metadata;
  it is not a database sequence or UI row index.
- Legacy-compatible MD5 output is lowercase hexadecimal where the C# helper's
  `hexStringOutput` flag was true. Transaction content hashes use symbolic
  reason names, and transaction IDs hash the canonical content fields plus line
  number and provider reference—not the already-derived content hash.
- Account, import, children, and provider-attribute maps decode both native
  objects and legacy C# key/value-array dictionary representations.
- Dictionary keys must agree with the IDs of their values, referenced account
  and import metadata must exist, and transaction IDs must be unique across the
  whole parent/child graph. Invalid runtime field types are rejected at load.

## Sign and reason semantics

`TransactionReason` is a legacy-compatible numeric flag set. `Purchase` is
zero and is nevertheless an outgoing reason by convention. Other values group
into outgoing, incoming, and inter-account masks. Preserve the numeric values,
including historically misspelled member names, because they are persisted.

UI totals and grouping use corrected amount and corrected reason. Positive and
negative sums are tracked separately; negative magnitudes are presented as
expenses where appropriate. Parent and child transactions must not both be
interpreted as independent cash flow in a top-level financial total.

## Entity normalization

Merchant/payee normalization removes noisy leading punctuation and long
trailing reference digits, collapses whitespace, and standardizes casing while
preserving meaningful mixed case. All-uppercase domain-like names are lowered;
other all-uppercase names become title case. If cleanup would produce an empty
name, the trimmed import value is retained.

Exact-name rules and normalized-name rules are intentionally different. Do not
silently normalize a scope that claims exact matching.

## Account discovery and parsing

- `Statements/<account>/AccountConfig.json` defines one top-level account.
- A configured account may scan statement subfolders; a disabled setting stops
  traversal beneath that account directory. Nested config files are ignored.
- File filters are case-insensitive to preserve Windows-created data behavior
  on Linux servers.
- Institution name, account type, and content type choose the parser. Unknown
  institutions use the generic delimited parser where possible.
- Ambiguous extra CSV fields are an error rather than grounds to truncate data.
  The parser has a narrow recovery for legacy rows whose unquoted final amount
  contains a thousands separator and validates the reconstruction
  mathematically.
- Date parsing and amount sign conversion are provider-specific and require
  regression fixtures before change.

## Relationship matching

Order-history accounts set `requiresParent`. Their line items are not ordinary
top-level cash flow; they are matched beneath card or payment transactions.
Amazon and Etsy matchers use order identifiers where supplied, configured
merchant tags, amount, and date proximity. A financial transaction may parent
only one order candidate during a matching pass. More than one exact eligible
parent is treated as ambiguous rather than attached arbitrarily, and a parent
or child already participating in a relationship is not reused.

For non-line-item order matches, the fallback tolerates an amount difference of
at most one currency unit and a date difference of at most two days, rejects
parents that already have children, and ranks amount difference before date
distance with transaction ID as the deterministic final tie-breaker.

Incomplete matched parents may receive synthetic discount, shipping, tax, or
rounding-adjustment children. The residual is tolerable only when it is below
two percent of the parent's absolute amount (rounded to cents) or below 0.50 in
absolute currency units. Synthetic imports have stable source IDs.

Generic matching also recognizes candidate inter-account movements through
account tags, opposing signs/compatible amounts, and date proximity. Transfers
belong in their own net group rather than inflating income and expense. Each
transaction can participate in at most one transfer pair.

## Aggregation and presentation

- Transactions are grouped into income, expenses, and inter-account movements,
  followed by reason, normalized entity, category, and transaction rows as the
  configured aggregator requests.
- Every displayed group counts transactions, accumulates its effective net
  amount, and counts effective transaction reasons for its summary label.
- Group ordering is deterministic: semantic top-level order is explicit and
  lower groups use stable totals/names.
- Parent/child display preserves hierarchy; top-level counts and all-node counts
  answer different questions and must be labeled accordingly.
- Month navigation is derived from effective transaction dates. A date edit can
  therefore move a transaction to a different period after the query refreshes.

## Corrections

Rules apply only after relationship matching. Filters within one edit compose
as an intersection; multiple parameter values within a filter form the allowed
set for that dimension. Later edits win per changed field. A null/absent field
means no change, while a present voided field reverts that field to its imported
state. See [Transaction edits and rules](transaction-edits.md).

The Rules page determines a historic rule's affected transactions from their
recorded applied-edit IDs where available. A reset targets those exact IDs in
bounded batches rather than reusing the original broad filter.

## Failure policy

Invalid configuration, unsafe paths, ambiguous input, and parse errors are
reported rather than ignored. A full rebuild is a candidate until every source
parses and all matching/edit replay succeeds. Existing statements and the last
known-good snapshot survive a failed rebuild for diagnosis and recovery.
