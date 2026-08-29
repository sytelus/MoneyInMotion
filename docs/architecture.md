# Architecture

MoneyInMotion is a hosted, same-origin web application with a transparent
filesystem persistence model. One Node.js process serves the React site and its
JSON API in production. A browser uploads statement bytes; only the server reads
or writes the configured data root.

## System boundaries

```text
Browser
  React website
    │  HTTPS: JSON + multipart directory upload
    ▼
Express server
  routes ── validation ── application services ── filesystem repositories
                         │
                         ▼
                    core domain package
                         │
                         ▼
<data-root>/<username>/{Statements,staging,Merged}
```

The package dependency direction is deliberate:

- `@moneyinmotion/core` is pure TypeScript. It owns transactions, account and
  import metadata, rule scopes, effective edited values, matching,
  normalization, aggregation, and compatible serialization. It has no Express,
  React, or filesystem dependency.
- `@moneyinmotion/server` adapts the domain to HTTP and disk. It owns server
  configuration, account discovery, parsers, upload staging and promotion,
  snapshot lifecycle, edit persistence, security middleware, and production
  static hosting.
- `@moneyinmotion/web` is a React single-page application. TanStack Query owns
  server state; Zustand owns ephemeral transaction-navigation state. UI
  components use native HTML first, with Radix only for accessible dialogs and
  action menus and Tailwind for styling.

This direction keeps business rules directly testable and avoids importing UI
or transport concerns into parsers and models.

These three npm workspaces are compile-time boundaries, not three deployed
services. The browser cannot use Node filesystem APIs, the server must not
depend on React, and both need the same financial rules. Keeping those actual
runtime boundaries visible is simpler than a single mixed source tree. In
production they still produce one website served by one Node process.
Browser libraries are build-time dependencies and are removed by the production
installer after Vite emits static assets.

## Simplicity constraints

The architecture is intentionally limited to what the current single-user
product needs:

- one configured username per process;
- one Node process and one filesystem data root;
- direct construction of repositories and services—no dependency-injection
  framework;
- JSON files—no database, ORM, migration service, or object store;
- synchronous imports—no queue, worker, scheduler, or event bus;
- same-origin browser/API traffic—no CORS layer; and
- explicit maintenance rebuilds—no background filesystem watcher.

Do not add infrastructure merely because it might help a future multiuser or
high-scale version. Add it only when a measured requirement cannot be met by
this model. Path validation, atomic file replacement, deterministic parsing,
and accessible UI primitives remain because they protect current data and
users, not because they are extension points.

## Runtime lifecycle

At startup the server:

1. Resolves environment, persisted configuration, and defaults.
2. Validates the absolute data root and safe single-segment username.
3. Creates `Statements`, `staging`, and `Merged` beneath the active user path.
4. Constructs one `FileRepository` and one `TransactionCache` for that user.
5. Starts the API and, in production, serves `packages/web/dist`.

The cache loads `Merged/LatestMerged.json` lazily. If no snapshot exists, the UI
receives an empty transaction collection. The server is the sole supported
writer and serializes edit/rebuild mutations through one process-local queue.
It updates the cache through edits and rebuilds. If an administrator
changes statement files directly, **Rebuild snapshot** in Settings refreshes it.

Changing data root, username, or port in Settings writes
`~/.moneyinmotion/config.json`. The current listener and repository remain
attached to their startup configuration; the API explicitly returns
`restartRequired` until the process restarts.

## Import and snapshot transaction

An upload passes through four distinct phases:

```text
directory selection → manifest validation → stage and promote → full rebuild
                                                       │
                        parse failure ─────────────────┤
                        keeps last good snapshot       ▼
                                              replay saved edits
                                                       │
                                                       ▼
                                             atomic file replacement
```

Every received file is copied to a unique staging batch before classification.
Paths are normalized and constrained beneath the batch, account mapping uses
configured relative account directories, and identical content is detected per
account with SHA-256. A nested path is rejected when that account is configured
not to scan subfolders, preventing the upload flow from promoting a source the
rebuild cannot see. New content is promoted using exclusive creation; name
collisions receive a numbered suffix instead of overwriting a file.

The rebuild constructs a new `Transactions` object off to the side, discovers
statement inputs in deterministic order, parses all of them, runs parent-child
and inter-account matching, then replays `LatestMergedEdits.json`. If any parser
fails, the candidate is discarded and the previously committed snapshot stays
active. On success, JSON storage writes a temporary file and atomically renames
it into place before the candidate becomes the live in-memory graph.

## Edit model

Imported transaction facts are immutable. A `TransactionEditData` records:

- an ID and audit information;
- one or more scope filters;
- only the fields being changed; and
- the source identifier for the change.

An edit request is completely validated and preflighted before application.
Persisted snapshots, transaction graphs, edit aggregates, metadata maps, and
account configs are validated again when read from disk; malformed durable data
fails visibly instead of being coerced or partially loaded.
The server derives a candidate from the active graph, applies the full batch,
persists the materialized snapshot plus the independent edit aggregate, and
only then swaps the candidate into live memory. Rebuilding from statements
replays the edit aggregate, so corrected
behavior is reproducible without modifying source exports. A field reset
appends a voiding edit targeted to the transaction IDs known to have received
the selected rule; history is not silently erased and future transactions are
not accidentally captured by the reset.

## Why filesystem storage remains appropriate

The present goal is a single-user personal-finance deployment without an
authentication system or scalability requirement. JSON and source files make
backup, inspection, migration, and legacy comparison straightforward and keep
the system small enough to audit. A database would add installation, backup,
migration, and recovery work without solving a current requirement.

The tradeoffs are explicit: a single process is the supported writer, snapshot
and edit files do not share a cross-file transaction, and large histories are
rebuilt synchronously. These are tracked in
[Legacy limitations](legacy_limitations.md).

## Security boundary

Helmet supplies browser security headers, the site and API share one origin,
JSON and upload sizes are bounded, request bodies are validated with Zod, and
all user-influenced paths are checked. Production error responses hide
unexpected internal details.

Those controls do not replace authentication. Until user identity and
authorization exist, the trusted network or an authenticating reverse proxy is
part of the security boundary. See [Security](../SECURITY.md).
