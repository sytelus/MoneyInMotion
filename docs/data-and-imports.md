# Data and imports

## Storage contract

The `dataRoot` value in `~/.moneyinmotion/config.json` is the parent of username
folders. The default is `~/mim_root`; the active username defaults to the server
operating-system user.

```text
~/mim_root/
└── shitals/
    ├── Statements/
    │   ├── amex/
    │   │   ├── AccountConfig.json
    │   │   ├── 2025.csv
    │   │   └── archive/2024.csv
    │   └── amazon/
    │       ├── AccountConfig.json
    │       └── orders.csv
    ├── staging/
    │   └── 20260827...-12ab34cd/
    │       ├── files/<uploaded relative tree>
    │       └── manifest.json
    └── Merged/
        ├── LatestMerged.json
        ├── LatestMergedEdits.json
        └── <timestamped backup files>
```

Only the server needs filesystem access. Browser users do not mount this path
and do not install MiM.

### Statements

Each immediate child directory containing `AccountConfig.json` is an account:
`Statements/<account>/AccountConfig.json`. Account discovery does not search
deeper directories for additional configs. The top-level account folder is the
upload identity shown in the Accounts screen. An account config contains:

- stable account ID;
- display title and institution/parser name;
- account type and whether order lines require a financial parent;
- transfer or parent-match name tags;
- case-insensitive file filters (`*`, `*.extension`, or an exact filename); and
- whether nested statement directories are scanned.

The website writes a canonical camel-case JSON shape and reads both that shape
and the legacy Pascal-case inner `AccountInfo`. Account IDs permit letters,
numbers, dots, underscores, and hyphens only. Once files or transactions exist,
the ID is locked because it participates in stable transaction identity.
Order-history account types always require a financial parent; the server
derives that invariant rather than trusting a contradictory browser value.
Only Amazon and Etsy order-history parsers are currently implemented, and such
accounts require at least one parent-charge match tag. Subdirectories inside an
account may contain statement files but do not define another account; any
`AccountConfig.json` below the account root is ignored.

Deleting an account through the website removes its config only. The directory
is removed only when it is empty; raw statements are never recursively deleted.
Restore or recreate the config to rediscover preserved files.

### Staging

Each folder upload gets a collision-resistant batch ID. Every accepted HTTP
file is written below `staging/<batch>/files` before it is evaluated. The final
manifest records relative path, account ID, size, SHA-256, decision, destination
or duplicate source, explanation, username, and timestamp.

Staging is an audit and recovery aid, not a temporary browser cache. MiM does
not currently expire it automatically. Include it in retention planning or
remove old batches through an administrator-controlled process after backups.

### Merged

`LatestMerged.json` is a replaceable materialized view: it can be regenerated
from `Statements` plus saved edits. `LatestMergedEdits.json` is durable user
intent and should receive the strongest backup treatment. The edit aggregate
receives timestamped backups before replacement. Both JSON files, account
configs, staging manifests, and persisted Settings use a shared atomic
temporary-file/rename helper so readers do not observe partially written text.

## Browser directory upload

A hosted website cannot accept a user's local directory path and later read it
from the server. The directory picker instead returns browser `File` objects
and relative paths. The client sends both in one multipart request.

The selected layout may include a picker root:

```text
MyStatements/
├── amex/statement.csv
└── amazon/orders.csv
```

If every path shares `MyStatements` and that is not an account directory, the
server removes that first component. It then matches `amex` and `amazon`
case-insensitively to configured top-level account directories.

Before upload, the website checks every selected relative path against the
configured account directories. An unknown or misspelled folder disables the
upload action and names the paths to fix, so no file bytes are sent. The server
repeats this check before creating a staging batch or promoting any file, making
the operation all-or-nothing with respect to account-folder recognition.

The server rejects the request before creating a batch if paths are missing,
duplicated, absolute, empty, contain dot segments, contain NULs, or could escape
the storage root. One request accepts at most 200 files, 20 MiB per file, 203
multipart parts, and 100 MiB when the browser supplies the request length.
The server also checks the received file bytes after multipart decoding, so a
missing or dishonest length header cannot bypass the aggregate limit. Split a
larger folder into multiple selections. Unsupported files and uploaded
`AccountConfig.json` files are staged but marked rejected in the manifest;
account configuration is owned by the web editor. Nested files are likewise
staged but rejected when their account has disabled subfolder scanning, because
promoting an input that the rebuild deliberately ignores would be misleading.

## Deduplication and promotion

For each account, MiM hashes current statement files whose names match the
configured filters. A staged file with an existing SHA-256 is marked duplicate
regardless of filename and is not promoted. Hashes are updated during the
batch, so two identical new files in one upload cannot both be promoted.

A new file retains its path beneath the matching account. If its intended name
already exists with different content, MiM creates `name (1).ext`, then the next
available number. Existing files are never overwritten.

Deduplication is account-local by design. The same bytes in two distinct
accounts may be meaningful and are retained for both.

## Automatic rebuild

For a restored data folder with statements already on the server, use **Build
from existing statements** in Imports (also available in empty transaction
history and Getting Started recovery flows). No upload is
required. Saved rules remain visible in Rules even before the first build.
Missing transaction-ID targets are reported and preserved; migration of old
IDs requires a previous snapshot that identifies the original transactions.

Promotion is immediately followed by a deterministic rebuild over every
discoverable statement:

1. Pick the institution-specific parser or the generic parser.
2. Parse transactions and attach account/import metadata.
3. Merge sources, match related transactions, and build the hierarchy.
4. Load and replay all persisted edits.
5. Commit `LatestMerged.json` and `LatestMergedEdits.json` only after the whole
   candidate succeeds.

If a file cannot parse, promoted source files and the staging manifest remain
for diagnosis, but the last known-good financial snapshot is not replaced by a
partial result. Fix or remove the bad server-side input and use **Rebuild
snapshot** in Settings, or upload a corrected export. The response identifies
every failed source path. Invalid account configuration is reported through the
same failed-build result and also preserves the last known-good snapshot.

The maintenance rebuild endpoint runs the same algorithm without uploading
anything. It is useful after an administrator restores or changes server-side
files; normal users do not need a separate scan or save step.

## Supported source families

| Source                       | Inputs     | Specialized behavior                                         |
| ---------------------------- | ---------- | ------------------------------------------------------------ |
| Generic bank/card            | CSV        | Header/column discovery and standard debit/credit conversion |
| American Express             | CSV        | Amex columns and merchant metadata                           |
| Barclaycard                  | CSV        | Banner/header variations                                     |
| PayPal                       | CSV or IIF | Activity filtering and payment semantics                     |
| Amazon orders                | CSV        | Order-line synthesis and charge matching                     |
| Etsy buyer history           | JSON       | Receipt and item reconciliation                              |
| QuickBooks-compatible export | IIF        | Transaction and split parsing                                |

Institution export formats change. Add parser fixtures before modifying a
parser, and treat a reported parse failure as safer than silently accepting
ambiguous columns.

Numeric fields reject trailing text instead of accepting a partial prefix, and
date-only values must be real calendar dates. Etsy timestamps and account-config
booleans are likewise validated without permissive coercion.
