# MoneyInMotion documentation

These documents describe the hosted website in this revision. Historical C#,
desktop, and local-browser implementation details remain available in Git
history but are deliberately absent from the working tree.

## Use and operation

- [Data and imports](data-and-imports.md) describes account folders, browser
  uploads, staging, deduplication, and snapshot creation.
- [Transaction edits and rules](transaction-edits.md) explains non-destructive
  corrections, rule scopes, persistence, and reversal.
- [Production deployment](deployment.md) covers a direct Node/systemd VM,
  access controls, health checks, upgrades, and backups.
- [HTTP API](api.md) is the integration reference.

## Engineering

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
