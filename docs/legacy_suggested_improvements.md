# Suggested improvements

These are optional directions beyond the legacy conversion, grouped by theme,
not an approved implementation plan or promised delivery order. The
[prioritized backlog](../todo.md) governs near-term work. Apply the
[UX design guide](UX_DESIGN_GUIDE.md) and use measured user needs before expanding
the single-user architecture. Proposals requiring persisted data changes belong
in the [lifecycle proposal register](UX_LIFECYCLE_REVIEW.md#enhancements-that-require-user-review--not-implemented-implicitly)
for separate review; their presence here does not authorize them.

## 1. Authentication and true multiuser isolation

- Add an identity provider or passwordless flow, secure sessions, CSRF
  protection, login throttling, and recovery.
- Resolve a tenant/user from the authenticated request rather than server-wide
  configuration, and enforce ownership in every repository/service call.
- Encrypt especially sensitive fields or whole storage volumes and design safe
  export/account deletion.
- Replace username audit attribution with stable authenticated actor IDs and
  human-readable display metadata.

An authentication boundary is required before public access. Native identity
and tenancy become necessary if the current access gateway is insufficient or
independent users must share a process. They are not required merely to refine
the UX behind the existing trusted network/authenticating-proxy boundary.

## 2. Durable import jobs and review

- Stream large multipart bodies to quarantine storage instead of retaining them
  in memory.
- If measured rebuild duration or reliability exceeds the synchronous model,
  evaluate durable jobs with progress, cancellation, retries, idempotency keys,
  and restart recovery.
- Add a pre-commit review showing new/duplicate/rejected files, predicted
  transactions, account/date coverage, and parse warnings.
- Add explicit batch rollback/removal, quarantine release, staged-file download,
  and configurable staging retention.

Current local preflight, immediate outcomes, and JSON receipt downloads already
exist. These proposals extend those flows rather than treating them as absent.

## 3. Transactional persistence

- Introduce a generation/commit manifest so snapshot and edit aggregate become
  one recoverable logical transaction.
- Store immutable generations, verify checksums on startup, and promote a small
  pointer only after every file is durable.
- Consider SQLite/PostgreSQL for indexed queries and concurrency and object
  storage for raw files, while retaining import/export of the transparent JSON
  contract.

## 4. Reconciliation confidence and explanations

- Show why a parent/child or transfer match was chosen, alternatives considered,
  and a confidence score.
- Let users unlink, relink, or exclude relationships through persisted audited
  rules.
- Build a sanitized golden corpus for Amazon/Etsy edge cases and adjudicate the
  remaining legacy graph differences against receipts rather than snapshot
  counts alone.
- Version matching algorithms so an upgrade preview can explain graph changes.

## 5. Financial product capabilities

- Move the existing browser search and structured filters to indexed server-side
  queries when measured history size makes full-snapshot loading too slow; add
  saved views and richer amount/category expressions at that point.
- User-managed category taxonomy, split transactions, reusable category-rule
  suggestions, and duplicate-review inbox.
- Budgets, recurring-transaction detection, cash-flow forecast, savings goals,
  net-worth accounts, and configurable dashboards.
- Extend the [implemented local ZIP backup and guided restore](backup-and-restore.md)
  with encrypted off-machine copies or retention controls if needed. Do not
  confuse report/CSV export with full recovery.
- Optional receipt attachments with privacy-aware OCR.

## 6. Browser experience and accessibility

- Resumable uploads with client-side hashing and a progress view for large
  folders.
- Installable PWA/offline read-only snapshot with an explicit privacy model.
- Extend existing structured filters and chart drill-down with saved views,
  density preferences, and evidence-backed mobile editing refinements.
- Formal WCAG 2.2 AA audit, assistive-technology testing, visual regression,
  and browser/device compatibility automation.

## 7. Engineering and operations

- Playwright end-to-end tests covering new user, account, upload, failure,
  correction, rule reset, restart, backup, and restore journeys.
- Property/fuzz testing for parsers, path manifests, serializers, and scope
  composition.
- Structured privacy-redacted logs and a local deep diagnostic command while
  keeping `/api/health` a liveness check. Add tracing/metrics infrastructure only
  if a measured operating need justifies it.
- Signed releases, software bill of materials, provenance/attestations,
  dependency scanning, and automated VM migration smoke tests.
- API versioning and OpenAPI generation if external clients become supported.

## 8. Administration

- Browser-safe user provisioning and per-user storage quotas after
  authentication exists.
- Background retention for staging and snapshot generations with legal/privacy
  controls.
- A diagnostic bundle that contains versions, counts, manifests, and sanitized
  errors without statement contents or personal transaction values.
