# Current migration limitations

These items are intentionally deferred. They describe real operational or
compatibility boundaries and should not be hidden by the UI or deployment
documentation.

## Identity and access

- There is no native authentication, authorization, password recovery, or user
  session. Anyone with network access has full access to the active user's data
  and Settings.
- The root may contain many username directories, but one server process binds
  one configured username at startup. There is no per-request tenant resolver
  or safe browser user switch.
- Audit `createdBy` reflects the configured username, not an authenticated
  human identity.

Until these are implemented, use a trusted network or authenticating reverse
proxy and do not advertise the service as a public multiuser application.

## Concurrency and scale

- Filesystem persistence supports one writer process. Multiple replicas sharing
  a volume have no distributed lock.
- The transaction graph is held in memory, all statements are reparsed during a
  rebuild, and the browser receives the serialized graph. Very large histories
  are not optimized.
- Uploads use memory-backed multipart handling, limited to 200 files, 20 MiB per
  file, 203 parts, and 100 MiB of received file bytes. Declared oversized
  requests are rejected before decoding, but a malicious chunked request can
  consume multipart memory before the post-decode aggregate check rejects it.
- Rebuild is synchronous in the upload HTTP request. There is no durable job,
  cancellation, live progress, or resume after a process restart.

These are acceptable for the current single-user scope but not a scalability
claim.

## Persistence transaction boundary

- Individual JSON replacements are atomic, and process-local saves are
  serialized, but `LatestMerged.json` and `LatestMergedEdits.json` are two files
  rather than one cross-file transaction. A process or disk failure between
  replacements may require replaying edits or restoring a backup. The shared
  atomic-file helper protects each file from partial text and cleans up failed
  temporary writes, but cannot make two renames one transaction.
- Promoted statement files are not rolled back when a later rebuild fails.
  This is deliberate for diagnosis, but there is no one-click batch rollback.
- Promotion is file-by-file. An infrastructure failure during promotion can
  leave earlier files promoted even though the HTTP request fails; content
  deduplication makes a retry safe, and the staging copies remain available for
  diagnosis.
- Staging batches have manifests but no retention policy, cleanup UI, quarantine
  release, or administrative download workflow.
- Timestamped output backups are local to the same storage tree and are not a
  substitute for an encrypted off-machine backup.

## Source formats

- MiM supports the source families documented in
  [Data and imports](data-and-imports.md), not arbitrary bank exports. A new or
  changed institution format may require a parser/fixture update.
- There is no direct bank aggregation, OAuth connection, Amazon API, Etsy API,
  email ingestion, or scheduled remote fetch. Users export and upload files.
- The generic CSV parser intentionally rejects ambiguous rows. It cannot always
  infer locale-specific dates, encodings, delimiters, or decimal conventions.
- Legacy import metadata stores basenames rather than a globally unique source
  path, so the verifier selects same-generation files by account plus basename.

## Legacy graph parity

The supplied snapshot and modern same-generation rebuild agree on account/date
coverage, all 431 edit rules, and all 125 exact-ID targets that still resolved
in the legacy snapshot, but not every graph node. The verified delta is -27
top-level and -30 all-node transactions. Content deduplication removes 29
repeated Chase rows, one Barclay row, and one Etsy receipt/order totaling
$509.65. Corrected one-to-one matching leaves four Amazon order rows totaling
-$46.35 at top level rather than reusing financial parents, producing a net
$463.30 top-level amount delta. Relationship synthesis accounts for the
remaining all-node difference. See
[Legacy divergences](legacy_divergence.md).

Thirty-seven exact-ID target parameters were already orphaned in the saved
legacy snapshot. They remain preserved and reported; MiM cannot infer a target
that the reference snapshot itself no longer contains.

The reference Statements tree also contains exports newer than its saved
snapshot. A raw “all files versus old snapshot” total is not a valid parity
test; use the provided selection script.

## Browser and experience boundaries

- Directory selection depends on the browser's directory-upload capability and
  `webkitRelativePath`. Current Chromium-family and other supporting browsers
  are expected; no complete browser/device compatibility matrix is automated.
- The UI has unit/integration coverage and responsive behavior, but no full
  Playwright-style end-to-end suite, visual regression suite, or formal WCAG
  conformance audit yet.
- There is no offline/PWA mode. An interrupted network upload must be selected
  again.
- There is no bulk search/query builder, budget planner, cash-flow forecast,
  receipt attachment system, exchange-rate model, or investment valuation.

## Operations

- Health checking is liveness-oriented, not a deep validation of every
  statement, snapshot, backup, or free-space threshold.
- Logging is process output rather than structured, privacy-redacted telemetry.
  Metrics, tracing, alerting, and administrator audit export are absent.
- Settings changes require restart; the service does not hot-swap its listener
  or repository.
