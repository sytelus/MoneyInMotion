# HTTP API

Production API routes and the website share an origin. All endpoints are below
`/api`. JSON requests use `Content-Type: application/json`; the folder upload is
multipart form data. There is currently no authentication, so network access to
these endpoints must be restricted by deployment controls.

Errors use an HTTP error status and normally return:

```json
{
  "error": "Human-readable explanation",
  "status": 400
}
```

Unexpected production errors do not expose internal exception details.
Unknown `/api` routes return the same JSON shape with status 404; they never
fall through to the website's HTML shell.

## Health

### `GET /api/health`

Returns service status, version information, and timestamp. Use it for liveness
checks; it does not deeply parse all financial files.

## Configuration

### `GET /api/config`

Returns persisted values and derived paths together with `active*` startup
values. `restartRequired` is true when the saved port, root, or username differs
from the running process.

### `PUT /api/config`

Accepts one or more of:

```json
{
  "dataRoot": "/srv/moneyinmotion",
  "username": "shitals",
  "port": 3001
}
```

`dataRoot` must be absolute and free of parent segments; `username` is one safe
path segment; port is 1–65535. The update is persisted for the next restart and
does not rebind a running repository or listener.

## Accounts

### `GET /api/accounts`

Returns account configs found exactly at `Statements/<account>/AccountConfig.json`,
with graph-record count, latest record-creation/rebuild timestamp, statement-file
presence, and the top-level directory expected in browser uploads.
The legacy wire field `lastImportedAt` is retained for compatibility, but it
is not a reliable first-import timestamp.

If any discovered `AccountConfig.json` is malformed or unsupported, discovery
returns 422 with its path instead of returning an incomplete account list.

### `POST /api/accounts`

Creates an account directory and canonical `AccountConfig.json`. The JSON body
is an `AccountConfig` with `accountInfo`, `fileFilters`, and `scanSubFolders`.
Account types are restricted to the supported financial and order-history
types. Order-history configuration is currently restricted to Amazon or Etsy
and requires at least one parent-charge match tag. File filters support `*`,
`*.extension`, or one exact filename. Returns 409 if a top-level account
directory or discovered account already has the logical ID; ID comparison is
case-insensitive.

### `PUT /api/accounts/:id`

Updates a config atomically. The account ID may change only before statement
files and transactions exist. A safe rename moves the account directory; if
the subsequent config replacement fails, the directory rename is rolled back.

### `DELETE /api/accounts/:id`

Deletes `AccountConfig.json`. It deletes the directory only if it is empty and
reports whether statement files were preserved. It never recursively deletes
source data.
Existing snapshot records remain until rebuild. The next rebuild excludes the
removed account, and its exact-target rules can then refer to unavailable records.

### `GET /api/accounts/disconnected`

Lists safe, unconfigured top-level folders without following symbolic links.
Returns `relativeDirectory`, `identityStatus` (`known`, `unknown`, or `ambiguous`),
and `originalAccount` when surviving snapshot source paths establish one account
identity. Unknown does not mean the folder is safe to assign an arbitrary old ID.

### `POST /api/accounts/:folder/reconnect`

Accepts an `AccountConfig` and explicitly restores only the missing configuration
in an existing real directory. Raw statements are preserved. Existing configs,
duplicate account IDs, conflicting known historical IDs, and ambiguous historical
identities return 409. If no identity is retained, the user must supply it; the
UI never silently substitutes the folder name for a historical logical ID.

## Transactions and rules

### `GET /api/transactions`

Returns the serialized current transaction graph, account and import metadata,
and current saved rules. The cache lazily loads the last materialized snapshot.
Saved rules are not an immutable log of previous rule revisions.

### `POST /api/transaction-edits`

Accepts an array of validated `TransactionEditData` objects and returns:

```json
{ "affectedTransactionsCount": 12 }
```

The server validates every field type, date, scope parameter count, amount
range, and scope content hash. A request must have 1–100 edits, each with at
least one scope and one changed or voided field. The complete batch is
preflighted before any transaction changes. It is applied to a candidate graph,
persisted, and only then swapped into the live cache, so validation or disk
failure leaves the active graph unchanged. A stale exact transaction ID returns
409; malformed input returns 400.

## Imports

### `POST /api/import/folder`

Multipart fields:

- `files`: repeated file parts, at least one and at most 200;
- `relativePaths`: a JSON string array positional to `files`.

Each file is limited to 20 MiB and the request to 100 MiB; size-limit failures
return 413. The website validates all selected paths against the account-folder
list before sending file bytes. The server repeats account-folder validation
before staging or promotion; an unknown or misspelled folder rejects the whole
request with no filesystem changes. Files in a subdirectory beneath a valid
top-level account are staged but rejected when that account has disabled
subfolder scanning. The response has two sections:

```json
{
  "staging": {
    "batchId": "...",
    "manifestPath": "staging/.../manifest.json",
    "promotedCount": 3,
    "duplicateCount": 1,
    "rejectedCount": 0,
    "files": []
  },
  "rebuild": {
    "committed": true,
    "previousTransactionCount": 100,
    "newTransactions": 25,
    "totalTransactions": 125,
    "importedFiles": [],
    "failedFiles": [],
    "appliedEdits": 7,
    "migratedEditTargets": 2,
    "unresolvedEditTargets": 0
  }
}
```

A 201 response means staging/promotion was processed; callers must still check
`rebuild.committed`. If it is false, the response lists parse failures and the
last known-good snapshot remains authoritative.

The Imports page presents promoted, duplicate, and rejected counts after every
processed import, plus an expandable result for every file showing its decision,
message, and destination or existing duplicate where applicable.

`migratedEditTargets` counts legacy exact-ID rule parameters safely retargeted
to one uniquely equivalent rebuilt transaction. `unresolvedEditTargets` counts
missing or ambiguous parameters preserved unchanged for review; MiM never
broadens or drops them silently.

### `POST /api/import/rebuild`

Runs the same full rebuild over server-side statements without an upload. This
is a maintenance operation. It returns the `rebuild` object shown above.

### `GET /api/import/history`

Read-only view of existing staging manifests. Query fields: zero-based `page`,
`pageSize` (1–50), `search`, and `status` (`all`, `promoted`, `duplicate`, or
`rejected`). Returns `entries`, `total`, `totalRecorded`, `unreadableCount`,
`page`, and `pageSize`. Regular-file and size/schema validation prevents unsafe
or malformed receipts being presented as valid. Pagination bounds the response;
the service still scans manifests before filtering.

These receipts describe received files, byte digests, and promotion decisions.
They do not retain the later rebuild outcome or establish first-ever import time.

## Compatibility policy

The API is currently internal to the shipped website and is not versioned.
Persisted data compatibility has higher priority: enum numbers, account config
decoding, legacy dictionary shapes, and `LatestMergedEdits.json` replay are
covered by tests. Introduce explicit `/api/v2` routes before making a breaking
contract available to third-party clients.
