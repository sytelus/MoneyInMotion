# MoneyInMotion - Purpose and Goals

## Purpose

MoneyInMotion is a local-first personal-finance application that helps a user
import messy financial exports from many institutions, merge them into a
single view, and understand what happened without constant manual cleanup.

The project is intentionally optimized for imperfect real-world data:

- Duplicate imports should be harmless.
- Overlapping statement files should merge cleanly.
- Transfers, refunds, and order-history line items should be matched
  automatically whenever possible.
- User corrections should be fast, rule-based, reversible, and auditable.

## Primary Goals

The current product goals are:

1. Aggregate transactions from heterogeneous sources into one unified model.
2. Preserve original source files and store all derived output as JSON.
3. Reconstruct outputs from source files plus edits at any time.
4. Reduce user effort through automatic matching, normalization, and
   categorization.
5. Provide drill-down views that explain totals, trends, and anomalies.
6. Keep the app practical for local everyday use on a single machine.

## Usability Bar For The Current Version

For the current usable version of the app, the following capabilities matter
most:

- Web-based settings for choosing the data directory and server port.
- Web-based account management for creating, editing, and deleting account
  configurations.
- Reliable statement import with deduplication and matching.
- Transaction browsing, grouping, and edit workflows.
- Clear local deployment and production-run instructions.

## Canonical Source

The detailed long-form goal document remains [GOAL.md](../GOAL.md). This file
exists to provide the missing documentation entry point referenced throughout
the repo and to summarize the intent of the project in a shorter, stable form.
