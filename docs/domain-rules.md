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
- Persisted IDs and rule scope hashes are lowercase hexadecimal MD5.
  Transaction content hashes use symbolic
  reason names, and transaction IDs hash the canonical content fields plus line
  number and provider reference—not the already-derived content hash.
- Account, import, children, and provider-attribute maps are plain JSON
  objects. The old C# key/value-array form is rejected.
- Dictionary keys must agree with the IDs of their values, referenced account
  and import metadata must exist, and transaction IDs must be unique across the
  whole parent/child graph. Invalid runtime field types are rejected at load.

## Sign and reason semantics

`TransactionReason` is a numeric flag set with the C# enum's values. `Purchase` is
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
  contains a thousands separator. It recognizes the narrow numeric shape before
  the statement parser validates the reconstructed amount.
- Date parsing and amount sign conversion are provider-specific and require
  regression fixtures before change.

## Relationship matching

Order-history accounts set `requiresParent`. Their records are not ordinary
top-level cash flow; they are matched beneath card or payment transactions.
Each order-history account gets its own Amazon or Etsy matcher, chosen by
institution name compared as parser selection does (ignoring case and
punctuation), and using that account's own name tags.

- A line item attaches to the order record in the same account with the same
  order identifier. More than one such order record is an error.
- An order attaches to a charge in a non-order account whose name contains one
  of the order account's name tags. A charge parents at most one order, and a
  charge that already has children is not reused.

Exact amount-and-date pairs are settled first, for all orders; when several
charges match an order exactly, the first in import order wins. The fallback
then tolerates an amount difference of at most one currency unit and a date
difference of at most two days. It ranks every candidate pair across all
remaining orders by amount difference, then date distance, then IDs, and
assigns the best pair first, so the order in which orders are seen never
decides the match.

Incomplete matched parents may receive synthetic discount, shipping, tax, or
rounding-adjustment children. The residual is tolerable only when it is below
two percent of the parent's absolute amount (rounded to cents) or below 0.50 in
absolute currency units. Synthetic imports have stable source IDs.

Transfer matching runs next, over top-level records outside order-history
accounts. A record pairs with the closest-dated unpaired record in another
account that has exactly the opposite imported amount, in two passes:

1. Account payments, transfers, and other credits, within 3 days. If the
   record's account has name tags, the counterpart's name must contain one.
2. Records whose name contains "transfer", within half a day, with a
   counterpart at the same institution whose name also contains "transfer".

Both records then get the Transfer type unless they are already an account
payment or transfer, so they land in their own net group rather than
inflating income and expense. Each record is in at most one pair.

## Aggregation and presentation

- The explorer summary (`NetAggregator`) groups reporting items into Income
  (every incoming type, so returns and discounts too), Expenses, Transfers,
  and Unmatched order records, then by first category segment, then by
  corrected name. The Overview's income/spending split is different; see
  [Overview and financial reports](financial-reports.md).
- Every displayed group counts transactions, accumulates its effective net
  amount, and counts effective transaction reasons for its summary label.
- Group ordering is deterministic: top-level groups have a fixed order and
  lower groups are ordered by total, ties keeping first-seen order.
- Parent/child display preserves hierarchy; top-level counts and all-node counts
  answer different questions and must be labeled accordingly.
- Month navigation is derived from effective transaction dates. A date edit can
  therefore move a transaction to a different period after the query refreshes.

## Corrections

Corrections are rules replayed over the imported values after relationship
matching. See [Edits and rules](edits-and-rules.md).

## Failure policy

Invalid configuration, unsafe paths, ambiguous input, and parse errors are
reported rather than ignored. A full rebuild is a candidate until every source
parses and all matching/edit replay succeeds. Existing statements and the last
known-good snapshot survive a failed rebuild for diagnosis and recovery.
