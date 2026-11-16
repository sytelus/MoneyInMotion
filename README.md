# MoneyInMotion

MoneyInMotion (MiM) is a personal-finance app for one person. You download
statement exports from banks, cards, PayPal, Amazon, and Etsy. MiM imports
them, connects related records into one history, lets you correct anything,
and shows where the money went. It runs on your own computer and you use it
in a browser.

## Goals

These goals decide what gets built and how. The behavior docs under
[docs/](docs/) describe how the current code meets them.

**Who and where**

- **One user:** the project owner. There is no onboarding, multi-user support,
  or login, and none is planned.
- **Your own computer, Windows first.** `run.bat` is the primary way to run
  it, and `run.sh` covers Linux and macOS. A Linux VM is an optional
  deployment ([docs/deployment.md](docs/deployment.md)).
- **Private.** Financial data stays on the machine. No machine learning, and
  no cloud service ever receives transactions. Categorization, matching, and
  insights use deterministic rules and heuristics. Asking a public service
  for a currency's exchange rate on a date is fine, because it reveals
  nothing about your finances.

**Data**

- **The app owns its data folder.** Only MiM writes `Merged/` and `staging/`.
  You manage the inputs: drop new statement files into
  `Statements/<account>/` (or delete some) in Explorer, then choose
  **Rebuild**. Uploading in the browser does exactly the same thing, adding
  files to those folders, so it is just a convenient way to copy many files
  at once.
- **Source files are never modified.** MiM never edits a statement. Every
  correction is a separate edit layered on top.
- **Every correction can be changed or removed.** Removing one replays the
  rest, and everything can be rebuilt from the statements plus the saved edits.
- **One folder per account:** `Statements/<account>/AccountConfig.json`,
  which keeps the account mapping explicit and simple.
- **Every number is traceable.** A total leads to the transactions behind it,
  and each transaction leads to its statement file, row, and corrections.
- **Nothing fails silently.** A bad file or invalid config is reported, and
  the last good state is kept.

**Meaning**

- **Connect related records.** Transfers between accounts are not income or
  spending, a card payment is not an expense, and Amazon or Etsy order lines
  replace the card charge they explain. Duplicate statement rows are merged.
- **Income, spending, savings.** The Overview reports earned **Income**,
  **Spending** with refunds and discounts subtracted from the purchases they
  offset (refunds are linked to their original charge), and the difference as
  **Savings / deficit**. When it isn't clear whether a credit is income, MiM
  asks you to decide rather than guessing. See
  [docs/financial-reports.md](docs/financial-reports.md).
- **USD, with foreign-currency support planned.** Amounts are USD. For a
  foreign-currency transaction, the goal is to use the conversion the
  institution supplied, or look up the rate for that date from an online
  service and let you confirm it. The original amount, currency, and rate
  stay visible. This is not implemented yet.

**Engineering**

- **Keep it simple:** one Node.js process, JSON files on disk, no database or
  background services, until a measured need says otherwise.
- **Legacy C# compatibility is temporary.** The original MoneyAI (C#) data
  format is read and written only so the new code can be checked against the
  old results ([docs/legacy-migration.md](docs/legacy-migration.md)). Once the
  migration is confirmed, the legacy code paths will be removed.

## Quick start

You need Node.js 24 or newer and Git. Backup and restore also need Python
3.9+, using only its standard library.

```bat
git clone https://github.com/sytelus/MoneyInMotion.git
cd MoneyInMotion
run.bat
```

On Linux or macOS, use `./run.sh` instead. The first run installs
dependencies and builds; later runs rebuild only when the source changed.
Open the URL the server prints (`http://localhost:3001` by default).

For development with hot reload, use `run.bat dev` (or `./run.sh dev`) and
open `http://localhost:5173`.

## Configuration and data

`~/.moneyinmotion/config.json` (on Windows, `%USERPROFILE%\.moneyinmotion\config.json`)
is the only application setting source. It is created on first start and is
editable in **Settings**. Changes take effect after a restart.

```json
{
  "dataRoot": "E:/data/mim_root",
  "username": "you",
  "port": 3001
}
```

JSON treats a backslash as an escape character. Write Windows paths with
forward slashes or doubled backslashes (`"E:\\data\\mim_root"`). The app
reports this mistake if it can't read the file.

All data lives under `<dataRoot>/<username>/`:

```text
Statements/<account>/AccountConfig.json   one top-level folder per account
Statements/<account>/**/*.csv|json|iif    statement exports (never modified)
Merged/LatestMerged.json                  rebuilt transaction snapshot
Merged/LatestMergedEdits.json             your corrections and rules (precious)
staging/<batch>/                          upload receipts and copies
```

See [docs/data-and-imports.md](docs/data-and-imports.md) for the full
contract, and [docs/backup-and-restore.md](docs/backup-and-restore.md) for
ZIP backups from Settings.

## Using it

1. **Accounts:** create one account per statement source. The account folder
   name is what MiM expects in uploads.
2. **Imports:** pick a folder that holds one subfolder per account. MiM checks
   folder names before sending anything, stores only new content (deduplicated
   by SHA-256), rebuilds, and reports exactly what happened to each file.
3. **Overview:** a summary of the latest month, with every figure linking to
   its transactions.
4. **Transactions:** search, filter, and inspect records. Correct one, several,
   or all filtered records, or turn a correction into a reusable rule.
5. **Rules:** find, inspect, bulk-edit, or delete saved corrections and see
   which records each one affects.
6. **Settings:** configuration, rebuild, full backup, and restore.

## Commands

| Command                                  | Purpose                                                   |
| ---------------------------------------- | --------------------------------------------------------- |
| `run.bat` / `./run.sh`                   | Install if needed, rebuild if stale, start production     |
| `run.bat dev` / `./run.sh dev`           | API plus Vite website with hot reload                     |
| `npm test`                               | Full test suite                                           |
| `npm run test:e2e`                       | Build, then Playwright browser journeys on synthetic data |
| `npm run typecheck` / `lint` / `format`  | Static checks                                             |
| `npm run build`                          | Build core, server, and website                           |
| `npm run smoke:production`               | Start the built server against a throwaway data root      |
| `npm run verify:legacy -- <legacy-root>` | Read-only comparison with the legacy C# snapshot          |
| `./install.sh` / `./build.sh`            | Linux VM install (prunes dev tools) / full verified build |

## Repository layout

```text
packages/core/    Domain model, matching, aggregation, rules, legacy-compatible serialization
packages/server/  Express API, parsers, filesystem storage, uploads, rebuilds, backups
packages/web/     React website
scripts/          run.mjs launcher, backup ZIP helper, smoke test, legacy verifier
deploy/           Optional systemd unit for a Linux VM
docs/             How the system works (see below)
```

## Documentation

- [Architecture](docs/architecture.md): packages, runtime, persistence, limits
- [Data and imports](docs/data-and-imports.md): storage layout, accounts, uploads, rebuilds, parsers
- [Domain rules](docs/domain-rules.md): parsing, matching, and aggregation invariants
- [Edits and rules](docs/edits-and-rules.md): how corrections work and are explained
- [Financial reports](docs/financial-reports.md): Overview calculations and exports
- [Backup and restore](docs/backup-and-restore.md)
- [Development](docs/development.md): setup, conventions, testing, common changes
- [UX guidelines](docs/ux-guidelines.md): how the interface should behave
- [Legacy migration](docs/legacy-migration.md): differences from the C# app and parity checks
- [HTTP API](docs/api.md) and [optional VM deployment](docs/deployment.md)
- [TODO](todo.md) and [Security](SECURITY.md)
