# UX review template

Copy this template into a dated review record. Follow the
[UX design guide](UX_DESIGN_GUIDE.md); use stable UX principle IDs and relevant
[feedback IDs](UX_FEEDBACK_TRACEABILITY.md). This blank template is not a test
report. Replace placeholders with evidence, not optimistic defaults.

## Brief and boundary

- Product, flow, intended users, and user outcomes:
- Reviewer/date; build or revision; environment and URL:
- Relevant UX principles and feedback IDs:
- Scope, approved changes, and explicit exclusions:
- Data source and size; synthetic/copy/live read-only:
- Privacy, mutation permissions, and screenshot storage boundary:
- Legacy capability comparison, if relevant:
- Missing information and assumptions requiring verification:

## Journey and capability map

| User task                              | Entry point and prerequisites | Current capability or intentional replacement | Result and recovery path | Gap / evidence |
| -------------------------------------- | ----------------------------- | --------------------------------------------- | ------------------------ | -------------- |
| Set up or resume existing work         |                               |                                               |                          |                |
| Acquire/import and inspect result      |                               |                                               |                          |                |
| Find, inspect, and understand records  |                               |                                               |                          |                |
| Correct one item or a batch            |                               |                                               |                          |                |
| Manage configuration and automation    |                               |                                               |                          |                |
| Analyze, export, maintain, and recover |                               |                                               |                          |                |

Remove irrelevant rows with a reason; add domain-specific tasks. An endpoint
without a usable entry point/result is not a completed capability.

## Scenarios and coverage

| Scenario                        | Dataset/scope and input method | Viewport/theme/environment | Expected result | Observed result and evidence | Status  |
| ------------------------------- | ------------------------------ | -------------------------- | --------------- | ---------------------------- | ------- |
| Existing data on first open     |                                |                            |                 |                              | Not run |
| Default summary and drill-down  |                                |                            |                 |                              | Not run |
| Large-list search/filter/sort   |                                |                            |                 |                              | Not run |
| Draft/duplicate/cancel          |                                |                            |                 |                              | Not run |
| Invalid preflight               |                                |                            |                 |                              | Not run |
| Success and partial failure     |                                |                            |                 |                              | Not run |
| Single/page/all-filtered action |                                |                            |                 |                              | Not run |
| Missing evidence and recovery   |                                |                            |                 |                              | Not run |
| Back/reload/restart             |                                |                            |                 |                              | Not run |
| Keyboard/touch/zoom/narrow/wide |                                |                            |                 |                              | Not run |

Split combined rows into separate tested cases. Use **passed**, **failed**,
**partial**, **blocked**, **not run**, or **not applicable — reason**. A script,
screenshot, or previous review named here is evidence only for the state it
actually exercised.

## Findings

Repeat this section for each finding:

### Finding ID and plain-language title

- **Principle / feedback IDs:**
- **Priority:** P0/P1/P2/P3, with the user consequence justifying it.
- **Journey step and reproducible setup:**
- **Expected experience:**
- **Observed behavior:**
- **Evidence:** inspected screenshot plus interaction/network/data evidence
  where needed; private captures stay outside the repository.
- **Cause:** confirmed cause or explicitly labeled hypothesis.
- **Proposed smallest cohesive fix:** include copy/layout/behavior alternatives
  when there is a meaningful tradeoff.
- **Scope and safety:** data/schema/API changes, compatibility, permissions,
  and what remains untouched.
- **Adjacent surfaces to inspect:**
- **Acceptance checks:** measurable, observable, and including failure/cancel.
- **Implementation and regression tests:**
- **After evidence:**
- **Status:** open / implemented but unverified / verified / partial / blocked /
  deferred, with explanation and follow-up owner or decision where known.

## Focused self-review

- [ ] Important capabilities are reachable across the lifecycle, including legacy ones.
- [ ] Existing data, empty filters, missing evidence, and failed reads are distinct.
- [ ] Period, scope, units, grouping, and data basis are visible and truthful.
- [ ] The landing view summarizes; redundant nesting and excessive cards are removed.
- [ ] Wide and narrow layouts prioritize the task without obscuring essential warnings.
- [ ] Search, filters, sorts, selection, paging, and exports declare their scope.
- [ ] Copy names outcomes; unfamiliar indicators explain meaning, consequence, and action.
- [ ] Rendered contrast, non-color cues, focus, help, and keyboard/touch behavior are checked.
- [ ] Creation/duplication starts as a draft; cancel makes no writes.
- [ ] Preflight prevents locally detectable failures before requests or mutations.
- [ ] Results distinguish success, partial success, failure, changed data, and retry.
- [ ] Provenance, matching, rule effects, overrides, and unknown history are inspectable.
- [ ] Single/bulk changes preserve untouched fields and reject stale previews.
- [ ] Reports, drill-downs, and exports agree on population and calculations.
- [ ] No schema or domain-meaning change was smuggled into a presentation fix.
- [ ] Representative-scale timing and the production user path were checked.
- [ ] Shared components, neighboring flows, tests, and documentation were updated.

An unchecked item is not implicitly passed. Explain exemptions and missing evidence.

## Data enhancement proposals

Fill this only when current data cannot honestly support a needed experience.
Do not implement a proposal as part of a schema-free UX pass.

| Missing capability | Required fact | Producer: provider / app / user / unavailable | Existing alternative | Historical limits | Privacy, migration, compatibility, and recovery impact | Approval status        |
| ------------------ | ------------- | --------------------------------------------- | -------------------- | ----------------- | ------------------------------------------------------ | ---------------------- |
|                    |               |                                               |                      |                   |                                                        | Proposed, not approved |

## Verification and handoff

- Before/after comparison and common-path click/scan/timing changes:
- Commands and exact results; tests added/replaced; production/browser evidence:
- Data integrity checks and write isolation:
- Accessibility/browser/volume limits; manual checks not performed:
- Outstanding P0/P1 findings and whether the affected workflow is ready:
- Remaining prioritized recommendations and required decisions:
- User-facing and technical documentation updated:
- How to try the result, expected data location, and restart/rebuild needs:
- Commit/push status, only if relevant and authorized:

### Learning captured

What did the previous review miss? Which principle, example, acceptance check,
shared component, or regression fixture now prevents recurrence? Update the
guide/traceability/template where needed, and keep past evidence dated.
