# MoneyInMotion documentation

These documents describe the hosted website in this revision. Historical C#,
desktop, and local-browser implementation details remain available in Git
history but are deliberately absent from the working tree.

## Design standards and review process

- [UX design and self-review guide](UX_DESIGN_GUIDE.md) is the canonical,
  general-purpose set of design principles and review/release gates.
- [UX feedback traceability](UX_FEEDBACK_TRACEABILITY.md) preserves the user's
  concrete criticisms, maps them to principles, and defines the MoneyInMotion
  adaptation. It is a requirements register, not a completion report.
- [UX review template](UX_REVIEW_TEMPLATE.md) captures scenarios, findings,
  evidence, refinements, tests, remaining issues, and lessons from each review.
- [Repository agent guidance](../AGENTS.md) instructs future coding/review work
  to use these resources and preserve the data/schema boundaries.

Use the guide for **how to design and review**; the topic guides below for
**current behavior**; dated reviews for **what was observed in that run**; and
[the lifecycle proposal register](UX_LIFECYCLE_REVIEW.md#enhancements-that-require-user-review--not-implemented-implicitly)
for **unapproved data enhancements**. Keep these roles separate. If a current
contract and implementation disagree, investigate and correct the discrepancy;
do not treat an old passing review as authority to ignore it.

## Use and operation

- [Full data backup and restore](backup-and-restore.md) covers Settings ZIP
  archives, confirmation, exact saved-state recovery, limits, and crash recovery.
- [Backup and restore verification](BACKUP_RESTORE_REVIEW.md) separates
  the initial restricted checks, full-suite and Chromium recovery acceptance,
  and remaining accessibility, scale, and durability limits.
- [Density, clarity, and accessibility review](UX_DENSITY_AND_CLARITY_REVIEW.md)
  records the latest screenshot-led audit, responsive layout, file explorer,
  account save/rebuild flow, rule table, and verification limits.
- [Workflow UX review](UX_LIFECYCLE_REVIEW.md) records the user journeys,
  evidence, implementation contracts, and data enhancements awaiting review.
- [Financial overview and reports](financial-reports.md) explains reporting
  totals, drill-downs, cash-flow-style charts, exports, and limitations.
- [Accounts and imports UX](accounts-and-imports-ux.md) covers lifecycle
  consequences, preflight, receipts, and source inspection.
- [Rules and provenance UX](rules-and-provenance-ux.md) explains current rule
  effects, shared correction previews, and trustworthy source metadata.
- [Data and imports](data-and-imports.md) describes account folders, browser
  uploads, staging, deduplication, and snapshot creation.
- [Transaction edits and rules](transaction-edits.md) explains non-destructive
  corrections, rule scopes, persistence, and field resets.
- [Production deployment](deployment.md) covers a direct Node/systemd VM,
  access controls, health checks, upgrades, and backups.
- [HTTP API](api.md) is the integration reference.

## Engineering

- [Repository quality review](REPOSITORY_QUALITY_REVIEW.md) records the latest
  correctness, safety, build, documentation, and regression-test improvements.
- [Architecture](architecture.md) explains package boundaries, data flow,
  lifecycle guarantees, and design decisions.
- [Simplicity review](simplicity-review.md) records what infrastructure and
  dependencies were removed, what remains, and why.
- [Development](development.md) contains setup, commands, coding conventions,
  and common change paths.
- [Testing and legacy verification](testing-and-verification.md) documents the
  test pyramid and the strictly read-only comparison workflow.
- [Domain rules](domain-rules.md) records parser, matching, aggregation, and
  presentation behavior that maintainers must preserve intentionally.

## Migration record

- [Legacy divergences](legacy_divergence.md) records intentional behavior
  changes and their justification.
- [Legacy limitations](legacy_limitations.md) records work that is intentionally
  deferred or cannot yet match the legacy application exactly.
- [Suggested improvements](legacy_suggested_improvements.md) is the forward
  engineering and product backlog.
- [Prioritized TODO backlog](../todo.md) turns the deferred migration work into
  an actionable checklist with completion criteria.

Repository-wide contribution and disclosure policies are in
[CONTRIBUTING.md](../CONTRIBUTING.md) and [SECURITY.md](../SECURITY.md).
