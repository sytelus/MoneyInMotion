# Edits and persistence

## Edit model

Each user action creates an immutable edit record containing:

- a globally unique edit identifier;
- creation/update audit information;
- a source identifier;
- one or more scope filters; and
- one or more edited values.

Supported edited values are:

- transaction reason;
- transaction date;
- amount;
- entity name;
- user flag;
- note; and
- category path.

Supported scope types are:

- all or none;
- explicit transaction IDs;
- original or normalized entity name;
- any or all entity-name tokens;
- account ID;
- transaction reason; and
- amount range.

Multiple scope filters on one edit are combined as intersections. Depending on
the scope type, multiple parameters within one filter match any parameter or,
for the all-token scope, every parameter.

Edits are ordered. Applying an edit merges its non-empty values into each
matched transaction and records the edit ID newest-first on that transaction.
A void edit value removes the corresponding correction and exposes the
original imported value again. Later edits therefore take precedence for the
fields they change.

Rule scopes are evaluated against the transaction collection at application
time. Replaying the same edit set over materially changed inputs can affect a
different set of transactions. During the normal aggregate replay path,
explicit transaction IDs that no longer exist are ignored by default.

## `LatestMerged.json`

`LatestMerged.json` is not an edit-free base file. It is a complete materialized
snapshot containing:

- top-level transactions and nested children;
- transaction and content identifiers;
- parent, combined-record, and transfer relationships;
- imported and generated transaction attributes;
- account and import metadata;
- each transaction's currently merged edit values and applied edit IDs; and
- the complete ordered edit collection.

Loading an existing snapshot does not separately load or overlay
`LatestMergedEdits.json`. The snapshot is immediately usable on its own.

The primary statement workflow writes this file only when the user selects
Save. The API-based editing workflow applies submitted edits to the loaded
snapshot and writes `LatestMerged.json` immediately.

## `LatestMergedEdits.json`

`LatestMergedEdits.json` is an aggregate serialization of the ordered edit
collection embedded in a snapshot. It is written when the primary workflow is
asked to save edits, including the preservation step performed before a
**Keep edits** rebuild.

It is not:

- one file per user edit;
- a mandatory companion required to view `LatestMerged.json`; or
- automatically updated by every supported edit path.

When the file already exists, the current version copies the entire old
aggregate to a timestamped sibling before overwriting it. The implemented
backup name has the form `LatestMergedEdits.<timestamp>..json` (including the
double period). These files are historical aggregate snapshots, not individual
events in an automatically replayed chain.

## Keep-edits rebuild

The primary **Keep edits** workflow is:

1. Load the previous `LatestMerged.json`.
2. Extract and save a cloned aggregate of its embedded edit collection to
   `LatestMergedEdits.json`.
3. Discard the loaded transaction snapshot.
4. Rebuild a new snapshot from all statement inputs.
5. Load the aggregate edit file and apply its edits in order.
6. Present the result for review.
7. Save the rebuilt snapshot and current aggregate edits only on explicit user
   request.

This workflow provides practical edit portability across rebuilds, but it does
not prove that the rebuilt result is identical. Transaction IDs and rule
matches can change when statement content, parsing culture, row positions, or
matching choices change.

## Persistence characteristics

- Imported statement source files are read-only during processing; MiM does not
  modify or delete them. A separate acquisition action can create new source
  files.
- Snapshot writes replace the target file directly and do not create a backup
  of the previous `LatestMerged.json`.
- Edit-aggregate writes back up the previous aggregate first.
- Writes are not transactional across the two output files.
- The API-based edit path updates the merged snapshot but does not update the
  separate edit aggregate.
- Concurrent writers are not coordinated across processes.

Consumers should therefore treat `LatestMerged.json` as authoritative for the
currently saved view and `LatestMergedEdits.json` as an optional replay and
recovery artifact whose freshness must be checked.
