# Transaction edits and rules

MoneyInMotion separates imported facts from user corrections. Statement files
remain unchanged, while a chronological edit aggregate expresses how the
financial view should differ. The server automatically saves every accepted
edit; there is no manual save step.

## Editable attributes

The transaction editor can correct:

- amount;
- transaction date;
- transaction reason (income, expense, transfer, and related domain values);
- merchant or payee/entity name;
- category path;
- free-text note; and
- flagged state.

An imported value and an effective value are distinct. Aggregation, net groups,
summaries, display, and later amount/reason scope matching all use the effective
corrected value. The raw imported value remains available for reconstruction.

## Rule scopes

An edit contains one or more filters. All filters on the edit must match; a
multi-value filter matches any of its values. Supported scope types are:

| Scope              | Meaning                                         |
| ------------------ | ----------------------------------------------- |
| All                | Every transaction                               |
| Transaction ID     | One or more exact transactions                  |
| Exact entity       | Exact merchant/payee names                      |
| Normalized entity  | Equivalent names after entity normalization     |
| Any entity tokens  | At least one supplied token appears in the name |
| All entity tokens  | Every supplied token appears in the name        |
| Account            | One or more stable account IDs                  |
| Transaction reason | One or more effective reason values             |
| Amount range       | Inclusive effective numeric range               |

The editor begins with a transaction-specific scope. The confirmation dialog
shows and validates broader choices before saving, helping prevent accidental
mass edits.

## Persistence and replay

The browser submits complete edit objects to `POST /api/transaction-edits`.
Each object includes an ID, timestamps and creator identity, scope filters,
changed values, and a source ID. The active username is used for the audit
identity in the current single-user deployment.

The server validates the whole request and exact-ID targets before changing
state. It then applies edits sequentially to a cloned candidate and saves:

- the materialized, corrected transaction graph in `LatestMerged.json`; and
- the independent chronological rules in `LatestMergedEdits.json`.

The candidate becomes active only after persistence succeeds. This makes a
rejected batch or failed disk write side-effect free in live memory. Mutating
requests are serialized so two browser actions cannot overwrite each other's
candidate state.

During a statement rebuild, MiM creates a clean graph, completes transaction
matching, and then replays the separate rules. This ensures a broader rule can
apply to a newly imported transaction and that a rebuild never edits a source
statement.

Legacy transaction IDs depended on .NET enum names, decimal text scale, and
provider-specific parsing details. During the first rebuild of an existing
legacy snapshot, MiM preserves exact-ID rules conservatively: if an old target
is absent and the old snapshot plus rebuilt graph identify exactly one
semantically equivalent transaction, the rule is retargeted and saved in its
ordinary JSON form. A missing or ambiguous target is retained unchanged and
reported, never expanded or deleted. Later rebuilds need no hidden alias table.

## Rule history and reversal

The Rules page lists persisted rules with their scope, changed values, audit
metadata, and current match count. Reverting does not delete or rewrite
history. It appends a new edit whose selected values are marked void, restoring
the imported value for matching transactions while retaining an audit trail.

Rule order matters: edits are applied chronologically and later applicable
values supersede earlier ones. A field omitted from a later rule leaves the
previous correction untouched.

## Maintainer invariants

- Do not mutate imported transaction fields to implement a correction.
- Add new editable fields to the core model, merge logic, serializer,
  validation schema, editor, Rules presentation, and replay tests together.
- Use corrected amount and reason for financial computations and rule matching.
- Preserve numeric scope-enum values and accepted legacy JSON shapes unless a
  versioned migration is introduced.
- Save edit intent before treating an edit response as successful.
- A rebuild must replay rules only after relationship matching is complete.
- Parent and flattened child indexes must wrap the same transaction data object
  so child corrections survive snapshot serialization and restart.
