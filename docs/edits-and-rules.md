# Edits and rules

Imported values never change. Every correction is saved as a rule in
`Merged/LatestMergedEdits.json` and replayed over the imported baseline. A
"one-off" edit is simply a rule whose condition is a list of exact
transaction IDs. Accepted changes save immediately, and previews save nothing.

## What a rule is

- **Conditions** (all must match; several values inside one condition are
  alternatives): all or no transactions, exact transaction IDs, imported
  merchant name, normalized name, any or all name words, account IDs,
  transaction types, and an amount range (non-negative bounds plus an
  incoming or outgoing direction).
- **Changes** to any of: amount, date, type (reason), merchant name,
  category, note, and **Mark for review**. A review mark is a personal
  reminder and doesn't affect totals. Each field can be left alone, set,
  cleared, or **restored to the imported value**. Restoring is an explicit
  marker that cancels earlier rules for that field.

## How replay works

- Rules run after relationship matching, in saved order. A later rule wins
  per field.
- Conditions are tested against **imported** values, never against values an
  earlier rule produced. This applies on create, edit, delete, quick
  correction, and rebuild, so a rule can't stop matching itself by changing
  the field it tests.
- Corrected amount, date, and type drive every total. A date correction moves
  the record to another period.
- **Deleting** a rule replays the remaining rules, so an earlier rule may take
  effect again. Restoring an imported value is a separate correction, not
  "undo".
- Sorting the Rules list never changes execution order. Editing keeps a rule's
  ID and position. Duplicating appends a new rule at the end.

## Saving safely

Quick corrections post to `POST /api/transaction-edits`. Rule management uses
`POST /api/transaction-edits/manage` with
`{ preview, changes: [{ previous, next }], expectedRevision }`. `previous` is
null to create, and `next` is null to delete. The server:

1. validates the whole batch, checks `previous` against saved rules, and
   rejects new exact-ID targets that don't exist;
2. refuses to commit if the snapshot changed since the preview (stale
   revision), and refuses a snapshot with corrections but incomplete rule
   history;
3. replays everything on a copy, recalculates order completeness, writes both
   JSON files atomically (restoring them on a caught write error), and then
   swaps the copy into memory.

The previous edits file gets a timestamped backup. There is no in-app undo
button and no per-rule history, so deleting requires a preview and a
confirmation.

## Explaining effects (Rules page and transaction details)

`lib/rule-effects.ts` derives explanations from each transaction's
`appliedEditIdsDescending`. It never changes any data.

| Term                   | Meaning                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| Recorded matches       | Records whose applied-rule list contains this rule                 |
| Latest field writes    | Records where this rule is the newest writer of at least one field |
| Overridden fields      | Records where a later rule rewrites one of this rule's fields      |
| Unavailable references | Exact IDs in the rule that no longer exist. No money is missing    |

A match is not proof that a value changed, and match counts include order
parents, so they are not money totals. **Purpose** is derived, not stored:
rules with exact IDs are corrections, rules with neither exact IDs nor a
no-match condition are automations, and the remaining rules have a no-match
condition. The Rules page is a compact table with search, filters, impact
sorting, bulk edit and delete (up to 1,000), JSON export, and
`/rules?rule=<id>` for a read-only list of matched records.

Transaction details show current and imported values, related records, the
statement source (path, format, row, institution reference), and the
correction chain: which rule controls which field, and which rules were
overridden. Missing rules or targets are shown as unavailable, never guessed.

`TransactionEditWorkflow` is the single edit flow for one record, a
selection, or all filtered records. Targets are picked by merchant, date,
account, and amount instead of opaque IDs. **Back to editing** keeps the
draft. **Cancel** saves nothing.

## Legacy targets

After a rebuild changes transaction IDs, an exact-ID rule is retargeted only
when exactly one equivalent record exists in both the old and the new graph.
Otherwise the reference stays as it was and is reported as unavailable.

## Adding an editable field

The core effective-value logic, rule replay, the server Zod schema, the editor
UI, and the legacy codec must all change together. Test create, update,
delete, narrowing scopes, precedence, missing targets, parent completeness,
concurrent requests, a failed save, and reload.
