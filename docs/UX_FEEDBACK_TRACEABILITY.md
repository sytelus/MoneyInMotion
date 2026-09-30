# UX feedback traceability and MoneyInMotion adaptation

This register extracts the critiques, requested improvements, constraints, and
review expectations from the conversation that led to this guide. Repeated
feedback is consolidated without dropping its concrete examples. Wording below
is a normalized paraphrase unless quoted; garbled pasted characters are omitted.
The image references in the conversation establish the reported problem, not
newly measured contrast or fresh screenshot evidence.

The [general-purpose guide](UX_DESIGN_GUIDE.md) defines stable UX principle IDs.
The [review template](UX_REVIEW_TEMPLATE.md) records fresh evidence and closure.
An entry here means **a requirement to review**, not **verified complete**.
Existing implementation and historical verification live in the linked product
documents. Do not convert prior assistant claims of completion into new proof.

## Feedback register

### Orientation, configuration, imports, and existing data

| ID  | Feedback or review item supplied by the user                                                                                                      | Generalized principle and acceptance question                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Explain the latest change, where data is expected, and how to test it.                                                                            | UX-02, UX-20: Does the handoff identify the change, canonical data/config location, reproducible test path, and expected result?  |
| F02 | Resolve `mim_root` versus the mistaken `min_root` terminology.                                                                                    | UX-02, UX-08: Are names, examples, defaults, and compatibility explanations consistent across UI, scripts, and docs?              |
| F03 | Environment overrides are confusing; use `~/.moneyinmotion/config.json`, view/edit/save it in the UI, and read application settings only from it. | UX-02: Can the user identify one authoritative source for a setting and distinguish saved from active values?                     |
| F04 | Clarify nested `AccountConfig.json`; simplify to one top-level account folder while allowing recursive statement folders.                         | UX-01, UX-02: Is the ownership model simple, consistently enforced, and explained before import?                                  |
| F05 | Misspelled import folders must be fixed before upload; pre-check in the UX and send no files on failure.                                          | UX-12: Does invalid selection identify the mismatch, block the request, and produce zero import mutations?                        |
| F06 | Show import statistics and what actually happened afterward.                                                                                      | UX-13: Can the user distinguish submitted, excluded, duplicate, promoted, failed, and rebuilt outcomes and inspect affected data? |
| F07 | Explain how to try the website as a production user.                                                                                              | UX-19, UX-20: Are the startup command, URL, prerequisites, data location, and expected user flow clear?                           |
| F08 | Make `./run.sh` default to production and build stale output or warn.                                                                             | UX-19: Does the actual running API/site match the intended release, with stale/missing output handled visibly?                    |
| F09 | Existing accounts and statements should not lead to an unhelpful Get Started/import screen with no usable history.                                | UX-01, UX-02: Are existing records accessible, and are statements-without-a-built-view distinguished from a truly empty setup?    |
| F10 | Rules appeared empty despite rules in existing imported data.                                                                                     | UX-02, UX-14: Are saved rules loaded independently where appropriate, and are failed/missing reads distinguished from no rules?   |
| F11 | Diagnose underlying causes and fix similar problems, not just the reported empty screen.                                                          | UX-02, UX-20: Were active root, configuration, data, API, cache, and sibling workflows checked before changing copy?              |

### Transactions, summaries, and collection scale

| ID  | Feedback or review item supplied by the user                                                              | Generalized principle and acceptance question                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| F12 | Check important features against the original JavaScript and C# apps.                                     | UX-01: Is there a workflow-level parity map with intentional replacements and unresolved gaps, not merely an endpoint inventory?              |
| F13 | Never show transactions without their date range.                                                         | UX-03, UX-04: Is period/scope visible initially and after filtering, drilling down, navigating Back, or exporting?                            |
| F14 | Start with summaries, not everything expanded into repeated “Discount - Amazon Order#” rows.              | UX-03, UX-05: Does the first screen communicate useful totals/groups and let the user selectively expand details?                             |
| F15 | Income contains discounts/returns; use types, categories, and other data to produce meaningful summaries. | UX-04: Are unlike concepts separated and aggregates labeled according to their true financial meaning?                                        |
| F16 | Do not require expansion to see the same single item again.                                               | UX-03, UX-05: Can redundant singleton wrappers be flattened without hiding meaningful source relationships?                                   |
| F17 | Keep data untouched while the UX detects and simplifies presentation.                                     | UX-04, UX-18: Are grouping, labels, and view projections independent of immutable source values?                                              |
| F18 | Thousands of transactions over years need search, filtering, and sorting.                                 | UX-06: Can users locate a relevant record and understand the search/filter/sort scope at representative volume?                               |
| F19 | The experience must remain fast and responsive as history grows.                                          | UX-19: Were common interactions measured with realistic records/rules, including rendering and data transfer rather than only pure functions? |
| F20 | Use colors and icons to make the app approachable.                                                        | UX-09: Do semantic visual cues improve recognition while remaining readable and understandable without color?                                 |

### Rules, edits, and understandable behavior

| ID  | Feedback or review item supplied by the user                                                                                                  | Generalized principle and acceptance question                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F21 | There was no usable way to create, edit, or delete existing rules.                                                                            | UX-01, UX-15: Are the complete rule lifecycle and its results discoverable from the catalog?                                                                      |
| F22 | Hundreds of rules need organization, search, filters, sorting, and mass editing.                                                              | UX-06, UX-15, UX-16: Can a large catalog be narrowed, compared, selected, and changed with explicit scope?                                                        |
| F23 | “1 missing transaction target” needs a popup explanation, not an unexplained alarming count.                                                  | UX-08, UX-10, UX-14: Can keyboard/touch/mouse users learn what is unavailable, the consequence, and safe repair options without assuming money is missing?        |
| F24 | “Resettable” labels do not explain what they mean.                                                                                            | UX-08, UX-15: Are reset/restore/delete distinctions named by their actual effect and explained before commitment?                                                 |
| F25 | “Flag” in Changes is unclear.                                                                                                                 | UX-08, UX-09: Does the interface say what marking for review does, how it is displayed, and whether it affects calculations?                                      |
| F26 | Users must understand the results of rules.                                                                                                   | UX-14, UX-15: Can they inspect conditions, matched records, effective changes, overrides, precedence, and unavailable evidence?                                   |
| F27 | Support editing a single transaction, several transactions, or a whole selected batch.                                                        | UX-16: Are selection scope/count, mixed values, preview, cancellation, and conflict handling coherent across all entry points?                                    |
| F28 | Rules are oversized cards even when they only correct one transaction; use a compact grid with impact grouping/sorting and expandable detail. | UX-05, UX-06, UX-15: Does the catalog expose useful comparisons without allowing one-off corrections to consume the screen or confusing match count with purpose? |
| F29 | Reduce clicks and wasted screen space in the most likely scenarios.                                                                           | UX-05, UX-07: Have the common paths been walked and unnecessary wrappers/navigation removed without removing required safety checks?                              |

### Whole-lifecycle capabilities and trustworthy data

| ID  | Feedback or review item supplied by the user                                                                                                                | Generalized principle and acceptance question                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| F30 | Review the entire lifecycle: account setup/modification/deletion, import, fixing, management, analysis, and understanding finances.                         | UX-01, UX-11: Can a user complete the lifecycle, including maintenance and recovery, without hidden required tools?                               |
| F31 | Analyze import results, not merely accept a file upload.                                                                                                    | UX-12, UX-13: Do results separate file handling from snapshot processing and lead directly to exceptions and affected records?                    |
| F32 | Track how a transaction came into being: source, process, and import timing.                                                                                | UX-14, UX-18: Is each claimed fact supported, with source links and an explicit distinction between recorded events and unknown historical times? |
| F33 | Provide useful reports.                                                                                                                                     | UX-04, UX-17: Do reports answer real questions, state their basis/period, and reconcile with drill-down records?                                  |
| F34 | Provide exports.                                                                                                                                            | UX-06, UX-17: Can users choose and understand selected/filtered/full scope, with labels and values matching the analysis?                         |
| F35 | Consider cash-flow views, account interactions, flags, and other useful visualization aids.                                                                 | UX-09, UX-17: Do visuals clarify supported trends/relationships and expose review items without inventing balances or movements?                  |
| F36 | This phase is primarily missing UX capabilities, not a redesign of data or schemas.                                                                         | UX-18: Was the capability implemented through existing data/view projections where possible, preserving domain meaning?                           |
| F37 | If schema enhancements are needed, list them and ask for review; explain where the data would come from because institutions supply only their own exports. | UX-18: Does each proposal state benefit, source, historical limits, compatibility, and required approval before implementation?                   |
| F38 | Explicitly keep the phase schema-free and review the import/rule history journal separately.                                                                | UX-18: Is the journal still a separate proposal, with no implicit authorization or fabricated historical events?                                  |
| F39 | Make the list of schema enhancements and their corresponding UX benefits easy to find.                                                                      | UX-18, UX-20: Is there one linked proposal register rather than conflicting lists or a hidden implementation assumption?                          |

### Copy, visual design, layout, and affordances

| ID  | Feedback or review item supplied by the user                                                                                               | Generalized principle and acceptance question                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F40 | Apply hints, indicators, and good affordances everywhere so users are not confused and training effort is reduced.                         | UX-08, UX-09, UX-20: Were shared components and sibling screens reviewed, with help accessible beyond hover?                                                                                               |
| F41 | “Disconnected-folder check unavailable: API endpoint not found. Configured accounts are still shown below.” is low contrast and confusing. | UX-02, UX-09, UX-10: Is the cause investigated, the affected capability explained, working data retained, and recovery readable without leaking raw transport jargon?                                      |
| F42 | Duplicate an account or copy settings in Add Account, but never save until the user edits/reviews and confirms.                            | UX-11: Does Duplicate open a clearly unsaved draft with safe new identity, and does Cancel send no mutation request?                                                                                       |
| F43 | The palette remained poor after previous fixes: low contrast, boring, and too sparingly used.                                              | UX-09, UX-20: Were actual rendered foreground/background pairs and visual hierarchy rechecked across pages/states instead of assuming the earlier token change solved everything?                          |
| F44 | Prefer “Configure folder/account” over the non-obvious “Reconnect folder.”                                                                 | UX-08: Does terminology describe the user's task instead of an internal system state?                                                                                                                      |
| F45 | Use wider screens better, for example stats left, main content center, warnings/tasks right on Accounts.                                   | UX-05, UX-10: Does layout exploit available width while keeping primary work central and essential warnings visible when panels collapse?                                                                  |
| F46 | “Inspect account records” could simply be “View transactions”; do not obscure meaning while trying to simplify language.                   | UX-08: Are action labels direct, familiar, precise, and consistent?                                                                                                                                        |
| F47 | Replace unnecessarily large edit warnings with an informative action such as “Save and rebuild.”                                           | UX-10, UX-13: Are routine consequences in the action/help while real risks and partial success remain explicit?                                                                                            |
| F48 | Matching-name help should explain concrete purchase/payment matching, not abstract “name fragments” or “parent-charge” terminology.        | UX-08: Does the helper describe supported matching behavior in practical terms and show a valid comma-separated example?                                                                                   |
| F49 | “File filters” should explain comma-separated patterns and ignored files, with examples.                                                   | UX-08, UX-12: Is syntax and exclusion behavior clear, and are examples limited to formats actually supported? The suggested `*.xls` illustrates desired clarity, not authorization to claim Excel support. |
| F50 | Show annotated folder hierarchy and file counts per account, or provide a Statements explorer.                                             | UX-14, UX-17: Can users browse actual inputs, understand counts/eligibility/exclusions, and reach supported transaction evidence?                                                                          |

### Review discipline, safety, documentation, and handoff

| ID  | Feedback or review item supplied by the user                                                                                                 | Generalized principle and acceptance question                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F51 | The listed UX problems are examples; perform a complete audit and find other related issues.                                                 | UX-01, UX-20: Did the review cover the lifecycle/state matrix and adjacent surfaces rather than only the named screenshot?                                                                  |
| F52 | Make work fully documented, readable, maintainable, carefully reviewed, and consistent with good coding standards.                           | UX-20: Are rules, calculations, tokens, and flows shared appropriately, with useful comments, regression tests, and updated contracts?                                                      |
| F53 | Review all code, data, config, docs, and other files; resolve conflicts, simplify, fix bugs, add important tests, and remove stale ones.     | UX-19, UX-20: Do technical boundaries support the experience, and do code, tests, docs, and operational behavior agree? Do not rewrite unrelated files without a reason.                    |
| F54 | Local Chromium was approved, with screenshots kept local and mutations tested on an isolated copy.                                           | UX-20: Is browser evidence captured safely without modifying live financial data or publishing private screenshots? Approval for local inspection is not approval for external publication. |
| F55 | “Is the work done? Can I try the updated website?” and requests for summaries and next recommendations.                                      | UX-19, UX-20: Does the handoff separate implemented, verified, untested, and deferred work and explain how to try it?                                                                       |
| F56 | Repeated requests to commit and push, including checkpointing existing changes.                                                              | UX-20: Report actual repository/release state and perform version-control actions only when authorized for that task; historical requests are not standing permission.                      |
| F57 | Review all prior feedback so the same problems do not recur; create a general-purpose guide usable for self-review and update documentation. | UX-20: Are feedback → principle → acceptance evidence traceable, and are future reviews instructed to use and refine these documents?                                                       |

### Recovery feedback added after the original synthesis

| ID  | Feedback or review item supplied by the user                                                                                                                                     | Generalized principle and acceptance question                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F58 | Add full backup/restore in Settings for corruption/development recovery; default to a username/date ZIP in home, browse for restore, return to the saved state, and document it. | UX-01, UX-02, UX-11, UX-12, UX-13, UX-20: Are scope/location clear, replacement reviewed, current data retained, and the byte/state round trip verified without rebuilding? |

## MoneyInMotion adaptation

These are project contracts/preferences, not universal design laws:

- **Configuration:** application settings use `~/.moneyinmotion/config.json`;
  account definitions retain `Statements/<account>/AccountConfig.json`. This is
  a defined ownership boundary, not a competing override for the same setting.
  View filters belong in navigation/UI state. The default root is `mim_root`;
  `min_root` is only a historical misspelling where explicitly identified.
- **Account ownership:** one top-level folder per account. Statement subfolders
  may recurse; nested configs do not create accounts. Account identity must
  remain compatible with existing transactions and exact-target rules.
- **Initial experience:** existing data should open a period-scoped Overview;
  users can drill into transactions, sources, rules, and review queues. New or
  incomplete setup needs a targeted recovery path, not misleading empty history.
- **Visual direction:** use a readable, expressive semantic palette with color
  and icons reinforcing meaning. The user suggested a three-region wide layout;
  use it where it helps, not on every screen. The current app has a complete
  light theme; a future dark theme requires complete, separately verified states.
- **Density:** compact rule rows with expandable detail and meaningful impact
  sorting; collapse initial transaction summaries and avoid redundant singleton
  wrappers. Display sort must never change rule execution order.
- **Copy:** use direct task labels and concrete, truthful examples. CSV, JSON,
  and IIF are current parser formats; the user's illustrative Excel example does
  not change that contract. Filename eligibility is not proof of parseability.
- **Financial truth:** preserve imported values, distinguish credits from earned
  income, do not add parent payments to their complete children, and do not label
  source-account activity as a bank balance or verified funding cash flow.
- **History:** distinguish source/file/record times and existing receipts; do not
  fabricate first-import times, rule revisions, byte hashes, or missing matches.
  Keep the phase schema-free. The
  [existing enhancement proposal register](UX_LIFECYCLE_REVIEW.md#enhancements-that-require-user-review--not-implemented-implicitly)
  remains the sole proposal list; the journal is separately deferred.
- **Verification and release:** test the production website with isolated writes,
  keep financial captures local, report limits honestly, and explain restart/build
  requirements. Do not commit/push or publish evidence without current authority.

## Current contracts and evidence

Use [accounts/imports](accounts-and-imports-ux.md),
[rules/provenance](rules-and-provenance-ux.md),
[financial reports](financial-reports.md), and
[transaction edits](transaction-edits.md) for current behavior. Use
[testing and verification](testing-and-verification.md) for executed checks and
[limitations](legacy_limitations.md) for what remains unsupported.

The migration, lifecycle, density, and repository-quality reviews are dated
evidence and rationale. They do not replace a new browser audit or create a
standing guarantee that a requirement is satisfied in every later revision.

## Keeping the register useful

For new feedback, append an F ID, retain its concrete example, map it to a UX
principle, and write an observable acceptance question. Use a review record to
track current implementation/verification status rather than freezing that status
in this register. If an issue recurs, record why the previous check missed it and
improve the guide, shared implementation, or test—not just that one occurrence.
