# MoneyInMotion TODO

This backlog is extracted from the 2026-08-27 hosted-web migration handoff.
It lists work that was explicitly reported as deferred or not executable in the
migration environment. It is not a list of defects in the completed single-user
website. See [Current migration limitations](docs/legacy_limitations.md) for the
operating boundaries and [Suggested improvements](docs/legacy_suggested_improvements.md)
for the broader product roadmap.

Priority meanings:

- **P0** — required before exposing MiM directly to untrusted users or treating
  it as a supported multiuser service;
- **P1** — important reliability, operability, and release-confidence work; and
- **P2** — scalability or product expansion beyond the current single-user
  scope.

## P0 — identity and public-hosting safety

- [ ] **Implement native authentication and secure sessions.** Add login,
      logout, recovery, throttling, CSRF protection, secure cookie settings, and an
      authenticated actor identity. Until complete, require an authenticating HTTPS
      reverse proxy or a trusted private network.
- [ ] **Enforce authorization and request-scoped tenant isolation.** Resolve the
      active username from the authenticated request, verify ownership at every
      route/repository boundary, prevent cross-user path access, and replace the
      configured username in audit records with a stable authenticated actor ID.
- [ ] **Add destructive-account and export safeguards.** Define explicit user
      provisioning, account/data export, retention, and deletion flows before MiM
      holds data for multiple independent users.

## P1 — persistence and job reliability

- [ ] **Make snapshot and edit commits one recoverable transaction.** Introduce
      immutable generations plus a commit manifest or move the mutable model to a
      transactional database. Startup must select only a fully durable generation
      and verify its checksums.
- [ ] **Define and enforce the writer model.** Either keep a hard single-replica
      deployment invariant or add a distributed lock/transactional store before
      multiple processes share one data volume.
- [ ] **Move imports and rebuilds to durable background jobs.** Stream uploads to
      quarantine storage, report progress, support cancellation and retry, use
      idempotency keys, and recover unfinished work after process restart.
- [ ] **Add staging lifecycle management.** Provide configurable retention,
      manifest download, quarantine review/release, and an audited batch rollback or
      removal workflow.
- [ ] **Create a tested backup and restore workflow.** Include encrypted
      off-machine backups, generation integrity checks, restoration into an isolated
      root, and an automated post-restore account/date/rule verification report.

## P1 — release and deployment verification

- [ ] **Build and run the container in Docker-enabled CI.** The migration host
      did not have Docker. CI must build the multi-stage image, start it as the
      non-root user, exercise `/api/health` and a React deep link, verify data survives
      container replacement through the mounted volume, and fail on image
      vulnerabilities above the chosen severity policy.
- [ ] **Add Playwright end-to-end coverage.** Exercise first run, account CRUD,
      directory upload, duplicate and parse-failure reporting, automatic rebuild,
      each correction type, broad rules, reversal, restart, backup, and restore.
- [ ] **Complete accessibility and browser certification.** Perform a WCAG 2.2 AA
      audit, keyboard and assistive-technology testing, visual regression checks,
      and an automated compatibility matrix for supported directory-upload browsers
      and representative mobile layouts.
- [ ] **Automate shell-script static analysis.** Run ShellCheck against
      `install.sh`, `build.sh`, `run.sh`, and `scripts/lib.sh` in CI; ShellCheck was
      unavailable on the migration host even though the scripts were executed
      successfully.
- [ ] **Expand hostile-input testing.** Add property/fuzz tests for parsers,
      multipart path manifests, legacy serializers, exact-ID migration, and
      intersecting edit scopes.

## P1 — operations and diagnostics

- [ ] **Add production observability.** Emit structured privacy-redacted logs,
      metrics, traces, storage/free-space alarms, job status, and an administrator
      audit export without statement contents or transaction values.
- [ ] **Add a deep readiness check.** Keep `/api/health` as liveness, but add a
      separate readiness/diagnostic path that verifies the active generation,
      writable data root, edit consistency, backup state, and required free space.
- [ ] **Automate secure releases.** Produce signed releases, an SBOM, provenance
      attestations, container scanning, dependency policy checks, and migration
      smoke tests against sanitized fixture generations.

## P2 — scale and multiuser operation

- [ ] **Optimize large histories.** Add indexed/paginated queries, avoid sending
      the complete graph to every browser, benchmark rebuild memory/time, and define
      supported upload/history limits.
- [ ] **Support safe horizontal operation if needed.** After tenant isolation and
      transactional persistence exist, test multiple application replicas,
      background workers, object storage, and rolling upgrades.
- [ ] **Add browser-safe user administration.** Provision users, manage quotas,
      show storage consumption, and apply per-user staging/snapshot retention.

## P2 — source and product expansion

- [ ] **Broaden ingestion deliberately.** Add changed/new institution formats
      only with sanitized fixtures; consider bank aggregation/OAuth, scheduled
      imports, email ingestion, and provider APIs as separately permissioned
      projects.
- [ ] **Improve reconciliation review.** Explain match confidence and candidates,
      allow audited unlink/relink/exclusion rules, and version matching algorithms so
      upgrades can preview graph changes.
- [ ] **Add advanced financial workflows.** Prioritize structured search,
      user-managed categories, split transactions, duplicate review, budgets,
      recurring detection, forecasts, goals, net-worth accounts, exports, and a
      backup/restore wizard based on user research.
- [ ] **Improve large-upload and offline UX.** Consider resumable uploads,
      client-side hashes, durable progress, and a privacy-reviewed read-only PWA.

## Completion policy

When an item is implemented, add its tests and operating documentation in the
same change, update or remove the corresponding entry in
`docs/legacy_limitations.md`, and record any compatibility change in
`docs/legacy_divergence.md`.
