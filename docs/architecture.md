# Architecture

## Shape

```text
browser (React SPA)
   │  same-origin HTTP: JSON + multipart folder upload
   ▼
one Node.js/Express process      serves the compiled site and /api
   │
   ▼
<dataRoot>/<username>/{Statements, staging, Merged}   plain files on disk
```

There is no database, queue, worker, cache server, container, or file
watcher. One process is the only writer. This is deliberate: one user on one
machine needs none of that, and plain JSON and source files are easy to back
up and inspect. Add infrastructure only when a
measured problem can't be solved within this model, and record the reason
when you do.

## Packages

The three npm workspaces are real runtime boundaries, not services:

- **`@moneyinmotion/core`**: pure TypeScript with no Node, React, or
  filesystem imports. Transactions, account and import metadata, edit scopes,
  effective (corrected) values, matching, normalization, aggregation, and
  serialization.
- **`@moneyinmotion/server`**: configuration, account discovery, statement
  parsers, upload staging and promotion, rebuilds, edit persistence, backups,
  security middleware, and static hosting of the built site.
- **`@moneyinmotion/web`**: the React SPA. TanStack Query holds server state;
  Zustand holds view state (period, selection, expansion). Radix is used only
  for dialogs and menus; Tailwind for styling.

Dependencies point one way: web → core and server → core. Core never imports
either. In production all three build into one website served by one process.

## Code map

```text
packages/core/src/          no Node, React, or filesystem (ESLint enforces)
  models/                   Transaction, Transactions graph, edits and scopes, account and import info
  matching/                 order lines (Amazon, Etsy) to the card charges they explain
  aggregation/              grouping and totals used by the reports
  normalization/            merchant-name cleanup
packages/server/src/
  index.ts, app.ts          startup (restore recovery, config, listen); every router is mounted in app.ts
  config.ts                 ~/.moneyinmotion/config.json: defaults, validation, save
  routes/                   one Express router per /api area (docs/api.md)
  middleware/               same-origin checks for mutations, JSON error responses
  validation/               Zod schema for edit requests
  parsers/file-format/      CSV, JSON, and IIF readers
  parsers/statement/        institution parsers; getStatementParser() in index.ts chooses one
  storage/                  FileRepository, atomic JSON writes, AccountConfig codec, path safety
  cache/                    TransactionCache: the live graph, rebuilds, the edit queue, rule management
  services/                 folder upload, statement inventory, import history, backups, reconnection
packages/web/src/
  App.tsx                   routes, one lazy-loaded page each; navigation is in components/layout/Header.tsx
  pages/                    Overview (ReportsPage), Imports, Review (ReviewPage), Accounts, Rule Studio (RulesPage), Settings, Welcome
  components/               by area; /transactions is components/layout/AppShell.tsx
  api/                      client.ts (HTTP + response types) and hooks.ts (TanStack Query)
  lib/                      pure, tested calculations: cash-flow (income/spending/savings),
                            financial-reports (Overview), rules, rule-effects, import-preflight, ...
  store/                    Zustand view state
scripts/                    run.mjs launcher, smoke test, clean, backup-archive.py (used by backups)
e2e/                        Playwright journey on synthetic statements
```

Tests mirror this layout under each package's `__tests__/`. Vite and Vitest
read core from source through an alias, and the development API server reads
it through the `source` export condition, so only production needs
`packages/core/dist`.

## Runtime lifecycle

At startup the server:

1. Rolls back an interrupted restore if `~/.moneyinmotion/restore-pending.json`
   exists ([backup-and-restore.md](backup-and-restore.md)).
2. Loads `~/.moneyinmotion/config.json`, creating defaults on first start. An
   invalid file stops startup and is left untouched for repair.
3. Validates the absolute data root and the single-segment username, then
   ensures `Statements`, `staging`, and `Merged` exist.
4. Builds one `FileRepository` and one `TransactionCache`, then serves `/api`
   and, in production, `packages/web/dist`.

The cache loads `Merged/LatestMerged.json` lazily. It loads saved rules from
`LatestMergedEdits.json` even when no snapshot exists, so Rules works before
the first build. All edits and rebuilds go through one in-process queue.
Changing the root, username, or port in Settings writes the config file. The
running process keeps its startup configuration and reports `restartRequired`
until restarted.

## Import → rebuild → commit

```text
folder selection → preflight (browser) → validate paths/accounts (server)
  → stage every file → SHA-256 dedupe per account → promote new files
  → full rebuild: parse all statements → match relationships → replay edits
  → atomically write snapshot + edits → swap into memory
```

A rebuild builds a new candidate alongside the live one. If any statement
fails to parse, the candidate is discarded and the last good snapshot stays
live. Promoted files and staging receipts are kept so the problem can be
diagnosed. See [data-and-imports.md](data-and-imports.md).

## Edit model

Imported facts never change. A correction (`TransactionEditData`) records its
scope filters, only the fields it changes, and audit information. Rules are
replayed in saved order against the imported baseline, and a later rule wins
per field. The server validates a whole batch, applies it to a copy of the
graph, writes `LatestMerged.json` and `LatestMergedEdits.json` atomically, and
only then swaps the copy into memory. See [edits-and-rules.md](edits-and-rules.md).

## Browser data flow

The browser loads the complete transaction graph once. It builds a reporting
index (complete order details replace their parent payment), then search,
filters, summaries, and exports all use that index. Rendering is paged at 100
transaction rows and 50 rule rows. That bounds DOM size, not network payload.

## Security boundary

There is no login. Anyone who can reach the port can read and change
everything, so by default the server should be reached only from the local
machine. Defense in depth: Helmet headers, same-origin serving,
`Cache-Control: no-store` on API responses, rejection of cross-origin browser
mutations, bounded JSON and upload sizes, Zod validation, and path
containment checks. See [SECURITY.md](../SECURITY.md).

## Known limitations

These are accepted for one user on one machine. Revisit one when it actually
hurts.

- **Scale:** every rebuild reparses all statements synchronously inside the
  upload request, with no progress, cancellation, or resume. The browser
  holds the full graph. Bulk actions are capped at 1,000 items per request.
- **Uploads** are held in memory: at most 200 files, 20 MiB per file, and
  100 MiB per request. A chunked request can use multipart memory before the
  total-size check rejects it.
- **Persistence:** each JSON write is atomic, but the snapshot and edits are
  two files. A crash between the two writes may require replaying edits or a
  restore. Promotion is file by file and is not rolled back if the later
  rebuild fails.
- **No history journal:** rules are current state, not a revision log.
  First-import times are not recorded. Staging receipts are never expired.
- **One writer:** never run two server processes against the same data root.
- **Time zone:** some statement date formats without a zone (`MM/DD/YY`,
  dates with times) are read in the server's local
  time zone, and those dates feed transaction IDs. The existing data was built
  in US Pacific time, on WSL and Windows alike. Running the server in another
  time zone would change those IDs and orphan exact-ID rules. Pin the zone
  before ever moving the server.
- **Operations:** `/api/health` only checks that the process is alive. Logs go
  to stdout, with no metrics.
