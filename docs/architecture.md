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
  components compose Radix primitives and Tailwind styles.

This direction keeps business rules directly testable and avoids importing UI
or transport concerns into parsers and models.

## Runtime lifecycle

At startup the server:

1. Resolves environment, persisted configuration, and defaults.
2. Validates the absolute data root and safe single-segment username.
3. Creates `Statements`, `staging`, and `Merged` beneath the active user path.
4. Constructs one `FileRepository` and one `TransactionCache` for that user.
5. Starts the API and, in production, serves `packages/web/dist`.

The cache loads `Merged/LatestMerged.json` lazily. If no snapshot exists, the UI
receives an empty transaction collection. A watcher invalidates cached state
when merged files are changed externally while ignoring the server's own saves.

Changing data root, username, or port in Settings writes
`~/.moneyinmotion/config.json`. The current listener, repository, and watcher
remain attached to their startup configuration; the API explicitly returns
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
account with SHA-256. New content is promoted using exclusive creation; name
collisions receive a numbered suffix instead of overwriting a file.

The rebuild constructs a new `Transactions` object off to the side, discovers
statement inputs in deterministic order, parses all of them, runs parent-child
and inter-account matching, then replays `LatestMergedEdits.json`. If any parser
fails, the candidate is discarded and the previously committed snapshot stays
active. On success, JSON storage writes a temporary file and atomically renames
it into place.

## Edit model

Imported transaction facts are immutable. A `TransactionEditData` records:

- an ID and audit information;
- one or more scope filters;
- only the fields being changed; and
- the source identifier for the change.

Applying an edit derives corrected values on every matching transaction and
immediately persists the materialized snapshot plus the independent edit
aggregate. Rebuilding from statements replays the edit aggregate, so corrected
behavior is reproducible without modifying source exports. Reversal appends a
voiding edit; history is not silently erased.

## Why filesystem storage remains appropriate

The present goal is a single-user personal-finance deployment without an
authentication system or scalability requirement. JSON and source files make
backup, inspection, migration, and legacy comparison straightforward and keep
the conversion small enough to audit. Repositories and configuration already
centralize physical paths, so a database or object-store adapter can be added
without putting filesystem calls into the UI or domain.

The tradeoffs are explicit: a single process is the supported writer, snapshot
and edit files do not share a cross-file transaction, and large histories are
rebuilt synchronously. These are tracked in
[Legacy limitations](legacy_limitations.md).

## Security boundary

Helmet supplies browser security headers, production CORS is same-origin, JSON
and upload sizes are bounded, request bodies are validated with Zod, and all
user-influenced paths are checked. Production error responses hide unexpected
internal details.

Those controls do not replace authentication. Until user identity and
authorization exist, the trusted network or an authenticating reverse proxy is
part of the security boundary. See [Security](../SECURITY.md).
