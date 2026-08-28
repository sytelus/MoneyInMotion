# Contributing to MoneyInMotion

Thank you for improving MiM. Financial software rewards conservative,
well-explained changes: preserve source data, make failure visible, and prove
behavior with small tests.

## Before making a change

Read the relevant documents in [docs](docs/README.md), especially
[Architecture](docs/architecture.md), [Domain rules](docs/domain-rules.md), and
[Security](SECURITY.md). Search existing code and tests before introducing a
new abstraction. If a change intentionally differs from legacy behavior, update
`docs/legacy_divergence.md`; if work is deferred, update
`docs/legacy_limitations.md` or `docs/legacy_suggested_improvements.md`.

Never commit or modify real reference financial data. In particular,
`/mnt/d/Dropbox/MoneyAI/` is strictly read-only.

## Setup

```bash
git clone https://github.com/sytelus/MoneyInMotion.git
cd MoneyInMotion
./install.sh --development
./run.sh
```

Node.js 24 or newer is required. Use npm workspaces and keep
`package-lock.json` synchronized with `package.json`.

## Development expectations

- Keep domain logic in `packages/core`, server/filesystem adapters in
  `packages/server`, and interaction/presentation in `packages/web`.
- Maintain strict types and validate untrusted runtime data.
- Preserve immutable statement inputs and atomic replacement of generated
  files.
- Constrain every derived filesystem path to its configured root.
- Keep discovery, IDs, matches, and serialized output deterministic.
- Add doc comments for exported contracts and comments for non-obvious safety
  or financial decisions. Prefer names and small functions over narration.
- Build responsive, keyboard-accessible, labeled UI with visible focus and
  non-color status cues.
- Include sanitized regression fixtures for parser changes.

See [Development](docs/development.md) for detailed change checklists.

## Verification

Before submitting a change, run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
```

Changes to parsing, matching, serialization, edits, or storage should also run
the read-only verifier when the reference is available:

```bash
npm run verify:legacy -- /mnt/d/Dropbox/MoneyAI/
```

Explain deliberate output differences and include the relevant focused tests.
Do not attach unsanitized verifier output if account names or filesystem paths
are confidential.

## Pull requests

Keep a pull request focused. Its description should state:

- the user-visible outcome;
- the invariant or bug being addressed;
- tests and manual verification performed;
- persistence/API compatibility impact;
- security and privacy considerations; and
- documentation or migration notes.

Generated build artifacts, dependency directories, coverage output, private
data roots, and TypeScript build-info files do not belong in commits. Git
history is the archive for removed legacy runtimes; do not restore them merely
to keep a second implementation in the active tree.
