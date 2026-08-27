# Processing workflow

## End-to-end rebuild

The primary scan action performs the following sequence:

1. Clear the currently loaded snapshot.
2. If **Keep edits** is enabled and a saved snapshot exists, load that snapshot
   and save a separate aggregate copy of its embedded edit history.
3. Create an empty `LatestMerged` transaction collection.
4. Discover every configured statement location below `Statements`.
5. Parse each statement into a temporary transaction collection.
6. Merge the temporary collection into the new snapshot, deduplicating and
   enriching transaction content across files.
7. After statements have been merged, run parent/child matching followed by
   inter-account transfer matching.
8. If edits were preserved, replay the aggregate edit set over the rebuilt
   transactions.
9. Present the rebuilt result for review.
10. Save only when the user explicitly requests it.

The underlying merge operation can also add statements to an existing
snapshot and skip already-recorded import paths. The primary user-facing scan,
however, creates a new collection first and therefore reads the full input set.

## Cross-file merge and enrichment

For each parsed statement:

- Transactions whose content hash is absent from the destination are cloned
  into it.
- When both collections contain exactly one transaction with the same content
  hash, the records are eligible for enrichment.
- Enrichment occurs only within the same account when the source formats are
  different. It may replace less useful entity, date, subaccount, category,
  posting date, phone, institution-reference, check-reference, or account
  details.
- The retained record stores the contributing transaction's identifier as its
  combined-from reference. The contributing record is marked with the reverse
  reference while the temporary source collection exists, but is not also
  added to the saved top-level collection.

Content-hash collisions or true repeated transactions can prevent enrichment
because the operation requires uniqueness on both sides.

## Parent/child order matching

`RequiresParent` is a matching request, not a referential-integrity guarantee.
The default comes from the account, but a parser or generated transaction can
override it.

The current version supports parent matching for Amazon and Etsy order-history
accounts:

1. Item lines are matched to an order total in the same account using the
   provider-specific parent/child match key.
2. An order total is matched to a non-parent-required transaction in another
   account. The candidate description must contain one of the order account's
   configured inter-account name tags.
3. The preferred match has the same amount and transaction date.
4. If no exact match exists, candidates within 1 currency unit and two days
   are ranked by combined amount/date distance. A candidate that already has
   children is excluded from this fallback.
5. A matched child is removed from the top-level collection and stored under
   its parent.

If no parent is found, the transaction remains top-level with
`RequiresParent=true` and is reported as unmatched. Setting `RequiresParent`
on an unsupported institution/account-type combination causes matching to fail
rather than falling back to a generic parent search.

## Parent completion and generated adjustments

A parent is complete when the sum of its direct children equals the parent's
amount. For order totals, MiM can add explicit discount, shipping, and tax
children from provider metadata. It can then add a final match-adjustment child
when the residual is less than either:

- 2 percent of the parent's absolute amount, rounded to cents; or
- 0.50 currency units.

Generated adjustment transactions are persisted in the snapshot and are tied
to synthetic import metadata. They are derived output, not source-statement
records.

## Inter-account transfer matching

Transfer matching links two top-level transactions rather than deleting or
combining them.

The first matching pass considers unmatched transactions already classified as
inter-account activity or other credit. It searches for a transaction that:

- has the exact opposite amount;
- belongs to a different account;
- is within three days;
- is not parent-required or already linked; and
- contains one of the source account's inter-account name tags in its entity
  name.

A second pass handles descriptions containing `transfer`. It searches within
the same institution, also requires the counterpart description to contain
`transfer`, uses a half-day tolerance, and does not require configured name
tags.

The closest candidate by transaction-date distance is selected. The two
transactions receive reciprocal related-transfer identifiers. A transaction
not already classified as inter-account activity is reclassified as an
inter-account transfer.

## Reporting and double-count prevention

Reporting begins with top-level transactions:

- A complete parent hierarchy is traversed to its leaves; the completed parent
  is not counted in addition to its children.
- An incomplete parent is counted as a single transaction and its partial
  children are not separately included in totals.
- Parent-required transactions with no parent are grouped as unmatched.
- Inter-account transactions are grouped as transfers.
- Net income is calculated from income plus expenses; transfer and unmatched
  groups are excluded from that calculation.
- The net-aggregation view uses user-corrected dates, amounts, reasons, names,
  and categories. The simpler tree/list summary uses corrections for some
  grouping and display fields but continues to total and display original
  amounts and reasons.

This preserves both sides of a transfer for traceability while preventing them
from being presented as ordinary income and expense.
