# Transaction edits and rules

MoneyInMotion separates imported facts from corrections. Rule management never
rewrites statement files or imported transaction values. Accepted changes save
automatically; previews do not save anything.

## Viewing and organizing rules

Rules supports search by merchant, account, category, note, rule ID, and source;
filters by edited field and application/attention status; sorting by saved order,
match count, condition, or change; and 25-rule result pages. Select a page or all
filtered results to edit or delete multiple rules (up to 1,000).

Specific-ID rules show available target names and dates, not just opaque IDs.
Recorded match counts come from the snapshot's applied-edit IDs; later rules
can override these values. “Unavailable transactions” means that a saved ID is
not present, not that money is missing. The help popup explains checking retained
statements and editing/removing obsolete rules. Missing historical references
are preserved, never guessed.

## Create, edit, delete, and restore

The editor exposes amount, date, type/reason, merchant name, category, note, and
“Mark for review.” A review mark is a personal reminder, with no effect on totals.

1. Create a rule or open an existing rule's edit button.
2. Choose conditions and fields. All conditions must match. Multiple values
   within a condition are alternatives, except “all words.”
3. Preview the effect across the full history, including a before/after sample.
4. Save only after reviewing the result. Rules apply to future imports too.

Existing rules keep their ID and position when edited. Later rules override
earlier rules for the same field. Changing list sort order does not reorder
execution. Bulk edits preserve each rule's conditions and untouched fields.

Deleting a rule removes it from the active set and replays the remainder; an
earlier rule may become effective again. In contrast, “Restore imported value”
is an explicit void marker that clears prior overrides for that field.
“Do not change” omits that field from a rule. Bulk “Keep current setting” leaves
each selected rule's existing field behavior intact.

Previous aggregate files receive timestamped backups. There is no in-app undo
button or immutable per-rule audit ledger. Deletion therefore always requires
preview and confirmation.

## Scope semantics and deterministic replay

Supported conditions are all/no transactions, exact IDs, imported entity names,
normalized names, any/all name tokens, account IDs, transaction reasons, and
inclusive amount ranges. Amount-range bounds are non-negative magnitudes with
an explicit incoming/outgoing direction.

Financial views use corrected values. Rule scopes, however, are resolved
against the imported baseline before applying the ordered rule set. This is
the same behavior on create, edit, delete, quick correction, and statement
rebuild; a rule cannot stop matching itself by changing the field it tested.
Low-level core `filterTransactions` operates on the provided collection, so
callers building a rule preview must supply the unedited baseline.

## HTTP and persistence

Quick corrections use `POST /api/transaction-edits`. Rule management uses
`POST /api/transaction-edits/manage` with:

```json
{
  "preview": true,
  "changes": [
    { "previous": null, "next": "<complete new rule object>" }
  ]
}
```

For updates, supply both the previous and replacement rule. For deletion,
supply the previous rule and `next: null`. The example's string placeholder
must be replaced by a validated edit object. A commit uses `preview: false`
and the `expectedRevision` returned by preview.

The API validates the entire batch, checks previous rules for conflicts,
rejects new missing exact-ID targets, and serializes mutations. It rejects a
preview revision if transactions or rules changed in the meantime. A snapshot
with corrections but incomplete rule history is rejected for managed replay
rather than silently losing unknown corrections.

The server clones the active graph, removes its derived correction overlays,
resolves scopes, replays rules, and recalculates parent completeness. IDs,
imported facts, parent/child relationships, and transfer links are preserved.
It saves `LatestMerged.json` and `LatestMergedEdits.json` before publishing the
candidate in memory. Caught write failures restore previous files. Abrupt
process/storage failures remain subject to the documented two-file transaction
limit.

Audit creator strings identify the UI/source producing a rule, not an
authenticated human. This remains a single-user application.

## Legacy targets

On statement rebuild, legacy exact-ID rules can be safely retargeted only when
the old and rebuilt graphs identify exactly one semantically equivalent record.
Missing or ambiguous references remain unchanged for manual review.

## Maintainer invariants

- Never implement corrections by mutating imported fields.
- Keep API preview, quick edits, and rebuild replay semantics consistent.
- Validate a whole batch before applying it; preserve rule order.
- Reject incomplete correction histories and stale previews.
- Keep flattened and parent-held child records consistent.
- Preserve legacy numeric scope enums and JSON compatibility.
- Test create/update/delete, narrowing scopes, precedence, missing targets,
  parent completeness, concurrent requests, save failure, and reload.
