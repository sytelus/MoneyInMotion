# MoneyInMotion TODO

This backlog is intentionally conservative. MiM is expected to serve one user
from one inexpensive VM, so a task does not justify a database, queue, container,
microservice, or new framework unless a current measured requirement needs it.
The operating boundaries remain documented in
[Current migration limitations](docs/legacy_limitations.md); optional product
ideas live in [Suggested improvements](docs/legacy_suggested_improvements.md).

Apply the [UX design guide](docs/UX_DESIGN_GUIDE.md) to each relevant item and
reference the originating [feedback IDs](docs/UX_FEEDBACK_TRACEABILITY.md).
Use the [review template](docs/UX_REVIEW_TEMPLATE.md) to record acceptance evidence
and remaining gaps. A guide entry is not proof that the current UI passes it.

## Near-term reliability and release confidence

- [ ] **Add Playwright end-to-end coverage.** Cover first run, account CRUD,
      directory upload, duplicate and parse-failure reporting, automatic rebuild,
      every correction type, broad rules, exact-target field reset, restart,
      backup, and restore.
- [ ] **Complete backup operational acceptance.** Local ZIP creation and guided
      replacement restore now have isolated service/UI regressions; complete
      live production-browser verification from [the review](docs/BACKUP_RESTORE_REVIEW.md).
      Separately restore encrypted off-VM
      backups into an empty root and automatically compare account IDs, date range,
      rule counts, and snapshot persistence before accepting the restore.
- [ ] **Add staging retention controls.** Provide a simple administrator command
      or UI action to list, download, and remove old completed batches without
      touching promoted statements.
- [ ] **Run ShellCheck in CI.** Check `install.sh`, `build.sh`, `run.sh`, and
      `scripts/lib.sh`; the migration host did not have ShellCheck installed.
- [ ] **Complete accessibility/browser verification.** Perform a WCAG 2.2 AA
      audit, keyboard and assistive-technology testing, and a small supported
      browser/device matrix for directory upload and mobile layouts.
- [ ] **Expand hostile-input tests where evidence warrants it.** Prioritize path
      manifests, parsers, persisted JSON codecs, and exact-ID rule migration.
- [ ] **Bound aggregate upload memory during decoding.** Enforce the request
      budget while consuming chunked multipart bodies, not only after parsing;
      preserve per-file limits, useful errors, and staging preflight guarantees.
      Keep an upstream request-size limit until this is implemented.

## Useful single-user improvements

- [ ] **Add a deep diagnostic command.** Keep `/api/health` as liveness; provide
      a local administrator command that checks data-root ownership, free space,
      snapshot/edit readability, source counts, and backup age without exposing
      financial values over HTTP.
- [ ] **Improve privacy-safe logs.** Use a small structured log format that never
      records statement contents, transaction values, or edit payloads and remains
      readable through `journalctl`.
- [ ] **Explain reconciliation decisions.** Show why an order/charge or transfer
      was linked and allow audited unlink/relink rules before changing matching
      infrastructure.
- [ ] **Add product features based on actual use.** Likely candidates are
      category management, splits, duplicate review, budgets, server-indexed
      saved views, and off-machine backup/retention controls. Full local ZIP
      backup/restore is documented in [the guide](docs/backup-and-restore.md). Validate priority before
      adding dependencies; browser search and scoped CSV/rule export already exist.

## Add only when the requirement exists

The following are not near-term architecture work:

- **Native authentication and authorization:** needed only if a private network
  or authenticating reverse proxy is no longer an acceptable boundary.
- **Request-scoped multiuser tenancy:** needed only when one process must serve
  independent users concurrently. The current username folder alone is not a
  reason to build tenancy.
- **Database or distributed locking:** needed only when file size, query latency,
  transactional recovery, or multiple writers demonstrably exceed the current
  filesystem model.
- **Background queue and workers:** needed only when measured rebuild duration or
  reliability makes a synchronous request unacceptable.
- **Horizontal replicas, object storage, metrics pipelines, or orchestration:**
  needed only after one VM is proven insufficient.
- **Resumable/offline/PWA support and direct provider APIs:** independent product
  projects that require a real use case and privacy review.

Do not pre-install libraries or introduce abstraction layers for these deferred
possibilities.

## Completion policy

When an item is implemented, add its tests and operating documentation in the
same change, update or remove the corresponding entry in
`docs/legacy_limitations.md`, and record any compatibility change in
`docs/legacy_divergence.md`.
