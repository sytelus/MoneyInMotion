# Data and imports

## Storage layout

`dataRoot` in `~/.moneyinmotion/config.json` is the parent of username
folders (default `~/mim_root`; the username defaults to the OS user). One
server process serves one username.

```text
<dataRoot>/<username>/
├── Statements/
│   ├── Amex/
│   │   ├── AccountConfig.json
│   │   ├── 2025.csv
│   │   └── archive/2024.csv
│   └── Amazon-Orders/
│       ├── AccountConfig.json
│       └── orders.csv
├── staging/<batch-id>/{files/…, manifest.json}
└── Merged/
    ├── LatestMerged.json          rebuildable snapshot
    ├── LatestMergedEdits.json     corrections and rules: the precious file
    └── <timestamped backups of the edits file>
```

All JSON writes use a shared atomic write (temporary file, then rename).

## Accounts

An account is exactly one top-level folder `Statements/<folder>/` that
contains `AccountConfig.json`. Subfolders may hold statements, scanned
recursively unless `scanSubFolders` is false. A nested `AccountConfig.json` is
ignored and never defines another account. The config holds:

- a stable **account ID** (letters, digits, `.`, `_`, `-`). It is part of
  every transaction ID, so it is locked once files or transactions exist;
- a display title, institution (which chooses the parser), and account type;
- whether order lines require a parent charge. This is always true for order
  history, which also needs at least one matching tag;
- matching name tags for transfers and parent charges; and
- case-insensitive file filters (`*`, `*.csv`, or an exact filename).

Account IDs and folder names must each be unique ignoring case. Config
symlinks and duplicates fail discovery visibly. Fields are camelCase; a
PascalCase field, as the old C# app wrote, is reported as an error.

**Lifecycle in the Accounts page:**

- **Add**, or **Duplicate**, which opens an unsaved copy with a blank ID and
  never saves on its own.
- **Edit** → **Save and rebuild**: saves the config, then rebuilds. If the
  rebuild fails, the settings stay saved and the previous snapshot stays live.
- **Remove account**: deletes only `AccountConfig.json`, and the folder only
  if it is empty. Statements are never deleted. The next rebuild drops the
  account's transactions; its rules remain, with unavailable targets.
- **Configure account** for a folder that has statements but no config, such
  as one just removed: the original account ID is recovered from the current
  snapshot when it is unambiguous. If no ID or several IDs are found, you
  must supply the original settings. MiM never guesses.

## Uploading a folder

The browser can't hand the server a local path, so the Imports page uploads
file bytes with their relative paths. The selection may include one wrapper
folder (`MyStatements/Amex/…`), which is stripped when it isn't itself an
account folder. Account folders match case-insensitively.

**Preflight** (in the browser, `lib/import-preflight.ts`, then repeated on the
server):

1. Every path must sit under a configured account folder. One misspelled
   folder blocks the whole upload and **no bytes are sent**.
2. Config files, files outside the account's filters, and subfolders the
   account doesn't scan are listed as excluded and are not sent.
3. Limits: 200 files, 20 MiB per file, 100 MiB per request. Split larger
   selections.

The server also rejects absolute, duplicate, empty, `..`, or control-character
paths, names Windows would store differently (reserved characters such as
`:`, device names such as `CON`, a trailing dot or space), and symlinked or
non-directory destination parents, before creating a batch.

**Staging and promotion:** every accepted file is copied to
`staging/<batch>/files`. The manifest records each file's path, account, size,
SHA-256, decision (promoted, duplicate, or rejected), destination, and time. A
file whose SHA-256 already exists in that account is a duplicate and is not
promoted, whatever its name. New files keep their relative path. A name
collision with different content becomes `name (1).ext`, so existing files
are never overwritten. Deduplication is per account, so the same bytes in two
accounts are kept for both.

**Result:** the response separates file handling (received, new, duplicate,
rejected) from the rebuild (previous and new record counts, failed sources,
rules processed, unavailable rule targets). Record counts include order
parents and children, so they are not spending totals. **Upload history**
lists retained manifests, and each receipt can be downloaded as JSON.

## Rebuild

Every upload is followed by a full, deterministic rebuild over all
discoverable statements:

1. Choose the institution parser, falling back to the generic parser.
2. Parse rows, attaching account and import metadata. Identical rows within
   one file are kept, because they are separate purchases. Identical content
   in a second, overlapping file is merged into the first.
3. Match relationships (orders to charges, transfers) and synthesize small
   adjustment children ([domain-rules.md](domain-rules.md)).
4. Replay `LatestMergedEdits.json`.
5. Commit both JSON files only if everything succeeded.

If any file fails, the previous snapshot stays live and the response names
every failing path, including a file that matches the account's filters but
has an extension other than `.csv`, `.json`, or `.iif`. Promotion never overwrites a file, so uploading a
corrected export does not remove the bad one. Fix or move the bad file on
disk, then use **Rebuild transactions** (Imports or Settings). The same
button rebuilds after statements are copied in directly or a data folder is
restored.

## Supported sources

| Source                | Inputs     | Specialized behavior                                                                                           |
| --------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| Generic bank/card     | CSV        | Header/column discovery, debit/credit conversion                                                               |
| American Express      | CSV        | Amex columns, phone and category metadata                                                                      |
| Barclaycard           | CSV        | Banner lines before the header                                                                                 |
| PayPal                | CSV or IIF | Statement date (time kept as an attribute); skips holds, authorizations, and denied, cancelled, or failed rows |
| Amazon orders         | CSV        | Order-line synthesis and charge matching                                                                       |
| Etsy buyer history    | JSON       | Receipt and item reconciliation; item amount is price × quantity                                               |
| QuickBooks-compatible | IIF        | Transactions and splits                                                                                        |

Excel files must be exported to CSV first. Parsing is strict: duplicate or
ambiguous columns, non-empty overflow cells, numbers with trailing text, and
impossible dates fail the rebuild instead of being silently truncated. One
narrow recovery exists for legacy rows whose unquoted final amount contains a
thousands separator. Add a sanitized fixture before changing any parser.

## What the stored evidence can and cannot prove

The Imports page shows a **Statement explorer** (live folder tree with counts
and parse eligibility), **Imported transactions by file**, and **Upload
history**. Keep these distinctions in mind:

| Shown                         | Comes from                                 | Means                                               |
| ----------------------------- | ------------------------------------------ | --------------------------------------------------- |
| Source file, format, row      | `ImportInfo` on current records            | Current provenance, not an import journal           |
| Transaction-date coverage     | Earliest and latest record date per source | Record coverage, not the statement's billing period |
| File created/modified         | `ImportInfo.createDate/updateDate`         | Filesystem times; copying a file changes them       |
| Upload time, SHA-256, outcome | Staging manifest                           | That browser upload only; copied-in files have none |
| `ImportInfo.contentHash`      | Derived from the path                      | **Not** a content checksum                          |

First-import times and past rebuild outcomes were never recorded, and the UI
says so rather than inventing them. The statement explorer lists at most
20,000 entries and 40 folder levels, and says so when it is truncated.
Staging batches are never expired automatically.
