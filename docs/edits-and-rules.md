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
- Conditions are tested against **imported** values (name words come from
  the imported normalized name), never against values an earlier rule
  produced. This applies on create, edit, delete, quick
  correction, and rebuild, so a rule can't stop matching itself by changing
  the field it tests.
- Corrected amount, date, and type drive every total. A date correction moves
  the record to another period.
- **Deleting** a rule replays the remaining rules, so an earlier rule may take
  effect again. Restoring an imported value is a separate correction, not
  "undo".
- Sorting the Rules list never changes execution order. Editing keeps a rule's
  ID and position. Duplicating appends a new rule at the end.

## Everyday edits in the website

- **Set category** (the selection panel, the row menu, or Alt+T) opens a short
  dialog: type or pick a category and apply it either to **everything from
  this merchant**, which saves a normalized-name rule that also covers future
  imports, or only to the selected records, which saves an exact-ID rule. It
  saves without a preview and offers **Undo**, which deletes that rule.
  **More options…** opens the full rule editor with preview.
- **Mark for review** on one record replaces that record's earlier
  flag-only rule (keeping its ID) rather than adding another, so toggling
  never piles up rules.
- Note, other fields, and bulk changes use the full editor with a preview.
  When the selected records disagree on a field, the editor starts it empty
  instead of proposing one record's value.

## Saving safely

The website saves every change through rule management,
`POST /api/transaction-edits/manage`, with
`POST /api/transaction-edits/manage` with
`{ preview, changes: [{ previous, next }], expectedRevision }`. `previous` is
null to create, and `next` is null to delete; a replacement keeps the rule ID.
(`POST /api/transaction-edits` still appends rules for API clients.) The
server:

1. validates the whole batch, checks `previous` against saved rules, and
   rejects new exact-ID targets that don't exist;
2. refuses to commit if the snapshot changed since the preview (stale
   revision), and refuses a snapshot with corrections but incomplete rule
   history;
3. replays everything on a copy, recalculates order completeness, writes both
   JSON files atomically (restoring them on a caught write error), and then
   swaps the copy into memory.

The previous edits file gets a timestamped backup. Apart from the quick
category Undo, there is no undo and no per-rule history, so deleting requires
a preview and a confirmation. A save rejected as stale (409) fetches a fresh
preview before it can be saved again.

## Explaining effects (Rule Studio and transaction details)

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
condition. Rule Studio (`/rules`) is a compact table with search, filters,
impact sorting, bulk edit and delete (up to 1,000), JSON export, and
`/rules?rule=<id>` for a rule's details and matched records.

**Rule health** (`lib/rule-diagnostics.ts`, derived, never stored) walks the
same chains once. For each rule it counts matches, the records where it
writes the winning value of a field ("wins"), and which later rules replace
its values and which earlier ones it replaces. A rule can have these issues,
each a card at the top of the studio that filters the table:

| Issue                  | Meaning                                                                     | Fix offered                          |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| No matches             | Matches no record (an automation may still match future imports)            | Delete                               |
| Overridden             | Matches records, but later rules replace every value it sets on all of them | Delete, or **Make this rule win**    |
| Duplicate              | Same conditions and changes as an earlier rule                              | Delete this copy                     |
| Unavailable references | Exact IDs not in the loaded history; the rule saved no description of them  | Remove them (or delete if none left) |
| Category conflict      | A merchant's records get different winning categories from different rules  | **Use for all**, or keep it          |

A rule with none of these is "working as expected". Deleting no-match or
overridden rules changes no value, because no winning value comes from them.
**Make this rule win** deletes the rule and appends an identical one with a
new ID, so it runs last. **Use for all** appends a normalized-name rule for
the merchant (imported normalized name), which also covers future imports;
the older rules then show as overridden. Conflicts can be intended, so
nothing is changed automatically. Every fix goes through the same preview and
confirmation as any rule change.

Transaction details show current and imported values, related records, the
statement source (path, format, row, institution reference), and the
correction chain: which rule controls which field, and which rules were
overridden. Missing rules or targets are shown as unavailable, never guessed.

`TransactionEditWorkflow` is the single edit flow for one record, a
selection, or all filtered records. Targets are picked by merchant, date,
account, and amount instead of opaque IDs. **Back to editing** keeps the
draft. **Cancel** saves nothing.

## Targets after an ID change

After a rebuild changes transaction IDs, an exact-ID rule is retargeted only
when exactly one equivalent record exists in both the old and the new graph.
Equivalent means the same account, imported type, amount to the cent, name,
and order fields, and the same date (or, failing that, the same calendar day).
Otherwise the reference stays as it was and is reported as unavailable.

## Adding an editable field

The core effective-value logic, rule replay, the server Zod schema, and the
editor UI must all change together. Test create, update,
delete, narrowing scopes, precedence, missing targets, parent completeness,
concurrent requests, a failed save, and reload.
