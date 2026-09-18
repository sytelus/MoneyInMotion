# UX and migration review — 2026-09-17

## Scope and evidence

Compared the current React/TypeScript implementation with commit `309411b`,
before the hosted-app migration. Inspected the original JavaScript navigation,
list, edit-rule templates, and scope editor; the C# WinForms navigation/list
handlers and scan/load/save workflow; and the legacy overview and existing
migration-parity documentation. Changes below preserve imported financial data.

The source/interaction review was followed by a screenshot-based audit in local
Chromium, with the user's permission. The production build ran against a separate
copy of the existing statements and snapshot. Saves, deletes, and uploads were
tested only against that copy; the original snapshot, rules, and configuration
were hash-checked. Screenshots and browser logs stayed local, outside the repository.
Browser viewport checks are not physical-device or full accessibility certification.

## Flow findings and repairs

| Step | User task                        | Finding and repair                                                                                                                                                                                                                                                                                                               | Verification / health                                                                                                                                        |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Open existing history            | The legacy JavaScript selected a month; the port showed all dates and expanded groups. Default is now the latest available month, prominently labeled, with collapsed summaries. All-date, year, and custom-date views are explicit.                                                                                             | Healthy in Chromium and store/component tests.                                                                                                               |
| 2    | Understand income and spending   | Merchant groups swamped the view and repeated singleton rows. Summaries now drill through financial bucket → transaction type → category → merchant, skipping singleton merchant groups. Provider categories are used consistently in reporting and details where no user category exists.                                       | Healthy: browser income drill-down; accounting-grain parity and non-mutation tests.                                                                          |
| 3    | Find and inspect transactions    | No scalable search/filter/sort controls; provider values and long names were truncated in details. Added indexed text search, account/type/category/review/amount/date filters, stable sorting, 100-row pages, CSV export, full details, original values/IDs, and related-record navigation. Search opens matching-item results. | Healthy within documented scale limits: real-history browser search, sort, paging, selection, and CSV download; synthetic 10,000-item tests.                 |
| 4    | Correct a group of transactions  | Legacy group/multi-row editing had no usable selection path in the port. Added selection checkboxes, page/all-filtered selection, and bulk corrections with a server preview. Restored editable word and amount-range conditions.                                                                                                | Selection, filter-reset, scope-validation, and server replay tests.                                                                                          |
| 5    | Manage hundreds of rules         | Rules was an append/reset history viewer, with no CRUD or scalable navigation. Added create/edit/delete, bulk edit/delete, search, field/status filters, sorting, target-name context, and 25-rule pages.                                                                                                                        | Healthy: browser CRUD/reload/bulk lifecycle on isolated data; 431-rule fixture and API/cache tests.                                                          |
| 6    | Understand warnings and effects  | “Resettable,” “Flag,” and “missing transaction target” did not explain actions or consequences. Removed Resettable, used “Mark for review,” and added keyboard/touch-accessible explanatory dialogs. Import/rebuild warnings share the same explanation.                                                                         | Healthy: browser warning dialogs, keyboard checks, and regression tests. Historical unavailable references remain explicitly explained.                      |
| 7    | Preview and save safely          | Editing/deleting requires replay, not an extra reversal of today's matches. Added baseline replay, stable order, before/after previews, stale-snapshot protection, conflict checks, incomplete-history rejection, and rollback on caught write errors.                                                                           | Creation, scope change, precedence, deletion, restart, stale preview, bad targets, concurrent save, and disk-error tests.                                    |
| 8    | Use dialogs, menus, and keyboard | Dialogs could exceed the viewport; menus referenced an undefined background color; suggestions were mouse-only. Added bounded dialog scrolling, opaque menus, keyboard suggestion activation, visible row actions, row-key navigation, and shortcut suppression inside dialogs.                                                  | Healthy in tested Chromium states; 320–1440 px reflow and automated accessibility checks. Other engines and assistive-technology testing remain outstanding. |

## Browser findings and follow-up repairs

- Transaction headings and values used independently sized columns. Shared column
  widths now respond to the actual results-pane width, including when details open.
  Narrow rows retain dates and allow two lines for long names.
- Phone details previously occupied only half the screen. Period navigation and
  selection details now open mutually exclusive, full-width panels.
- Changing result pages left the user at the bottom of the next page. Both rule
  and transaction paging now reveal and focus the start of the new results.
- Controlled dialogs without a trigger lost keyboard focus when closed. Focus now
  returns to the opener; nested help has a regression test. Global shortcuts leave
  modal Escape handling to the dialog rather than also closing its parent editor.
- Narrow rule-condition controls clipped their selected text. They now stack, and
  amount bounds have visible labels and an incoming/outgoing example.
- The Settings directory example overflowed the entire phone page. It now has its
  own keyboard-focusable horizontal scroll region. Helper, amount, and error colors
  were darkened to improve contrast. Invalid expanded-state metadata was removed
  from grid rows; the actual expand buttons retain their accessible state.
- Large-result bulk-edit limits now have visible guidance, not only a hover title.

### Browser verification

- Checked Transactions, Rules, Accounts, and Settings at **320, 390, 768, 1024,
  and 1440 CSS pixels**: no page-level horizontal overflow in those states.
- Automated axe checks for WCAG 2 A/AA and 2.1 AA tags reported zero violations
  in the final sampled states of those four routes. This is not a full WCAG audit.
- Created, edited, reloaded, and deleted a rule affecting 42 transactions; bulk
  edited and deleted two rules affecting three transactions. All were copy-only.
- Selected a misspelled account folder: upload was disabled and **zero import
  requests** were sent. Correcting it enabled upload; the duplicate-file test
  reported 0 new, 1 already present, 0 rejected, and a successful rebuild of
  10,575 transactions with 431 rules.
- Real-history merchant search returned 3,123 matches while rendering only 100
  items. Search-to-results took approximately 179 ms in one local browser run;
  this is illustrative, not a performance guarantee. Sorting, paging, custom
  date bounds, selection, and a CSV download were exercised.
- No browser console warnings/errors or uncaught page errors were recorded during
  the tested application flows. Settings saves were deliberately blocked in the
  browser harness to protect the actual configuration file; production smoke tests
  cover configuration persistence separately in their own isolated environment.

## What was already migrated

- Supported statement parsers, account configuration, overlapping-file deduplication,
  order/payment matching, transfer links, and financial reason semantics.
- Imported-value preservation and all seven correction fields.
- Persisted snapshot loading, independent rules, rebuild/replay, and local backups.
- The old manual Scan/Save workflow became import/rebuild with automatic persistence.
  This is intentional, not a missing save feature.

## Important limits, not hidden parity claims

- The old experimental Etsy/OAuth helpers are not a current direct-connect
  integration. Bank/merchant data still enters through exported statements.
- There is no budget planner, forecast, investment valuation, saved-query/report
  builder, authentication, or immutable per-rule revision browser.
- Rule deletion is recoverable through timestamped aggregate backups, not an
  in-app Undo control. A process crash between two file replacements remains a
  documented persistence boundary; caught write errors now restore both files.
- Full graph data still travels to the browser. Paging bounds rendered rows;
  it does not provide server-side pagination for millions of records.
- The browser pass covers local Chromium, not Firefox, Safari, physical touch
  devices, a screen reader, or an exhaustive browser-zoom matrix.

## Read-only checks against the existing history

The active snapshot contained 10,575 graph records and 431 rules. Its reporting
grain contained 9,286 items (completed children replace parent payments).
Replaying the unchanged rule set produced **zero effective-value differences**,
with no orphaned applied rule IDs. The source snapshot file was unchanged.
All 431 rules also passed the new API compatibility schema, including two
legacy rules with empty field values. A full unchanged-rule preview retained
the 37 unavailable historical references and changed zero effective values.

Final verification passed: **55 test files / 655 tests**, TypeScript checking,
lint, production build, production smoke test, and whitespace checks. A new
regression test also caught and fixed shallow sharing of correction overlays
during quick-edit preflight: failed writes can no longer mutate an already-
corrected live transaction through shared arrays/objects.

One local Node timing run measured approximately 186 ms to initialize the
client store, 49 ms to filter/group all dates, and 9 ms for an indexed merchant
search. The collapsed all-date overview had four rows. These are local
data-model timings, not browser render/network benchmarks or a performance SLA.

## Manual acceptance checklist

1. Run `./run.sh` and open the server's printed URL. Check the latest month and
   collapsed overview; confirm dates remain visible after every filter change.
2. Expand Income → Discounts/Returns and a category. A singleton merchant should
   show a transaction directly. Select it to inspect original values and links.
3. Choose All dates, search an order/merchant, use filters and sort, page through
   results, and export. Selection must clear when filters change.
4. Open Rules, search/filter/sort, inspect an unavailable-reference hint, and
   verify list paging. Try a create/edit/delete preview and cancel: no data changes.
5. On a disposable test data root, confirm create/edit/delete and bulk operations,
   restart, and rebuild. Effects and rule order should persist consistently.
6. Inspect narrow/mobile widths, keyboard-only use, zoom, focus restoration, and
   screen-reader announcements before calling the visual/accessibility audit complete.
