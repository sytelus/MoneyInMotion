# Data layout and import

## Data-root layout

The user supplies a data root. If no root is supplied, the current version
attempts to locate a `MoneyAI` directory in the user's Dropbox installation.

```text
<root>/
  Statements/
    <account or grouping directory>/
      AccountConfig.json
      <statement files>
      <optional nested directories>/
  Merged/
    LatestMerged.json
    LatestMergedEdits.json
    <timestamped edit snapshots>
    NamedLocations.json              # optional
```

`Statements` and `Merged` are fixed default directory names. The current
version expects the required parent directories to exist before scanning or
saving. Creating a new account can create its account directory and
`AccountConfig.json`, but general root initialization is not part of the scan.

When `Merged/NamedLocations.json` exists, it can replace the default locations
for the named merged snapshot and edit aggregate.

## Account configuration and directory discovery

The scanner starts at `<root>/Statements` and walks directories recursively.
For each directory:

1. If `AccountConfig.json` exists, it becomes the active configuration.
2. Otherwise, the directory inherits its parent's active configuration.
3. If a configuration is active, files matching each configured file filter
   are imported from that directory.
4. Subdirectories are visited when there is no active configuration or when
   the active configuration enables subdirectory scanning.

This permits both the usual one-directory-per-account layout and deeper
grouping such as account/year/month. A nested `AccountConfig.json` overrides
the inherited configuration for that subtree.

An account configuration contains:

- `AccountInfo.Id`: stable account identifier and default account-directory
  name when an account is created.
- `AccountInfo.Type`: credit card, checking, savings, order history, or
  electronic payment.
- `AccountInfo.InstituteName`: selects institution-specific parsing and, for
  parent-required transactions, matching behavior.
- `AccountInfo.Title`: optional display title.
- `AccountInfo.RequiresParent`: default for transactions that should be
  attached below another transaction.
- `AccountInfo.InterAccountNameTags`: text fragments used when finding payment
  or transfer counterparts in other accounts.
- `FileFilters`: filename patterns to import; the default is `*.csv`.
- `ScanSubFolders`: whether the active configuration continues into nested
  directories; the default is `true`.

The configuration selects candidate files, but it does not contain a general
parser plug-in definition. Parser selection is fixed by institution, account
type, and file extension in this version.

## Supported statement sources

| Institution/account behavior | Formats | Important behavior |
| --- | --- | --- |
| American Express | CSV | Uses the institution's fixed column layout and extracts reference and category details. |
| Barclay Bank | CSV | Accepts banner lines before the statement header. |
| Amazon order history | CSV | Produces order totals and item-subtotal children and ignores planned or not-yet-shipped orders. |
| Etsy buyer history | JSON | Produces receipt totals and individual purchase items. |
| PayPal electronic payments | CSV, IIF | Filters non-final activity and classifies payments, receipts, refunds, and funding transfers. |
| Other institutions | CSV | Uses generic header mappings and transaction-reason inference. |

The generic parser recognizes common date, description/payee, amount,
debit/credit, category, account, check-reference, and institution-reference
columns. Unrecognized columns are retained as provider-specific attributes.

Outgoing amounts are expected to be negative and incoming amounts positive.
Transactions missing an amount, date, or entity name are invalid. Unsupported
formats, account/parser combinations, malformed values, and unknown required
transaction types stop processing rather than being silently ignored.

## Import and transaction identity

Each statement location receives an import identifier derived from the
statement's relative path. Despite the field name `ContentHash`, statement
import identity is not based on file bytes in this version. File creation and
last-write timestamps are retained as metadata.

Each parsed transaction normally receives:

- a content hash based on account, original reason, amount, entity identity or
  name, dates, and institution reference; and
- a transaction identifier based on that content plus row/reference details.

The PayPal parser overrides the normal content hash with one derived from its
name, source date, amount, and PayPal activity type. Transaction identifiers
still use the common transaction-content calculation.

Consequences:

- Duplicate rows within one source file are accepted.
- Equivalent transaction content found in later files is normally not added
  again.
- A uniquely matched duplicate from another format in the same account may
  enrich the retained transaction with better attributes.
- Transaction IDs are usually stable when parsed content, row order, culture,
  and references remain stable.
- An incremental merge can skip a changed file at the same relative path, and
  it does not remove transactions when an old input disappears. A full rebuild
  is required to reflect replacements and deletions reliably.
