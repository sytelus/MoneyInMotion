# Repository quality review — 2026-09-18

This schema-free review follows the
[density and clarity UX pass](UX_DENSITY_AND_CLARITY_REVIEW.md). Existing UX
changes were preserved. No live statements, snapshots, rules, or application
configuration were edited; regression fixtures and write-capable verification
use isolated temporary directories.

Documentation follow-up: the user's critiques have since been distilled into
the [UX design guide](UX_DESIGN_GUIDE.md), [feedback register](UX_FEEDBACK_TRACEABILITY.md),
and [review template](UX_REVIEW_TEMPLATE.md), linked from repository working
instructions and current topic guides. That documentation-only synthesis does
not change the application verification results recorded in this review.

## Scope and approach

Reviewed the workspace boundaries, core matching/reporting contracts, parsing
and persistence adapters, account/import/rule APIs, browser state and API
consumers, app configuration, build/install/run helpers, CI/editor settings,
tracked fixture data, and operating/contribution documentation. Automated
type, lint, formatting, unit/integration, dependency, production, and reference
checks complement targeted manual inspection. This is not a formal security
certification or a claim that every possible defect has been eliminated.

## Corrections and simplifications

| Area              | Finding and correction                                                                                                                                                                                                              | Regression coverage                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| CSV               | A trailing comma could cause non-empty surplus fields to be discarded. Trim only empty overflow cells; retain narrow final-amount recovery.                                                                                         | Malformed overflow plus trailing blanks; thousands separator plus trailing blanks.                                                       |
| IIF               | Duplicate TRNS headers could overwrite financial values. Reject duplicates; retain only the section header the parser actually uses.                                                                                                | Case-insensitive duplicate amount headers.                                                                                               |
| Account discovery | Hand-edited configs could reuse an ID or a folder name differing only in case. Reject ambiguous identities and dangling config links across scanner/API/upload discovery.                                                           | Duplicate IDs/folders, dangling links, blocked staging, preserved snapshot after failed rebuild.                                         |
| Account writes    | PUT checked identities before an asynchronous cache read. Move that read before disk checks to prevent recreating an account removed in the meantime. Prevent creation/renaming of case-ambiguous folders.                          | Intervening deletion and case-only folder collision.                                                                                     |
| Provenance        | Audit timestamp strings mixed legacy and ISO formats, leading to incorrect latest-time ordering. Compare instants. A failed file stat invented current timestamps; now it fails visibly.                                            | Mixed separators/time zones; unavailable metadata.                                                                                       |
| Upload safety     | Lexical path containment did not stop promotion through existing subfolder symlinks. Preflight all destination parents before staging any file. Remove obsolete longest-prefix sorting now that account configs are top-level only. | Real and dangling links, non-directory parents, no staged/promoted side effects.                                                         |
| HTTP boundary     | A foreign browser form could submit a multipart mutation without a CORS preflight. Reject foreign-origin mutations before parsing; mark API responses `no-store`.                                                                   | Rejected foreign/null origins and Fetch Metadata; accepted development/HTTPS proxy origins and CLI requests; no filesystem side effects. |
| Persistence       | An unused public `save()` and a second queue duplicated the mutation queue and could allow future stale-cache saves. Remove both. Keep candidate persistence private inside edit/rebuild operations.                                | Concurrent edits survive disk reload; existing write-failure rollback and revision-conflict tests remain.                                |
| Startup/build     | A recent web build masked stale API/core output. Check package-specific completion markers and source directory mtimes. Avoid `find \| head` under `pipefail`.                                                                      | Fresh/pruned, stale core/server, deleted source, missing artifacts, incremental compilation markers.                                     |
| Installation      | A production environment could omit tools needed to build. Explicitly include dev dependencies before compiling/pruning, and force emission when incremental metadata survives missing output.                                      | Real Bash installer with stubbed npm; command order and forced compilation.                                                              |
| Developer tooling | Core debugger could miss the root Vitest project configuration. Run it from the workspace root with an explicit project.                                                                                                            | Root project command used by the test suite.                                                                                             |

The old busy-wait test for the unused save entry point was replaced with a
behavioral concurrent-edit/persistence test. Existing parser, rule, storage, and
UI tests remain useful; they were not removed merely to shrink the suite.
Comments now explain safety invariants at the relevant boundaries rather than
restating individual statements.

## Documentation coherence

- Updated current button names and rule-table limits in architecture and
  import/deployment guides.
- Corrected failed-import recovery: a corrected upload cannot overwrite/remove
  the original failing input. Move or repair that input, then rebuild.
- Documented case-insensitive identity uniqueness, symlink boundaries, API
  cache/origin behavior, reverse-proxy Host preservation, and build freshness.
- Aligned contribution verification with production smoke testing.
- Expanded the production smoke test to probe newer API contracts and the
  privacy/origin protections, so liveness alone cannot hide a stale API.
- Reused top-level account discovery in the read-only legacy verifier instead
  of recursively copying unused nested configs. Added shell syntax checks to CI.

## Verification and limits

The current acceptance results are recorded in
[Testing and legacy verification](testing-and-verification.md). The production
smoke test starts and restarts an isolated compiled server; shell regressions
use a synthetic checkout and stubbed npm, never the live installation.

No dependencies or financial schemas were changed. Proposed durable history,
source occurrences, rule revisions/tags, currency/statement metadata, and
manual matching decisions remain separately reviewable in
[UX lifecycle review](UX_LIFECYCLE_REVIEW.md#enhancements-that-require-user-review--not-implemented-implicitly).

Remaining priorities are automated browser lifecycle tests; a rehearsed
backup/restore operation; streaming aggregate upload limits; and measured
large-history performance. Timestamp-based build checks do not attest contents
after timestamp-preserving restores: force a build in that situation. The app
still requires an access gateway/trusted network, one writer, and off-machine
backups. See [limitations](legacy_limitations.md) and the [backlog](../todo.md).
