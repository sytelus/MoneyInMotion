# UX design and self-review guide

This is a reusable guide for reviewing and improving data-rich applications.
It generalizes the user's repeated critiques: useful capabilities must be
discoverable, information must be understandable, routine work must be efficient,
and the interface must earn trust through accurate state and clear consequences.
Visual polish and functional completeness are complementary, not substitutes.

Use this guide for new features, migrations, bug fixes, and design reviews. It
does not prescribe a framework, storage format, fixed layout, or branded palette.
Adapt examples to the product's users, vocabulary, data, and risk. Mark a principle
not applicable only with a reason; do not silently skip it.

Companions:

- [Feedback traceability](UX_FEEDBACK_TRACEABILITY.md): the originating critiques,
  MoneyInMotion-specific constraints, and acceptance checks.
- [Review template](UX_REVIEW_TEMPLATE.md): a reusable working document for the
  evidence → diagnosis → refinement → verification loop.
- [Documentation index](README.md): current product behavior, implementation
  contracts, historical reviews, and deferred proposals.

These principles are requirements for review, not claims that the current app
passes every check. A prior screenshot, test count, or successful build is not
fresh evidence of usability.

## Quick review

Before approving a screen or flow, answer these questions from the user's view:

1. Where am I, which data am I seeing, and what period or scope applies?
2. What important task can I complete here, including with existing data?
3. Can I find the relevant item quickly in a realistic, large collection?
4. Does the initial view summarize meaning before exposing details?
5. Do labels, indicators, numbers, and relationships explain themselves?
6. What will this action change, for which items, and when will it take effect?
7. Are preventable mistakes caught before consequential work starts?
8. Can I tell what succeeded, failed, changed, or remains unknown afterward?
9. Can I recover, revise a draft, retrace a result, and retain my context?
10. Does it remain readable and usable across widths, input methods, and states?
11. Is every factual claim supported by real data rather than inferred certainty?
12. Have I verified the real workflow and documented the limits of that evidence?

## UX-01: Complete user journeys

Start from outcomes rather than a list of screens or backend endpoints. Map
setup → acquire/import → inspect → correct → organize → analyze → export →
maintain/recover. Include returning users and users bringing an existing dataset.

- Inventory create, view, edit, duplicate, remove, and recovery actions wherever
  they make sense. A backend capability without a discoverable UI is a gap.
- During migration, compare important legacy workflows, not just data models.
  Record each as available, intentionally replaced, deferred, or missing.
- Count a capability as complete only when the user can discover it, understand
  its scope, execute it, inspect the result, and recover from failure.
- Verify a realistic end-to-end journey, not only isolated controls.

## UX-02: Respect existing state and configuration

Do not equate missing recent activity with an empty account or dataset.

- Distinguish genuinely new, already configured, existing inputs but no built
  view, existing records, missing metadata, filtered-empty, loading, and failed
  reads. A read failure is not evidence of zero records.
- Show an existing-data workspace when data is available; offer setup only for
  the missing prerequisite. Never require re-import just to discover history.
- Give each setting one canonical source. Explain where users can inspect and
  change it; avoid hidden environment or legacy overrides.
- Distinguish saved configuration from active configuration and identify restart
  or rebuild requirements. Diagnose wrong scope/root and API/build mismatches
  before blaming the user or hiding existing data.

## UX-03: Establish scope before showing details

Use summary-first entry points with a visible path to detail.

- Show the period, account/entity scope, active filters, and data basis beside
  the results they govern. Make all-history views explicit.
- Choose a useful default from the available data, not an arbitrary current date
  that makes old but valid history appear empty.
- Start large hierarchies collapsed at a meaningful summary level. Let the user
  selectively expand relevant groups.
- Skip redundant one-child wrappers when they add no information or action;
  retain meaningful relationships in detail. Change presentation, not source data.

## UX-04: Make summaries truthful and meaningful

Every aggregate needs an understandable population, unit, and interpretation.

- Use existing categories, types, relationships, and metadata before inventing
  generic buckets. Separate conceptually different credits or activities.
- Prevent double counting of parent/detail records, mirrored relationships, or
  alternate breakdowns. State which record population is being counted.
- Do not label a partial observed measure as a complete balance, income, or
  outcome that the data cannot establish.
- Distinguish selected dates from actual record coverage, zero from unknown,
  and complete totals from truncated results.
- Follow a summary into its detail and compare the scope, count, and amount.

## UX-05: Use space according to task and information density

More whitespace is not automatically clearer; a denser screen is not
automatically more efficient. Optimize scanability and common tasks together.

- Give the main task visual priority. On wide screens, independent summaries
  and attention items may occupy side panels while work stays in the center.
  On narrow screens, reorder or collapse secondary panels without hiding blockers.
- Use tables for repeated comparable records, cards for genuinely distinct
  summaries, and trees for hierarchy. Do not turn hundreds of near-identical
  records into tall cards.
- Put frequent actions and distinguishing fields within easy reach; disclose
  long descriptions, technical IDs, and infrequent metadata on demand.
- Count common-path clicks and scan distance. Remove needless expansion and
  navigation, but retain safety steps for risky actions.
- Check long names, real warnings, sparse data, and dense data at each layout.

## UX-06: Design collections for growth

Review against hundreds of rules and years of records, not a tiny demo.

- Provide search, meaningful filters, stable sorting, visible result counts,
  and bounded rendering through paging or another justified mechanism.
- Expose active filters and a clear way to reset them. Distinguish no matching
  results from no stored data.
- Choose a default order that helps users find important work; offer other
  orders rather than permanently burying less common items.
- Group or filter by purpose and impact when useful. An item's current match
  count does not necessarily establish its intended purpose.
- Label whether search, sort, selection, and export apply to the current page,
  loaded items, or the full filtered result set.

## UX-07: Preserve navigation and working context

Drill-down should deepen understanding, not make users start over.

- Preserve relevant scope through summary → list → record → source/rule links.
  If a transition changes scope intentionally, say so visibly.
- Make browser Back, reload, direct links, and bookmarks behave predictably.
  Store navigable view state appropriately; do not confuse it with configuration.
- Retain unsaved drafts when returning from preview. Clearly define when a
  filter or scope change clears selection, and prevent stale selections.
- After paging, reveal the new results and provide sensible keyboard focus.
- Avoid dead ends: give record, source, relationship, and rule views a route
  back to the task that led there.

## UX-08: Use precise language and accessible explanations

Prefer familiar action verbs and concrete objects over internal implementation
terms, euphemisms, or attempts to sound friendly at the expense of clarity.

- Label the outcome: “View transactions,” “Configure account,” “Mark for review.”
  Do not expose endpoint names as the user-facing vocabulary.
- Explain what an input matches or controls, its syntax, and a valid example.
  Examples must describe supported behavior, not merely resemble it.
- For unfamiliar indicators, explain meaning, why they appear, consequence,
  and available action. Do not leave unexplained “Flag” or “Resettable” labels.
- Put essential guidance inline. Supplement it with hover help that is also
  reachable by keyboard and touch; hover cannot be the only access path.
- Keep terminology consistent across controls, notices, reports, and docs.

## UX-09: Build an accessible, expressive visual system

Use color and icons deliberately to create hierarchy, make status recognizable,
and reduce reading effort. “Modern” should describe a usable result, not a style
label used in place of evidence.

- Define semantic foreground/background/border pairs for information, success,
  warning, error, and primary actions. Reuse them consistently.
- Measure contrast in rendered states, including tinted panels, selected rows,
  focus, hover, disabled controls, overlays, and charts. Review each supported
  theme as a whole; system preferences must not produce mixed-theme surfaces.
- Combine color with text, shape, position, or icons. Do not encode important
  distinctions in hue alone. Icon-only actions still need accessible names.
- Use readable typography, alignment, spacing, and restrained emphasis; vibrant
  accents must not make the data harder to scan.
- Verify keyboard navigation, focus visibility/restoration, touch access,
  labels, zoom/reflow, dialog scrolling, and status announcements. Automated
  accessibility checks and screenshots do not prove full conformance.

## UX-10: Explain problems and use warnings proportionately

A message should answer: what happened, what it affects, what stayed safe, and
what the user can do next.

- Separate information, routine consequences, actionable warnings, and blockers.
  A routine rebuild can belong in “Save and rebuild” rather than a giant warning.
- Preserve prominent warnings for material risks, such as excluding history or
  applying a change to many items. Do not hide them merely to reduce clutter.
- Translate transport errors into user-relevant consequences and recovery.
  Offer safe diagnostic detail separately; do not assert an unverified cause.
- Keep working features available when an optional check fails. Unknown evidence
  must be labeled unknown, not silently substituted with success or zero.
- Place validation near the field, retain entered values, and make retry useful.
  Repeated notices should lead to an attention queue, not drown the main task.

## UX-11: Make creation, duplication, and removal intentional

- Make copied settings an unsaved, editable draft. Generate or request a new
  identity safely; never create an item merely because Duplicate was clicked.
- Show inherited values and defaults. Cancel must have no persistence side effect.
- Explain locked fields, especially stable identifiers referenced by other data.
- Name the actual removal boundary: configuration, source files, generated
  records, or all data. Explain deferred effects such as the next rebuild.
- Offer recovery only when supported. If restoration requires backup or original
  identity, say so; do not imply an in-app undo that does not exist.
- Distinguish report exports from full recovery archives. Declare included and
  excluded state, backup location, trust/privacy limits, and whether restoration
  replaces or merges data. Validate before replacement, retain a recovery path,
  and test a round trip without silently rebuilding the restored state.

## UX-12: Preflight before consequential work

Catch locally detectable mistakes before uploading bytes or changing state.

- Check names, mappings, duplicates, required settings, supported patterns,
  file counts, sizes, and destructive scope as appropriate.
- Show the exact offending item and how to fix it. For a failed whole-selection
  preflight, disable the action and verify that no mutation request is sent.
- Show exclusions before submission and distinguish excluded locally from
  rejected after receipt. Repeat authoritative validation on the server.
- Do not promise content validity merely because a filename is eligible.
- Keep paths, identity, and access boundaries safe even when UI checks are bypassed.

## UX-13: Close the loop with useful results

The user should not need to guess whether an operation did anything.

- Separate queued/received/staged/processed/saved/rebuilt states rather than
  collapsing them into one ambiguous success message.
- Show relevant before/after counts, failures, skipped or duplicate items, and
  links to inspect affected results. Explain the unit of each statistic.
- Treat partial success honestly: “settings saved, rebuild failed” is neither
  “nothing changed” nor “everything succeeded.”
- Explain retained data and retry behavior. A corrected upload must not imply
  replacement of an older bad input when the system actually preserves both.
- Refresh affected views and receipts. Empty or stale cached results must not
  contradict a completed action. Persist history only through an approved model.

## UX-14: Make provenance and uncertainty inspectable

Help users answer where a result came from, how it changed, and what evidence
exists for when it happened.

- Connect source → record → derived relationship → applied correction → current
  result, using human-readable context before technical identifiers.
- Distinguish source timestamps, filesystem timestamps, processing timestamps,
  and recorded events. Label assumptions and unavailable history.
- Do not present path-derived identifiers as byte checksums or current rule
  state as an immutable revision log.
- Show unavailable references explicitly with consequences and recovery paths;
  do not fabricate replacements or delete them silently.
- Keep evidence views read-only unless an intentional edit workflow is entered.

## UX-15: Make automation understandable and manageable

- Support the necessary lifecycle: create, inspect, edit, duplicate, remove,
  organize, search, filter, sort, and bulk-manage.
- Distinguish conditions, proposed matches, recorded matches, current winning
  fields, overridden fields, and actual effective changes.
- Make one-record corrections compact without assuming every rule with one
  match is a one-off correction. Provide full detail on expansion.
- Explain precedence. Sorting the catalog must not change execution order.
- Give missing targets a plain-language explanation and safe repair options.
  Distinguish clearing a field, restoring its source value, and deleting a rule.
- Preview broad or changed scopes and explain whether future inputs are affected.

## UX-16: Make single and bulk edits equally safe

- Use a coherent workflow for one item, selected items, the current page, and
  all filtered items. Make the active scope and exact count explicit.
- Prevent shortcuts or context menus from silently applying to a different set.
- Show mixed values and distinguish “keep current,” “set,” “clear,” and “restore.”
  Preserve fields the user did not choose to change.
- Preview meaningful before/after effects and disclose sample/truncation limits.
  Returning to the draft must preserve work; cancel must not save.
- Reject stale previews or conflicting updates rather than overwriting newer
  work. Confirm consequential operations at the point of commitment.

## UX-17: Choose visualizations and exports for real questions

- Use charts for trends or relationships, tables for exact comparisons, trees
  for hierarchy, and summaries for orientation. A chart is not automatically
  better than a concise table.
- Show legends, units, dates, omitted/truncated data, and an accessible exact-value
  alternative. Labels must match what the underlying data can establish.
- Make useful figures drill into their supporting records. Keep flags and
  relationship anomalies discoverable even when summaries suppress detail.
- Let users explore input structure with annotations such as counts, eligibility,
  exclusions, and source links when files/folders are part of the workflow.
- Declare export scope, period, population, and format before download. Exports
  and printed reports must agree with the visible analysis and remain safe to open.

## UX-18: Improve presentation without inventing data

- First use existing fields, read-only projections, view state, and derived
  grouping. Do not redesign the domain just to support a layout preference.
- For a missing capability, identify exactly what evidence is absent and
  whether it can come from the provider, future app operations, user input,
  or nowhere reliably.
- Separate schema proposals from implementation. Include benefit, source,
  historical limits, privacy, migration, compatibility, and recovery implications.
- Obtain the required approval before changing persistence or financial meaning.
  A useful proposal or an accepted priority is not authorization to implement it.

## UX-19: Verify performance and the actual running product

- Exercise representative volume and diversity: long history, hundreds of rules,
  long names, many folders, duplicates, unavailable references, and partial errors.
- Measure end-to-end search, filter, sort, drill-down, preview, and rebuild paths;
  record dataset size, environment, and the chosen performance budget.
- Bound rendered work. Do not describe client-side paging as server-side paging
  or assume a small DOM also means a small network payload.
- Test the production build, API compatibility, restart/persistence, and stale
  build behavior. Development success does not prove the user-facing release works.
- Use realistic loading/pending states and prevent duplicate submission. Preserve
  a safe retry route; add infrastructure only when measured needs justify it.

## UX-20: Make improvement maintainable and repeatable

- Keep shared vocabulary, visual tokens, behavior primitives, calculations, and
  navigation contracts consistent. Avoid one-off fixes that leave sibling screens
  with the same problem.
- Put explanations of non-obvious safety or business decisions beside the code.
  Keep pure transformations testable and separate from presentation and storage.
- Add regression tests for the failure, not incidental markup. Replace stale
  tests when the contract changes; do not remove useful coverage to hide failures.
- Update user guidance, implementation contracts, test instructions, and limitations
  with the change. Keep historical evidence dated rather than rewriting it as new.
- Provide an honest handoff: changes, verification, remaining issues, data effects,
  how to try the result, and commit/push status when relevant. Do not claim actions
  were performed merely because they were requested in an earlier phase.

## Review and refinement loop

Use the [review template](UX_REVIEW_TEMPLATE.md) to record this loop:

1. **Frame the task.** Identify users, common outcomes, current constraints,
   applicable feedback IDs, and what is out of scope. Inventory legacy capabilities
   when reviewing a migration.
2. **Establish evidence and safety.** Choose synthetic or isolated data for writes.
   Record build/revision, environment, scenario, viewport, and permission boundaries.
   Keep financial screenshots local and out of commits unless separately authorized.
3. **Walk the current journey.** Capture and inspect actual rendered states before
   diagnosing visual problems. Observe network/state behavior where it matters.
   Historical feedback establishes requirements, not present-day pass/fail evidence.
4. **Diagnose the cause.** Check configuration, data availability, API contracts,
   caching, and deployment as well as layout and copy. Identify the user consequence,
   not just the visual symptom. Label unverified explanations as hypotheses.
5. **Prioritize and propose.** Fix safety/correctness and blocked work first, then
   recurring confusion, efficiency, and polish. Prefer the smallest cohesive change
   that repairs the workflow; check whether other screens share the same flaw.
6. **Refine within authority.** Preserve source data and unrelated work. Reuse
   existing contracts. Stop for review if the solution needs new schema or authority.
7. **Re-run the journey.** Compare before/after behavior, density, comprehension,
   clicks, and timing. Test neighboring flows, failure paths, and no-write cancellation.
8. **Close with evidence.** Mark each finding verified, partial, blocked, or deferred;
   distinguish implemented-but-unverified from passed. Record remaining work and
   update the relevant docs. Repeat for unresolved findings within scope.

### Severity and release gates

| Priority | Meaning                                   | Examples                                                                               | Acceptance rule                                                         |
| -------- | ----------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| P0       | Safety or material truth failure          | Unintended write, lost source data, false financial total, invented provenance         | Do not accept the affected workflow until repaired and verified.        |
| P1       | Core task blocked or seriously misleading | Existing data appears absent, required action inaccessible, unreadable critical notice | Repair and verify, or explicitly report that the workflow is not ready. |
| P2       | Frequent confusion or avoidable effort    | Repeated unexplained labels, excessive clicks, poor large-list organization            | Fix in scope or record a specific, prioritized follow-up.               |
| P3       | Lower-impact polish                       | Minor alignment or wording inconsistency with a usable workaround                      | Address consistently without displacing higher-risk work.               |

Severity follows the consequence, not the type of component. A color issue can
be P1 when it hides a blocking error. Scores must not average away a P0/P1 failure.
Passing automation alone never closes a finding that requires human visual or
interaction evidence.

### Required scenario matrix

For each relevant journey, cover:

- **Data:** new, configured-but-empty, existing inputs, existing records/rules,
  large history, long values, unknown/partial evidence, and no filtered matches.
- **Operations:** read, create, modify, duplicate, cancel, remove, preview,
  commit, conflict, partial failure, retry, reload, restart, and recovery.
- **Presentation:** wide desktop, typical laptop, narrow/mobile, zoom, supported
  theme preferences, keyboard, touch, focus, and accessible help.
- **Environment:** loading, network/API failure, stale frontend/backend pairing,
  active-versus-saved configuration, and production mode.

Do not manufacture coverage: record not-applicable reasons and untested cells.

### Maintaining this guide

Reusable review instruction:

> Review the specified journey using the applicable UX principles and feedback
> IDs. Establish the data and permission boundaries, inspect current rendered
> and behavioral evidence, and record findings with severity and acceptance
> checks. If implementation is authorized, make the smallest cohesive repairs
> and repeat the journey. Report verified outcomes separately from remaining
> gaps, and update the guide or template wherever the review missed a recurring
> problem. Never treat this instruction as permission to change schemas, live
> data, or externally published state.

For each new critique, add a traceability entry, identify the general principle,
and add an acceptance question or regression scenario. Generalize repeated
symptoms into one reusable rule without erasing their concrete examples. Keep
principle IDs stable. Refine the review template when it failed to expose an
issue. Project-specific preferences belong in the project adaptation, not as
universal laws. Never turn old review results into blanket claims of completion.
