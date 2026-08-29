# Suggested improvements

These improvements go beyond the legacy conversion. They are ordered roughly by
risk reduction and product leverage, not by promised delivery date.

## 1. Authentication and true multiuser isolation

- Add an identity provider or passwordless flow, secure sessions, CSRF
  protection, login throttling, and recovery.
- Resolve a tenant/user from the authenticated request rather than server-wide
  configuration, and enforce ownership in every repository/service call.
- Encrypt especially sensitive fields or whole storage volumes and design safe
  export/account deletion.
- Replace username audit attribution with stable authenticated actor IDs and
  human-readable display metadata.

This is the prerequisite for safe public Internet or shared-household use.

## 2. Durable import jobs and review

- Stream large multipart bodies to quarantine storage instead of retaining them
  in memory.
- Put parsing/matching into a durable queue with progress, cancellation,
  retries, idempotency keys, and restart recovery.
- Add a pre-commit review showing new/duplicate/rejected files, predicted
  transactions, account/date coverage, and parse warnings.
- Add explicit batch rollback/removal, quarantine release, manifest download,
  and configurable staging retention.

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

- Fast full-text and structured search across merchant, note, category, amount,
  account, rule, and date.
- User-managed category taxonomy, split transactions, reusable category-rule
  suggestions, and duplicate-review inbox.
- Budgets, recurring-transaction detection, cash-flow forecast, savings goals,
  net-worth accounts, and configurable dashboards.
- CSV/JSON export and a documented backup/restore wizard.
- Optional receipt attachments with privacy-aware OCR.

## 6. Browser experience and accessibility

- Resumable uploads with client-side hashing and a progress view for large
  folders.
- Installable PWA/offline read-only snapshot with an explicit privacy model.
- Saved views, advanced filters, density preferences, chart drill-down, and
  mobile editing refinements.
- Formal WCAG 2.2 AA audit, assistive-technology testing, visual regression,
  and browser/device compatibility automation.

## 7. Engineering and operations

- Playwright end-to-end tests covering new user, account, upload, failure,
  correction, rule reset, restart, backup, and restore journeys.
- Property/fuzz testing for parsers, path manifests, serializers, and scope
  composition.
- Structured privacy-redacted logs, OpenTelemetry traces, metrics, storage/free
  space alarms, and a deep readiness endpoint.
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
