# Rules, transaction editing, and provenance UX

This document describes the UI projections added for understanding existing financial records. These features do not add fields to statements, transaction snapshots, or saved rules. The original statement values remain separate from saved correction rules.

## User workflows

### Understand a transaction

Select a transaction to see its current values, original statement values, related records, statement source, and current correction chain. The source panel provides the stored relative path, statement format, recorded row number, posted date, and institution reference when present. “Explore this statement’s records” opens a source-record view across dates; it does not silently inherit an unrelated reporting period.

The correction chain names each recorded rule, its conditions and changes, and the fields it currently controls or whose values were overridden by a later rule. A rule link opens its result inspector. Unavailable rule references are shown explicitly; the UI does not invent a replacement or claim a complete explanation in that case.

Related payment, transfer, combined-record, and order links are investigative context. Source records can contain both a payment and its items. They must not be added together as a financial total. The details sidebar deliberately does not sum source-record selections or source-record summary views.

Related-record links explicitly switch to source-record inspection. As a second safeguard, a selected batch is only summed if every selected ID belongs to the non-duplicated reporting projection; a stale or programmatically mixed parent/item selection is not additive even when the current view label says Reporting items. Unavailable related references are displayed as unavailable, including their stored identity, instead of silently rendering an empty related-record list.

### Understand a rule

Rules can be searched, filtered by changed field, status, purpose, and account, sorted, selected in batches, duplicated, and exported as JSON. Sorting the list does not change saved execution order. The account filter includes explicit account conditions and recorded matches, not hypothetical future matches.

Purpose is derived, not persisted:

- **Specific-record correction:** includes an exact transaction-ID condition.
- **Reusable automation:** has no exact-ID or no-match condition.
- **No-match condition:** contains the existing `ScopeType.None` condition.

`/rules?rule=<encoded ID>` opens the read-only rule inspector. It provides searchable, sortable, paginated matched records and links to those records. Missing exact targets remain visible. Inspection itself never calls the mutation API.

### Edit one record, a selection, or an automation

`TransactionEditWorkflow` is the shared preview/save flow for single-record edits, checkbox selections, and filtered batches. It starts with exact selected IDs. A user can deliberately change conditions to create an automation; the dialog explains that broader conditions can affect existing and future imports.

Exact-ID targets are selected by merchant, date, account, and amount instead of requiring copied opaque IDs. Unavailable historical targets are retained until explicitly removed. Existing server validation still rejects newly introduced unknown targets.

Account conditions combine accounts from the loaded snapshot with the separately fetched account configuration list. A newly configured account can therefore receive an automation before its first import. If the configuration read fails, the editor explains the failure, offers retry, and retains the accounts already known from transaction history; that failure does not disable unrelated editing.

The editor remains mounted but closed during server preview, so **Back to editing** restores the complete draft. **Cancel** exits the workflow without saving. Changes use the existing preview endpoint and commit with the returned revision; a stale preview is not a license to overwrite newer data.

Duplicating a rule copies its current conditions/values into a new draft. Saving creates a new ID at the end of the saved order; the original is not overwritten. Duplicating a legacy rule with unavailable exact targets does not bypass server validation: the user must resolve those targets before saving the new rule.

## Meaning of effect counts

`lib/rule-effects.ts` derives all explanations from saved rules and each transaction's `appliedEditIdsDescending`. It does not reclassify or modify transactions.

| Metric                   | Meaning                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- |
| Recorded matches         | Records whose saved applied-rule list contains the rule ID.                   |
| With latest field writes | Records for which this rule is the newest known writer of at least one field. |
| With overridden fields   | Records for which a later rule writes at least one of this rule's fields.     |
| Unavailable references   | Exact transaction IDs in a rule that are absent from the loaded graph.        |

The latter two record counts can overlap. For example, an earlier rule may still control a note while a later rule controls its category. A rule that explicitly restores an imported value is also a field writer and supersedes earlier corrections. A recorded match is not proof that a dollar amount changed.

The complete transaction graph is inspected, including parent records that reporting projections may replace with complete items. Match counts must therefore not be presented as additive financial totals. Missing rule definitions make explanations incomplete; surviving definitions are described as the latest _known_ writers.

The summary calculation visits the graph once and maintains small field-writer sets. Do not replace it with one full-graph scan per rule. The inspector renders ten results per page; the Rules catalog renders 25 rules per page. Exact-target edits are limited to 1,000 records, consistent with the current editing limit.

## Timestamp and identity limitations

The UI distinguishes evidence that exists from history that has never been recorded:

- `ImportInfo.createDate` and `updateDate` are filesystem creation/modification timestamps in the current importer. Copying a file can change them. They are not first-import timestamps.
- Transaction audit creation timestamps can represent a rebuild/reparse. Latest update timestamps can represent rule replay. Neither proves the original import event time.
- Rule audit metadata describes the saved rule version. Earlier overwritten versions and deleted rules are not a complete event history.
- Producer strings such as `web-ui`, `rules-ui`, or a recorded OS name are metadata, not authenticated human identities.
- The current importer assigns a path-derived identity to `ImportInfo.contentHash`. It must not be advertised as a verified content checksum.

The UI consequently says **First import time: not recorded reliably** and labels the expandable section **Processing metadata & time limitations**. Do not replace that qualification with a plausible-looking timeline.

An immutable import/correction journal would require additional app-generated metadata and user approval. It could record future import/rebuild events, parser versions, file-content digests, and rule revisions; it cannot reconstruct unknown historical events from institution exports. No such journal or metadata schema is introduced by this work.

## Component boundaries

| Module                          | Responsibility                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `lib/rule-effects.ts`           | Pure saved-chain analysis and derived purpose classification.                  |
| `lib/transaction-provenance.ts` | Pure source/record metadata projection and UTC timestamp formatting.           |
| `TransactionProvenance.tsx`     | Source evidence, current correction chain, honest metadata limitations.        |
| `RuleInspectionDialog.tsx`      | Read-only matched-record inspection and navigation.                            |
| `RuleTargetPicker.tsx`          | Human-readable exact-target selection; preserves unknown legacy references.    |
| `RuleValuesEditor.tsx`          | Shared seven-field value/restore controls; multiline notes.                    |
| `RuleEditor.tsx`                | Validated rule draft, conditions, and values; optional controlled visibility.  |
| `RuleChangePreview.tsx`         | Existing server preview/commit API, revision check, and optional Back action.  |
| `TransactionEditWorkflow.tsx`   | Transaction-facing editor/preview orchestration with retained draft.           |
| `RulesPage.tsx`                 | Catalog filtering, selection, export, deep-link inspection, and orchestration. |

The shared transaction workflow accepts `transactions`, `open`, `onOpenChange`, optional `onSaved`, optional `initialField`, and optional `initialValues`. `initialValues` takes precedence, allowing an explicit review-mark removal intent to differ from a mark-for-review action. Mount a fresh workflow for a different edit session; do not change its target IDs while a draft is open.

URL construction is shared with `lib/transaction-navigation.ts`. Source, rule, and exact-record links use `basis: 'records'` to reveal hidden parent records and `view: 'list'` for immediate inspection. A reporting view remains a different projection with non-duplicated totals.

Generated exports use `lib/download.ts`; files are downloaded locally. A Rules JSON export contains exactly the selected rules, or all filtered rules if none are selected. Exporting does not change saved rule priority or persist new metadata. This is a portable inspection/backup export, not a new automatic rule-import workflow.

## Verification and regression checklist

Focused automated checks:

```bash
npx vitest run packages/web/__tests__/components/RuleIntelligence.test.tsx packages/web/__tests__/pages/RulesPage.test.tsx
npx tsc -b packages/web
```

Tests cover partial overrides, restore-imported precedence, unavailable rule references, unchanged source serialization, derived purpose, read-only inspection, provenance labels/link scopes, named exact targets, retained drafts, revision-based commit, rule filters, and duplication identity.

Browser review should additionally cover:

1. Open a matched rule; sort/search its records and follow a record link from another date range.
2. Follow a statement link and use browser Back/Forward without stale filters.
3. Edit a transaction, preview, return to editing, and confirm the draft survived.
4. Exercise category, note, attribute, mark, and clear shortcuts with one and multiple selected records.
5. Verify source-record views never present parent-plus-child sums as spending.
6. Duplicate and export selected rules; verify the original rule remains unchanged.
7. Open nested help and keyboard-close it without discarding the editor.
8. On a narrow viewport, verify no clipped conditions, horizontal overflow, or unreachable Save/Back controls.

Any browser write checks must use an isolated data copy. Live financial history is not a test fixture to mutate.
