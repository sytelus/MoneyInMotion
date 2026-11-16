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

**Open item:** the remaining parity gap below has not yet been independently
confirmed as correct. Before dropping compatibility, review each delta
against the original statements and look for bugs.

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

## Parity result (2026-08-28 reference run)

- 103 legacy import sources (102 physical files plus one synthetic matcher
  source), 8 accounts, 2000-08-09 to 2015-04-08. Account and date coverage
  match.
- All 431 rules replay. Of 162 exact-ID targets, 125 resolve and 37 were
  already orphaned in the legacy snapshot. The rebuild keeps the same 125/37
  split after migrating 107 changed target IDs.
- Legacy: 5,287 top-level and 8,101 total nodes. MiM: 5,260 and 8,071, with
  no drift on save and reload. **Delta: −27 top-level, −30 total.**
- Explained so far:
  - 31 top-level rows that legacy kept from overlapping exports are merged
    into one occurrence: 29 Chase (−$397.19), 1 Barclay (−$5.46), and
    1 Etsy (−$107.00), removing $509.65 of duplicated outflow.
  - 4 Amazon order rows (−$46.35) stay top level, because one-to-one
    matching no longer reuses a charge that already parents another order.
  - Net top-level cash-flow change: +$463.30 (less negative). Amex,
    checking, savings, and PayPal match exactly.
  - All-node deltas (Amazon −2 nodes / $256.07, Chase −27 / $396.87,
    Barclay −1 / $5.46) are not independent cash flow, because children
    and parents overlap.

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
