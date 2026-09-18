# Testing and legacy verification

MoneyInMotion uses Vitest projects for all three workspaces and Testing Library
for browser behavior. The suite is designed to protect domain compatibility and
the hosted security/storage boundary, not just individual utility functions.

## Required verification

Run from the repository root:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run smoke:production
npm audit --audit-level=high
```

`./build.sh test` combines type checking, lint, the production build, and the
full test suite. CI additionally checks formatting and performs a high-severity
dependency audit on pushes and pull requests. It then runs the production
installer (including development-dependency pruning) and the dependency-free
production smoke test.

## Test coverage map

- Core tests cover audit data, serialization, effective edited values, edit
  merge/void semantics, date and string helpers, merchant normalization,
  parent-child and generic matching, key counters, net totals, and aggregation.
- Server tests cover each source parser, CSV ambiguity/recovery, parser
  selection, top-level account discovery, recursive/case-insensitive statement
  scanning, legacy snapshot codecs,
  cache load/replay/save, side-effect-free edit and rebuild failures,
  all-or-nothing rebuild behavior, folder path safety, persisted JSON shape
  validation, staging manifests, content deduplication, collision naming, and
  strict HTTP routes. Persistence tests also cover shared atomic replacement
  and cleanup after a failed rename.
- Web tests cover API failures and payloads, navigation state, account CRUD,
  folder upload interaction, Settings restart semantics, Welcome workflow,
  scope editing, amount/date/reason/name correction, Rules history/reset, and
  keyboard-driven application behavior.

Use `npm run test:coverage` to find unexercised branches, but do not treat a
percentage as a substitute for fixtures that represent real provider exports.

## Last verified baseline

The complete acceptance run on 2026-09-17 produced:

- 63 passing test files and 724 passing tests;
- 85.49% statement, 75.09% branch, 81.13% function, and 86.32% line coverage;
- clean TypeScript, ESLint, Prettier, shell-syntax, and optimized production
  build checks;
- zero vulnerabilities from `npm audit --audit-level=high`; and
- successful production-mode HTTP smoke tests with the expected health,
  static-site fallback, same-origin routing, persisted data after restart, and
  security-header behavior.

An earlier production-pruning verification ran the smoke test after
`./install.sh` removed the compiler, test runner, and browser build dependencies.
The resulting production
`node_modules` occupied approximately 13 MiB, compared with approximately
286 MiB for the complete development installation. The supplied systemd unit
also passes `systemd-analyze verify`.

Coverage is a directional baseline rather than a release threshold. The most
important safety paths—staging path validation and deduplication, all-or-nothing
snapshot commits, legacy codecs and IDs, rule migration, child persistence,
parsers, account operations, and edit workflows—have direct behavioral tests.

## Read-only legacy comparison

The supplied reference at `/mnt/d/Dropbox/MoneyAI/` is strictly read-only. The
verification command enforces the intended workflow operationally: it reads the
legacy snapshot and edits, copies account configs plus only the statement
generation referenced by that snapshot into a newly created OS temporary
directory, rebuilds there, prints JSON metrics, and removes the temporary copy.

```bash
npm run build
npm run verify:legacy -- /mnt/d/Dropbox/MoneyAI/
```

Use `--keep-temp` only when a maintainer needs to inspect the isolated output:

```bash
npm run verify:legacy -- /mnt/d/Dropbox/MoneyAI/ --keep-temp
```

The script never constructs a write-capable cache or repository on the supplied
legacy root. It exits nonzero if a selected statement fails or the rebuilt
candidate is not committed. It also reloads the newly saved snapshot and exits
nonzero if top-level count, all-node count, or effective total changed across
that persistence round trip. This protects child-graph serialization, not just
the pre-save in-memory model.

## Interpreting parity

Exact equality is expected for account/date coverage and saved-edit replay.
Transaction counts can differ when content-identical overlapping exports are
deduplicated; top-level and all-node counts must be compared separately. The
report includes account counts, account amounts, top-level amounts, exact-ID
rule-target resolution, and save/reload deltas so a count shift cannot
masquerade as silent loss of an account or correction.

The verified reference snapshot ends in April 2015 while its Statements tree
contains later exports through 2016. Comparing every current file with that old
snapshot is invalid, so the script selects source basenames and accounts from
legacy import metadata. One legacy synthetic matcher source has no physical
statement by design. Current observed results and their explanation are recorded
in [Legacy divergences](legacy_divergence.md).

The 2026-08-28 reference run selected 102 physical files for 103 legacy import
sources (the extra source is synthetic), spanning eight accounts from
2000-08-09 through 2015-04-08. It replayed all 431 rules. Of 162 exact-ID scope
parameters, 125 resolved and 37 were already orphaned in the legacy snapshot;
the rebuilt snapshot retained precisely the same 125/37 split after migrating
107 changed target occurrences. It persisted 5,260 top-level and 8,071 all-node
transactions with zero top-level count, all-node count, or effective-amount
change on reload. The documented difference from the legacy materialization is
31 deduplicated top-level rows totaling $509.65, offset in the top-level view by
four Amazon orders totaling -$46.35 that one-to-one matching no longer attaches
to already-used parents. The resulting delta is -27 top-level and -30 all-node
transactions; it is not missing source coverage or persistence loss.

## Adding a regression

Use sanitized, minimal fixture data. Tests must not import a person's complete
financial tree or snapshot into the repository. For a discovered production
failure:

1. reduce it to the smallest row/header/config that reproduces the behavior;
2. remove personal identifiers while retaining delimiters and field shapes;
3. prove the test fails for the intended reason;
4. implement the correction in the responsible layer; and
5. run the full suite and isolated legacy comparison.

A deliberate parity change also requires an entry in
[Legacy divergences](legacy_divergence.md); a deferred mismatch belongs in
[Legacy limitations](legacy_limitations.md).
