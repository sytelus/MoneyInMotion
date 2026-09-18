# Accounts, imports, and source evidence

This workspace separates account configuration from the repeated task of importing
statements. It exposes existing storage evidence without changing the financial
schema or claiming that a file receipt proves a successful rebuild.

## User tasks and navigation

- **Accounts** creates and edits account configurations, searches/filters them,
  inspects each account's snapshot records, and reconnects preserved folders.
- **Imports → Import statements** selects a folder, checks it locally, uploads
  eligible statement files, and explains the immediate rebuild result.
- **Imports → Statement sources** searches the files referenced by the current
  snapshot, shows transaction-date coverage, and drills into their source records.
- **Imports → Upload receipts** searches saved browser-upload manifests and
  explains each file's promotion, duplicate, or rejection result. A receipt can
  be downloaded as JSON for local inspection.

The Imports tab is represented by `?tab=sources` or `?tab=history`. Source search,
account, sort, and page filters are also URL state, so drilling into transactions
and using Back returns to the previous source list. Transaction drill-down uses
the shared `transactionsHref()` contract, not component-specific filter state.

### Account lifecycle safety

An account owns one top-level directory beneath `Statements/`. Its files may
have recursive year/month folders according to `scanSubFolders`; nested
`AccountConfig.json` files are not independent accounts.

Creating an account does not silently reuse an existing directory. If a folder
has no configuration, Accounts lists it under **Folders without an account
configuration**. **Reconnect folder** explicitly writes only the missing
configuration, preserving every statement file. Surviving snapshot provenance is
checked for the original account identity, which may differ from the folder name.
When unique, that ID is prefilled and locked, and the server rejects conflicting
IDs. Title, institution, account type, and matching tags are prefilled from the
original account metadata. File filters and subfolder settings were not retained
in snapshots, so defaults are explicitly marked for user review.

If no original identity is available, the ID starts blank: the user must supply
the original ID and settings from their backup, with an explicit warning about
transaction identities and exact-ID rules. If multiple historical identities
refer to the same folder, reconnection is blocked rather than guessed; the user
must restore the original configuration from backup before rebuilding. Folder
names are validated as safe single path segments and may contain spaces, unlike
the stricter account-ID syntax.

Editing configuration does not immediately rewrite the snapshot. The editor and
saved result explain that a rebuild is needed to apply updated parser, matching,
account title/type, scan, or file-filter settings to existing records.

**Remove config** means removing `AccountConfig.json`, not erasing finances.
Current snapshot records remain until rebuild; the next rebuild excludes that
account and can remove its records from the snapshot. Saved rules remain and
their targets may become unavailable. The confirmation explicitly explains this
consequence, and preserved folders remain reconnectable. A full destructive
account/data deletion or an archive model is not implemented.

### Before an upload

`lib/import-preflight.ts` is a pure, testable adapter mirroring the server's
case-insensitive account-folder and filename-filter rules:

1. Normalize picker paths and identify the optional common picker root.
2. Require every selected path to belong to a configured top-level account.
   A misspelled account folder blocks the entire request; nothing is sent.
3. Show exclusions before upload: configuration files, files outside account
   filename filters, and subfolders disabled for that account. Excluded files
   remain local and are not sent.
4. Check the server's limits: 200 eligible files, 20 MiB per file, and 100 MiB per
   request, including a conservative allowance for multipart overhead.
5. Allow upload only after these checks pass and at least one eligible statement
   remains. The server repeats its authoritative validation.

These checks do not parse financial content or promise successful parsing. Invalid
statement contents can still cause rebuild failure after receipt; the previous
snapshot is retained and the offending source paths are reported.

### Understanding the immediate result

The response distinguishes received/new/duplicate/rejected files from the
rebuilt snapshot. It displays previous and resulting snapshot-record counts and
the **net change**, not a fabricated count of new purchases. Reconciliation,
deduplication, matching, and account configuration changes can alter that delta.
Graph record counts include related parent payments and order details, so they
must not be summed as spending totals. Reportable items use the separate
transaction reporting basis.

Users can inspect every per-file result, failed parse paths, and unavailable rule
targets, then navigate to the reporting view, saved rules, or all records for an
affected account. Saved-rule counts mean rules processed, not guaranteed matches
or a count of changed transactions.

## Evidence: what existing data can and cannot prove

| Displayed evidence                  | Existing source                                            | Interpretation                                                |
| ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| Source filename, format, identifier | `ImportInfo` referenced by current records                 | Current provenance, not a complete import journal             |
| Transaction-date coverage           | Earliest/latest corrected transaction dates in each source | Record coverage, not a statement's contractual billing period |
| Filesystem created/modified         | Existing `ImportInfo.createDate/updateDate`                | Filesystem metadata; copying files can change it              |
| Latest record build                 | Latest account transaction `auditInfo.createDate`          | Records are recreated during rebuild; not first import        |
| Browser receipt time                | Existing staging manifest `stagedAt`                       | When that browser-upload batch was staged                     |
| Per-file SHA-256                    | Existing staging manifest `files[].sha256`                 | Received byte-content checksum                                |
| Promotion/duplicate/rejection       | Existing staging manifest file result                      | File-handling outcome only                                    |

The legacy `ImportInfo.contentHash` is path-derived in the current implementation;
the UI intentionally does not present it as a content checksum. Source inventory
contains files referenced by current transaction records. Empty files, files whose
rows were all skipped, orphaned imports, or files excluded from the latest build
may therefore not appear. Browser receipt history complements that inventory;
files copied directly to the server have no browser receipt.

Historical rebuild success/failure and original first-import timestamps were not
persisted. The UI states this rather than reconstructing certainty from filesystem
dates. Adding a durable import/rebuild event journal, first-seen event, or immutable
rule revision timeline requires a separately reviewed persistence enhancement.
Those timestamps would be generated by the application, not by bank exports.

## Implementation boundaries

- `components/accounts/AccountFormDialog.tsx` owns account editor behavior;
  `pages/AccountsPage.tsx` owns list/navigation/lifecycle feedback.
- `pages/ImportsPage.tsx` composes upload, source inventory, and receipt views.
- `lib/import-preflight.ts` owns deterministic local preflight rules.
- `lib/import-evidence.ts` derives source inventory and explicitly qualified dates.
- `components/importing/SourceInventory.tsx` renders 25 source entries per page;
  its counts use all graph records only for provenance.
- `components/importing/UploadHistory.tsx` fetches 10 batches per page and bounds
  expanded file-list height. It always refreshes on mounting so revisiting it after
  an upload cannot show a cached empty history. `api/imports.ts` keeps the added API surface separate
  from the existing general client.
- `server/services/import-history-service.ts` reads existing manifests only. It
  validates shape, batch identity, file count, timestamps, SHA-256 and size fields;
  refuses symlink manifests/directories; bounds each manifest read to 2 MiB; and
  reports invalid/incomplete receipts rather than silently hiding them.
- `server/services/account-reconnection-service.ts` resolves historical account
  identities by source folder without modifying snapshot data or guessing IDs.

### API additions

- `GET /api/import/history?page=0&pageSize=10&search=&status=all` returns entries,
  filtered total, total valid recorded batches, unreadable count, normalized page,
  and page size. `status` may be `all`, `promoted`, `duplicate`, or `rejected`.
  It filters batches containing at least one file with that status. Page size is
  limited to 50; search to 300 characters. No receipt writes occur.
- `GET /api/accounts/disconnected` lists safe, non-symlink top-level directories
  missing their account configuration, their `identityStatus`
  (`known`/`unknown`/`ambiguous`), and unique `originalAccount` metadata when known.
- `POST /api/accounts/:folder/reconnect` accepts the existing `AccountConfig`
  shape, validates it using the create rules, refuses already configured or
  symlinked folders, rejects identity conflicts/ambiguity, and atomically writes
  only the missing configuration. Historical provenance is read before synchronous
  existence checks and writes, avoiding an asynchronous overwrite race.

No new financial persisted fields or collections were added. Manifests are
scanned on history requests; paging bounds response/DOM size, not directory scan
cost. Very large staging archives may warrant a separately designed index.

## Regression coverage

Synthetic temporary-directory server tests cover history validation, filtering,
paging, malformed/oversized/symlink receipt handling, query rejection, and the
remove → reconnect lifecycle with byte-for-byte raw-file preservation. Web tests
cover local spelling/size/count/filter checks, source evidence labels and record
links, receipt failures, account filtering, reconnect confirmation, and rebuild
warnings. Browser tests must use an isolated financial-data copy for writes.

Additional regressions cover a legacy folder name different from the account ID,
folder names with spaces, identity conflict refusal without a config write,
ambiguous provenance, locked identity prefilling, and receipt refresh after
revisiting a previously empty tab.
