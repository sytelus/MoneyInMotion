# Features and limitations

## Current features

- User-selectable data root with separate statement and merged-output areas.
- Recursive, inheritable account configuration with account-specific file
  filters.
- CSV, JSON, and IIF support for the institution/account combinations listed in
  [Data layout and import](data-layout-and-import.md).
- Generic CSV column mapping and transaction-reason inference.
- Auxiliary Etsy transaction and receipt acquisition that writes dated JSON
  source files when valid stored access credentials are available.
- Stable content-oriented transaction identifiers for common unchanged-input
  cases.
- Cross-file transaction deduplication and same-account, cross-format
  enrichment.
- Amazon and Etsy order-total and line-item hierarchies.
- Matching of order totals to payment transactions in other accounts.
- Exact and tolerance-based inter-account transfer matching.
- Synthetic tax, shipping, discount, and small residual adjustment children.
- Income, expense, transfer, and unmatched reporting groups.
- Parent/child traversal that avoids counting a completed parent and its detail
  children simultaneously.
- Per-transaction corrections and reusable rule-scoped edits.
- Edit replay across a full statement rebuild.
- Complete merged snapshots plus optional edit-aggregate backups.

## Operational requirements

- The configured data root and required `Statements` and `Merged` parent
  directories must be available to the process.
- Account IDs must be non-empty and unique within the merged collection.
- Institution names and account types must use the values recognized by the
  parser and matcher selection rules.
- Order-history accounts require useful `InterAccountNameTags` to locate their
  payment transactions in other accounts.
- Statement amount signs must follow the outgoing-negative,
  incoming-positive convention.
- Retained statement files and account configurations are the recovery source;
  merged outputs should not be treated as a substitute for them.
- Because statements and merged snapshots can contain sensitive financial and
  provider metadata, the entire data root requires appropriate access control
  and backup handling.

## Important limitations

- **Exact reconstruction is not guaranteed.** The design states that outputs
  should be reconstructible, but generated audit timestamps and identities,
  culture-sensitive parsing and hashing, filesystem enumeration order, and
  ambiguous-match tie order can change serialized or semantic results.
- **Input-file identity is path-based.** Incremental import tracking does not
  hash file bytes, so replacing a file at the same relative path can be skipped.
- **Incremental merge is append-oriented.** Removing or correcting an input
  does not remove its old transactions from an already-loaded snapshot; use a
  full rebuild.
- **`RequiresParent` is not enforced as a parent guarantee.** Supported but
  unmatched transactions remain in the unmatched group; unsupported matcher
  combinations stop processing.
- **Matching is heuristic and single-choice.** Transfer and fuzzy order
  matching select one best candidate and do not ask the user to resolve ties.
- **Edit replay is tolerant of missing IDs.** A transaction-specific edit can
  silently affect fewer transactions after inputs change.
- **Edit storage is duplicated, not cleanly separated.** The merged snapshot
  embeds both applied edit values and the edit history, while the optional edit
  file duplicates that history.
- **Edit persistence differs by action path.** Some edits update only
  `LatestMerged.json`; the separate edit aggregate can become stale.
- **Corrected values are not consumed consistently by every report.** The
  net-aggregation view uses corrected amounts and reasons, while the simpler
  tree/list summary continues to use original amounts and reasons in important
  calculations and columns.
- **Saving is not atomic.** A failure between writes can leave the merged
  snapshot and edit aggregate at different revisions.
- **There is no complete money-domain regression suite in this version.** The
  reconstruction, matching, persistence, and replay guarantees are not
  continuously verified end to end.
- **The API-oriented data path is single-user in practice.** The current
  request handlers select one fixed user dataset rather than resolving an
  authenticated user's data dynamically.

## Reimplementation invariants

A compatible reimplementation should preserve these behavioral invariants
unless a deliberate migration changes them:

1. Never modify original statement inputs.
2. Preserve source provenance for every imported transaction.
3. Keep both records in an inter-account transfer and link them reciprocally.
4. Do not double-count a completed parent and its detail children.
5. Keep unmatched parent-required transactions observable.
6. Apply edits in order with later non-voided values taking precedence.
7. Make the saved merged snapshot independently loadable.
8. Treat the edit aggregate as replay data, not as the only record of the
   currently displayed corrections.

Improvements such as content-based import identity, deterministic ordering,
atomic writes, authenticated multi-user routing, conflict review, and verified
rebuild equivalence should be introduced as explicit migration decisions rather
than assumed to exist in this version.
