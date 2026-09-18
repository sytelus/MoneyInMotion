# Financial workflow UX review and implementation contract

This review extends the JavaScript/C# migration review in
[ux-migration-review.md](ux-migration-review.md). The scope is the user's complete
workflow, not a replacement financial model. Imported values remain intact;
corrections continue to use the existing saved-rule overlay.

## Evidence and priorities

The existing work was checkpointed and pushed as `722dd3e`. The next review used
local Chromium against an isolated copy, with all non-local browser requests
blocked. Financial screenshots are local review artifacts, never repository
assets. Current-run before screenshots cover these nine steps:

| Step                        | Before evidence        | Health / observed problem                                                                           | Required outcome                                                            |
| --------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Land on existing history | 01-transactions        | Partial: dated collapsed groups exist, but no purposeful overview/reporting destination             | Explicit period, understandable measures, next actions, and drill-downs     |
| 2. Manage accounts          | 02-accounts            | Poor: management buried under large import/rebuild panels                                           | Dedicated account management, search, status, source access                 |
| 3. Modify an account        | 03-account-editor      | Partial: controls exist, consequences for the saved snapshot unclear                                | Explain rebuild requirement and offer next step                             |
| 4. Remove an account        | 04-account-removal     | At risk: preservation warning omits exclusion at next rebuild; preserved folder cannot be recreated | Clear consequences and explicit safe reconnection                           |
| 5. Manage rules             | 05-rules               | Partial: CRUD/search available, recorded matches not inspectable                                    | Trace rule → matched records → effective fields, scope/account organization |
| 6. Edit rule targets        | 06-rule-editor         | Poor: opaque transaction-ID textarea is the primary affordance                                      | Searchable human-readable target picker, advanced IDs only as fallback      |
| 7. Explore transactions     | 07-transaction-list    | Partial: filtering/pagination exist, no linked source/rule/report scope                             | Shareable drill-downs with visible filters, consistent date context         |
| 8. Understand a record      | 08-transaction-details | Poor: no source file, processing explanation, or current correction chain                           | Source facts, qualified timestamps, current winning/overridden rules        |
| 9. Correct selected records | 09-selected-edit       | Poor: “Create rule” terminology; different single/batch safety paths                                | One correction workflow, preview, back-to-draft, clear result               |

The same review inspected legacy capabilities and current server/model code.
An affordance is not considered complete merely because an endpoint exists.
The user must discover the action, understand its scope, see a result, and have
an actionable recovery path when it fails.

## Navigation and lifecycle

- **Overview** (`/`): date-scoped recorded activity, cash-flow-style trend,
  spending/incoming breakdowns, review queues, source-account contributions,
  linked transfers, aggregate export, and printable output.
- **Transactions** (`/transactions`): filter, sort, inspect, correct selected
  records, compare source/current values, and export an explicitly stated scope.
- **Imports** (`/imports`): folder preflight, upload/rebuild result, current source
  inventory, retained upload receipts, and links to the relevant source records.
- **Accounts** (`/accounts`): configure, modify, remove configuration, reconnect
  a preserved folder, and inspect account records.
- **Rules** (`/rules`): create/edit/duplicate/delete, organize/filter/search,
  inspect current effects, bulk-change, and export.
- **Settings** (`/settings`): the existing single config-file source of truth;
  no environment-variable configuration is reintroduced.

The normal path is configure → import → inspect result → review exceptions →
correct → inspect rules → analyze → export. Every destination must also work
when entered directly, including a pre-existing history with no upload receipts.

## Data truth and terminology

1. **Reporting items are not all graph records.** Completed order children
   replace their parent payment; incomplete orders retain their parent once.
   Reports use this grain. Source inspection includes both and must not add
   their amounts as spending. Hidden parent review marks remain discoverable.
2. **Recorded credits/debits are not income/balance.** Credits may include
   discounts and returns. Transfers and unmatched order details are outside net
   recorded activity. The app does not know opening balances or complete coverage.
3. **Source account is not necessarily funding account.** An Amazon order line
   can be the reporting item for a card payment. Source-account contribution is
   not labeled a bank cash-flow statement.
4. **Filesystem dates are not import dates.** Existing `ImportInfo` dates come
   from file birth/modified times. Record audit dates can be regenerated on
   rebuild/replay. Producer strings do not identify authenticated people.
5. **The import-info hash is not a byte checksum.** The existing import ID/hash
   is path-derived. Only retained upload manifest SHA-256 values describe bytes.
6. **Saved rules are current state, not a historical log.** Recorded matches
   need not imply a changed effective value; later rules can override fields.
   Sorting the rule list never changes application precedence.
7. **Currency is absent from the financial model.** Existing dollar formatting
   is a presentation convention, not proof that all source amounts are USD.
   No conversion, currency inference, or balance reconciliation is introduced.

## Shared implementation contracts

- `lib/transaction-navigation.ts` owns the typed URL view contract, including
  date/account/category/merchant/activity, source import ID, applied rule ID,
  linked record IDs, and reporting versus source-record basis.
- `hooks/useTransactionNavigation.ts` owns browser back/forward and debounced
  replace-state for filter changes. Selection is not silently made a filter.
- `store/transactions-store.ts` caches the reporting population and full record
  search index. Search/filter changes clear stale selection; rendering is paged.
- `lib/financial-reports.ts` owns pure calculation semantics; report components
  render those results rather than implementing alternative accounting logic.
- `lib/rule-effects.ts` and `lib/transaction-provenance.ts` derive explainable
  facts without altering stored data.
- `TransactionEditWorkflow` is shared by single, multiple, and batch corrections.
  Server previews and revision checks remain authoritative; returning from a
  preview preserves the editor draft.
- `TransactionExport` declares rows, period, basis, and optional provenance before
  downloading. CSV escapes source text against spreadsheet formula execution.
- Import history reads existing manifests only; it is not a new journal.

Do not introduce persisted fields merely for presentation. New local component
state, URL filters, read-only APIs, and derived groupings do not change the
financial schema. Keep pure transformations independently tested and keep page
composition separate from parsers, aggregation, and file access.

## Enhancements that require user review — not implemented implicitly

| Proposed metadata                                                                                               | Where it would come from                                                                                         | Capability / historical limit                                                                                                 |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Immutable import/rebuild event journal: operation ID, start/end, file digests, parser version, outcomes, counts | Generated by this app during future upload/rebuild operations                                                    | Exact “when/how imported” timeline; cannot reconstruct past events from filesystem dates                                      |
| Every source occurrence contributing to a merged transaction                                                    | Parser/merge captures each file/row before deduplication                                                         | Explain overlapping imports and duplicates; older discarded occurrences may be unrecoverable without rebuilding               |
| Immutable rule revisions/events and affected-record summary                                                     | Generated locally on future rule create/edit/delete                                                              | Explain changes over time and support audited undo; current mutable rule definitions are not sufficient                       |
| Rule names/tags/folders/disabled state                                                                          | Explicit user input                                                                                              | Persistent organization beyond computed filters; disabled state affects application semantics and needs preview/replay design |
| Currency and statement coverage/balance metadata                                                                | Parse only when the institution actually supplies it; otherwise explicit user-supplied currency, with provenance | Safe multi-currency and reconciliation; transaction-only CSVs usually cannot supply balances or coverage                      |
| Durable manual match/unmatch decisions                                                                          | Explicit user decisions stored separately from imported values                                                   | Reliable reconciliation overrides across rebuilds; transient link mutation would be unsafe                                    |

User decision: keep this UX phase schema-free. All metadata enhancements above
remain deferred. Review the local import/rebuild and rule-history journal as a
separate proposal; this decision does not authorize its implementation.

The current UX must use existing data and clearly explain missing historical
evidence. Any future journal would record app-generated events prospectively;
never invent historical events or ask users to provide facts their statement
exports do not contain.

## Verification and acceptance checklist

Each implementation should be verified with pure/component/server tests and
local production browser exercises. The executed results below qualify this
checklist; it is not a claim that every possible interaction has been tested.

- Existing history opens an informative period-scoped Overview, not onboarding.
- Overview figures and transaction drill-downs agree for the same scope.
- Source/rule/linked-record views reveal parents hidden by reporting grain.
- Flags, unmatched and incomplete matches explain meaning and next steps.
- Account changes explain rebuild consequences; removal preserves raw files and
  reconnection is explicit, validated, and does not overwrite configuration.
- Bad folder names and unsupported uploads are rejected before upload bytes.
- Import results distinguish staged files, parsed files, snapshot commit, record
  counts, unresolved rule targets, and historical information not retained.
- Single/multiple correction scopes are explicit; keyboard shortcuts never
  silently edit only the first selected record.
- Returning from preview keeps the draft; stale previews cannot commit.
- Rule inspection distinguishes matches, effective fields, and overridden fields.
- Exported selection, filters, basis, provenance, and safe CSV values are tested.
- Desktop/mobile, keyboard, dialog focus, overflow, loading/empty/error states,
  and automated accessibility checks are exercised. Automated checks do not
  establish accessibility conformance on their own.
- Live configuration, snapshot, rules, and statements remain unchanged during
  tests. Data-changing browser exercises use an isolated copy only.

## Executed verification — September 17, 2026

The implementation was reviewed across accounts/imports, rules/provenance, and
reporting, then integrated and exercised using local Chromium with the production
build. The browser used an isolated copy of existing history (over 10,000 graph
records and 400 rules). Its network access was restricted to the isolated local
server; configuration writes were blocked at that server boundary. SHA-256
checks confirmed that the live snapshot, rules, and user configuration were
unchanged. Statement mutations were confined to the copied directory.

### Automated checks

- `npm test`: **63 test files, 724 tests passed** in the current repository
  verification (the original browser journey was completed before the later
  configuration and HTTP-boundary regressions were added).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed, including production frontend and server output.
- `npm run smoke:production`: passed, including direct SPA navigation to all
  six destinations and restart behavior against isolated test data.
- `git diff --check`: passed.

Regressions cover UTC-offset dates, URL drill-downs and browser history, stale
source links, single/multiple keyboard edit scope, preview draft preservation,
configured accounts without transactions, original-identity reconnection,
non-additive parent/detail selections, source inventory navigation, receipt
refresh after upload, and collapsed rendering over a synthetic 10,000-record set.
The focused guides describe additional server validation and calculation tests.

### Browser journey results

After screenshots are named beneath the local `lifecycle-after` evidence
directory; screenshots can contain private financial details and are deliberately
excluded from Git. The handoff identifies the local archive location.

| Journey                                       | Result and evidence                                                                                                                                                                                                                       | Remaining qualification                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Open existing history and drill into activity | Healthy: period-scoped Overview; debit drill-down agreed on both count and amount. `23-overview-final.png`                                                                                                                                | Recorded activity is not an account balance; coverage and currency limits remain visible.            |
| Trace a transaction and inspect its rules     | Healthy: statement/file/row evidence, current correction chain, rule inspection, and all matched source-record navigation. `02-transaction-provenance.png`, `03-rule-inspection.png`, `19-transaction-final.png`                          | Current evidence does not reconstruct an immutable historical timeline.                              |
| Correct selected records                      | Healthy: multi-record note preview, Back-to-draft, and save exercised on the copy. `04-batch-edit.png`                                                                                                                                    | Corrections remain saved-rule overlays; source records are not rewritten.                            |
| Reject bad folders before upload              | Healthy: misspelled folder produced a blocking explanation and zero upload POSTs. `09-preflight-rejected.png`                                                                                                                             | Local preflight cannot establish that statement content will parse.                                  |
| Import and understand the outcome             | Healthy: duplicate upload, unchanged snapshot count, file outcomes, rule-processing count, and subsequent receipt refresh verified. `10-import-result.png`, `21-upload-receipt-final.png`                                                 | A retained receipt proves file handling, not a historical rebuild outcome.                           |
| Find a statement's records                    | Healthy: searchable, paged source inventory with explicit coverage and links. `22-statement-sources-final.png`                                                                                                                            | Only provenance surviving in the current snapshot is represented.                                    |
| Remove and reconnect account configuration    | Healthy: preserved folder reconnected using its original logical ID even when the folder name differed. `08-removal-warning.png`, `16-reconnect-original-account.png`                                                                     | Removal excludes the account on the next rebuild; unknown identity still needs original settings.    |
| Export and print                              | Healthy: selected-record CSV downloaded and parsed with the expected rows and original/source fields; daily/monthly report print output visually checked. `selected-export.csv`, `report-latest-print.pdf`, `report-all-print.pdf`        | Exports follow the declared record basis; no unsupported balance or currency conversion is inferred. |
| Use narrow/mobile layouts                     | Healthy: 390-pixel layouts checked for Overview, Accounts, Imports, Rules, and transaction details; no horizontal page overflow. `12-overview-mobile.png`, `13-accounts-mobile.png`, `14-imports-mobile.png`, `20-rules-mobile-final.png` | This is not exhaustive testing of every device/browser or assistive technology.                      |

Automated axe checks reported no violations on the exercised Overview, Accounts,
Imports, Rules, upload receipt, and single/multiple transaction-detail states.
They identified transaction heading, filter-label, and table-header issues during
review; these were fixed and the final states rechecked. Automated checks do not
establish WCAG conformance. A test-harness attempt to inject an inline script was
correctly blocked by the application's content security policy; the policy was
not weakened to accommodate the harness.

### Deliberate limits and follow-up boundaries

- The transaction graph is still loaded into the client. Cached search/derived
  populations and bounded rendering address the tested history, not arbitrary
  data volume. Pagination is not a server-side database query implementation.
- Receipt history still scans retained manifests before filtering/paging. A
  large archive will need a separately designed index or storage strategy.
- Charts show a bounded set of active days/months with an explicit truncation
  note. Exact figures and report exports cover the full selected scope.
- The exact original import timeline, immutable rule history, durable manual
  reconciliation, persistent rule folders/tags, and multi-currency/balance
  reporting remain the review proposals above, not hidden schema changes.
- This work supports removal of account configuration, with raw-file preservation
  and recovery. It does not silently introduce destructive financial-data deletion.

The earlier checkpoint `722dd3e` was committed and pushed before this work.
This lifecycle implementation is a separate working-tree change at handoff.
For future maintenance, repeat the checks above and use synthetic or isolated
data for every account/rule/import mutation exercised in a browser.
