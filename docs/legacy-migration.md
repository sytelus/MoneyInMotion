# Legacy migration (C# MoneyAI → MiM)

The original MoneyAI was a C# desktop app with a local browser UI. Its data
(`LatestMerged.json`, `LatestMergedEdits.json`, `AccountConfig.json`) loads
unchanged in MiM. The C# code was removed from the tree; git history has it.

## Policy: compatibility is temporary

Legacy formats are read **and written**: MD5-based IDs, key/value-array
dictionaries, PascalCase account info, and the numeric `TransactionReason`
flags including misspelled member names. This exists only so the rebuild can
be compared with the legacy results. Once parity is understood and accepted,
the plan is to migrate data once to a cleaner native format and delete the
legacy codecs, the ID compatibility code, and the verifier.

**Status (2026-11-16):** parity is explained (see below). Two porting bugs
found during that review were fixed. Removing the legacy code now only needs
the owner's go-ahead and a one-time rewrite of the account configs, which still
use the legacy PascalCase `accountInfo` shape. The live snapshot and rules are
already in the native format.

## The read-only verifier

The legacy reference data (`D:\Dropbox\MoneyAI\`, formerly
`/mnt/d/Dropbox/MoneyAI/`) is **strictly read-only**.

```bash
npm run build
npm run verify:legacy -- D:/Dropbox/MoneyAI/          # add --keep-temp to inspect output
```

The verifier reads the legacy snapshot and edits. It copies the account
configs and only the statement files referenced by that snapshot into a new
temporary folder, rebuilds there, saves, reloads, and prints JSON metrics.
Then it deletes the copy. It never opens a writable repository on the legacy
root. It exits nonzero on a parse failure, an uncommitted rebuild, or any
count or amount drift across save and reload.

Compare only the same source generation. The reference snapshot ends in
April 2015, while its `Statements` tree also holds newer exports, which is
why the script selects files from the snapshot's import metadata.

## Parity result (2026-11-16 reference run)

- 103 legacy import sources (102 physical files plus one synthetic matcher
  source), 8 accounts, 2000-08-09 to 2015-04-08. Account and date coverage
  match.
- All 431 rules replay. Of 162 exact-ID targets, 125 resolve and 37 were
  already orphaned in the legacy snapshot; the rebuild keeps the same 125/37.
- **Every record and the all-record total match legacy exactly** (8,101
  records), with no drift on save and reload.
- The only remaining difference is where four records sit: +2 top-level rows,
  +$65.23 top-level total.
  - Legacy hung **two orders on one charge** in two places. One charge of
    $5.85 on 2014-05-05 carried both the $5.85 order and a $6.16 order, and one
    charge of $23.71 on 2015-01-22 carried two identical $24.71 orders.
    One-to-one matching gives the charge to the best order and leaves the
    other unmatched (three Amazon rows, −$41.77 at top level). This is correct.
  - One $107 Etsy receipt that legacy left at top level is now matched under
    its card charge.

Bugs found by this review and fixed in the rebuild (they had made the earlier
report show −27 rows and +$463.30):

1. **Repeated purchases inside one statement were dropped.** Identical rows in
   the same file, such as four $2.16 bus fares on one day, were merged into one.
   The C# app kept them and only de-duplicated across overlapping files. Now
   the same is true here, and on the owner's data it restores 55 purchases
   (about $1,266).
2. **Order matching was greedy.** An order seen first could take a charge
   through a ±$1 / ±2-day near match, even when a later order matched that
   charge exactly. Matching now settles exact amount-and-date pairs first,
   then ranks near matches across all orders.

The earlier explanation, "31 rows legacy kept from overlapping exports", was
wrong: the 29 Chase and 1 Barclay rows were repeats within a single file.

## Intentional differences

- **Browser upload instead of a local path:** a server can't read a path typed
  in a browser, so files are uploaded with their relative paths and mapped to
  account folders.
- **Data under `<dataRoot>/<username>`**, configured only through
  `~/.moneyinmotion/config.json`. The legacy `dataPath` key is migrated once,
  and environment overrides are ignored.
- **Upload pipeline:** staging, SHA-256 dedupe per account, promotion, and an
  automatic full rebuild, replacing the separate scan, import, and save
  steps. Import addresses use the account-relative path, not the bare
  basename, which avoids collisions. Exact-ID rules are migrated across the
  ID change.
- **All-or-nothing rebuild:** one bad file keeps the previous snapshot instead
  of producing a partial history.
- **Accounts are top-level folders only.** Nested configs are ignored, and
  uploaded `AccountConfig.json` files are rejected. Account IDs are locked once
  used. Removing an account deletes only its config.
- **Corrections drive every calculation.** Rule conditions test imported
  values, and deleting a rule replays the remaining ones.
- **Stricter parsing:** case-insensitive filters (`*.csv` matches `.CSV`).
  Decoder errors, duplicate headers, overflow fields, partial numbers,
  impossible dates, unknown PayPal time zones, and malformed Amex, IIF, Etsy,
  and JSON rows fail loudly. Date-only values are stored at UTC midnight.
- **One-to-one matching:** a charge parents at most one order and a record
  joins at most one transfer pair. Ties are broken by date distance and then
  by ID. Order completeness uses corrected amounts. The graph is validated
  for cycles, ID collisions, and missing metadata.
- **Porting defects fixed rather than preserved:** adjustment children are
  rounded to cents, MD5 IDs follow the real C# hex and field contract, and
  child rules now survive persistence.
