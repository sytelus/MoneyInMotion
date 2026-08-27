# MoneyInMotion documentation

This documentation describes the MoneyInMotion behavior preserved by the
`before-upgrade` tag. It focuses on workflows, data contracts, and observable
behavior so that the system can be maintained or reimplemented independently
of its current application technology.

## Documents

- [Overview](overview.md) — concise description of the inputs, processing,
  user actions, and outputs.
- [Data layout and import](data-layout-and-import.md) — root-folder layout,
  account configuration, supported statement sources, identity, and
  deduplication.
- [Processing workflow](processing-workflow.md) — complete rebuild, enrichment,
  order matching, transfers, adjustments, and reporting behavior.
- [Edits and persistence](edits-and-persistence.md) — edit rules, replay,
  snapshots, backups, and the meaning of each output file.
- [Features and limitations](features-and-limitations.md) — supported behavior,
  operational requirements, and guarantees that the current version does not
  enforce.

## Terminology

- **Data root**: the user-selected directory containing `Statements` and
  `Merged`.
- **Statement**: a downloaded financial or commerce file that produces
  transactions.
- **Top-level transaction**: a transaction reported directly unless matching
  replaces it with a completed child hierarchy.
- **Parent/child match**: a hierarchy that connects a payment to an order and
  the order to its line items.
- **Edit**: an immutable user action containing a scope and one or more changed
  values.
- **Materialized snapshot**: a complete serialized transaction graph that can
  be loaded without rescanning statements.
