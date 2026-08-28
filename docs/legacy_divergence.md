# Intentional legacy divergences

This file records behavior that intentionally differs from the former C# and
machine-local browser application. These are product and safety decisions, not
untracked porting gaps.

## Hosted application instead of a local desktop companion

The legacy runtime combined local C# processing, a local browser host, and data
paths on the user's machine. MiM is now a conventional hosted website: React
runs in the browser, while an Express service performs parsing, matching, and
persistence on the server. Browser users install nothing.

Justification: this is the requested deployment model, produces one supported
runtime, removes platform-specific binaries and package payloads, and permits
remote browser access. The C# solution and local host were removed from the
working tree after their behavior was ported; they remain in Git history.

## Directory upload instead of entering a local path

A hosted server cannot read a filesystem path typed in a remote browser. The
Accounts screen uses a browser directory picker and uploads file bytes with
their safe relative paths. The server maps account subfolders to configured
relative account directories.

Justification: this respects the browser security model and works when browser
and server are different machines. The UI explains that selection alone sends
nothing and provides the expected folder names.

## Username-scoped storage root

Data now lives beneath configurable `<data-root>/<username>`, defaulting to
`~/min_root/<OS username>`. The legacy single `dataPath` setting is translated
on read, and older `MONEYAI_*` environment aliases are accepted.

Justification: the directory contract is ready for future users without
premature authentication or tenancy logic. A running process intentionally
serves one active username until that work exists.

## Staging, SHA-256 deduplication, and automatic rebuild

The legacy workflow exposed separate scan/import/save concepts and identified
some duplicates through legacy transaction/import hashes. The hosted workflow
first preserves every received file in a unique staging batch, records a
manifest, compares SHA-256 content within the target account, promotes only new
content, and immediately performs a complete rebuild. Edits and successful
snapshots save automatically.

Justification: uploads become supportable and auditable; repeated downloads or
renamed identical files are harmless; users cannot forget the scan or save
step. SHA-256 is used for file-content identity. Legacy MD5-derived transaction
and scope IDs remain where changing them would break persisted compatibility.
Modern import addresses include the account-relative portable path instead of
the legacy basename alone, avoiding cross-account and nested-folder collisions.
Exact-ID rule migration bridges identity changes when upgrading an existing
snapshot.

## Candidate rebuild instead of partial success

The new snapshot is assembled separately and committed only when every
discovered source parses. A failed source is reported and the previous snapshot
stays active. Promoted statements and staging evidence remain available to fix
and retry.

Justification: a partial financial history can look valid while producing
dangerously wrong totals. Explicit failure is safer than silent omission.

## Account configuration is managed by the server

The Accounts website lists recursive `AccountConfig.json` folders and supports
create, edit, and conservative delete. Uploaded `AccountConfig.json` files are
staged but rejected; the account editor is authoritative. Canonical writes use
camel case while legacy Pascal-case account-info input remains readable.

Account IDs become immutable after statements or transactions exist. Deletion
removes only the config and an empty directory, never a statement tree.

Justification: a browser upload must not silently replace parsing identity or
retarget historical transactions, and destructive account cleanup should
require deliberate server administration.

## Corrections affect all financial behavior

Amount, date, reason, entity, category, note, and flag corrections are available
in the website. Effective corrected amount and reason drive aggregation,
summary, net grouping, display, and later rule scopes. A date correction changes
period placement. Raw imported fields stay immutable, rules persist to
`LatestMergedEdits.json`, and Rules provides audited reversal.

Justification: presenting a corrected number while calculating from a raw one
would be internally inconsistent. The legacy edit file remains the persistence
contract, but the UI now exposes all meaningful editable fields coherently.

## Cross-platform and strict parsing fixes

Statement filters match extensions case-insensitively so `*.csv` also accepts
legacy `.CSV` exports on Linux. Ambiguous extra CSV fields now fail the rebuild
instead of being truncated. A narrow compatibility recovery handles legacy
rows whose unquoted final negative amount contains a thousands separator (for
example, two trailing columns that mathematically form one amount).

Justification: filesystem case should not change imported history, while silent
column loss is unsafe. The recovery is constrained to a recognizable numeric
case found in the supplied reference data.

## Verified duplicate and relationship differences

The read-only comparison selects the same saved generation: 103 legacy import
sources, of which 102 are physical statement files and one is a synthetic
matcher source. Both results cover eight accounts and the same date span
(`2000-08-09` through `2015-04-08`). All 431 saved rules are replayed. The edit
file contains 162 exact-ID target parameters; 125 still identify transactions
in the legacy snapshot and 37 were already orphaned there. MiM safely migrates
61 target occurrences whose generated ID changed, and the persisted rebuild
resolves the same 125 while preserving the same 37 unresolved parameters.

The legacy snapshot has 5,287 top-level and 8,101 total graph nodes. The
persisted modern rebuild has 5,256 top-level and 8,069 total nodes, with no
count or amount change after save/reload. The remaining deltas are therefore
-31 top-level and -32 all-node transactions—not a serialization loss.

The 31 top-level rows are semantically repeated transactions retained from
overlapping exports in the old materialized snapshot: 29 Chase rows totaling
-$397.19, one Barclay row at -$5.46, and one Etsy order/receipt at -$107.00.
Modern canonical parsing and content merging retain one financial occurrence,
so the top-level total is $509.65 less negative. Amazon, Amex, checking,
savings, and PayPal top-level counts and totals match exactly.

The all-node effective amount delta is $658.72 because child nodes are not an
independent cash-flow total. Amazon has two fewer child graph nodes and a
$256.07 all-node delta while its top-level count and total are exact. Etsy has
one fewer top-level node but the same all-node count and amount after
relationship synthesis. The top-level $509.65 is the relevant cash-flow
divergence; summing parents and children together double-counts purchases.

During verification, MiM also corrected three porting bugs rather than
documenting them as acceptable differences: microscopic binary-float adjustment
children are rounded to currency precision, the MD5/transaction-ID algorithm
now follows the actual C# hex and content-field contract, and parent/child
objects retain live references so child rules survive persistence.

Justification: duplicate financial rows should not be reintroduced merely to
match an obsolete snapshot total. The compatibility boundary is complete
source/account/date coverage, deterministic retained cash flow, all rule
history, equal resolution of every still-valid exact-ID target, and a zero-drift
save/reload—not preservation of known overlapping-export duplicates.

## Modern responsive interaction

Navigation, Accounts, Settings, Rules, transaction hierarchy, summaries,
dialogs, context actions, focus states, keyboard shortcuts, and mobile period
controls are implemented as a responsive React site. Explicit scan/save buttons
were removed from ordinary navigation because those operations are automatic;
Settings retains a labeled maintenance rebuild.

Justification: the legacy desktop-shaped workflow did not set appropriate
expectations for a hosted, touch-capable, failure-reporting website.
