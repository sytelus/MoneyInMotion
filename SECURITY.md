# Security policy

MoneyInMotion processes bank statements and personal financial corrections.
Treat its source inputs, generated snapshots, staging manifests, backups, logs,
and configuration as highly sensitive data.

## Supported version

Security fixes are applied to the current default branch. This project does not
currently maintain parallel long-term-support release lines.

## Important deployment status

The current application has no native authentication or authorization. Every
person who can reach the website can read and change the configured user's data,
upload statements, manage accounts, and change persisted Settings.

Until an authentication layer is implemented:

- do not expose MiM directly to the public Internet;
- bind it to a trusted private network or put every path behind an
  authenticating access gateway/reverse proxy;
- use HTTPS whenever traffic leaves the server host;
- run one unprivileged service account with access only to its MiM data and
  config directories;
- do not run multiple writer instances against one filesystem root; and
- encrypt server disks and backups and restrict their retention/access.

Helmet headers, same-origin site/API serving, upload bounds, runtime validation,
path containment, and generic production error responses are defense in depth;
they do not establish user identity.

## Reporting a vulnerability

Do not open a public issue containing an exploit, statement content, user paths,
credentials, tokens, or personal financial data. Use GitHub's private security
advisory/reporting feature for this repository when available. Otherwise,
contact the repository owner privately using the contact method on the GitHub
profile and request a secure reporting channel before sending sensitive detail.

Include, when safe:

- affected revision and deployment mode;
- reproducible steps using synthetic data;
- impact and required attacker access;
- relevant sanitized request/response details; and
- a proposed mitigation if known.

You should receive acknowledgement after the maintainer reviews the private
report. Disclosure timing will be coordinated around validation, a fix, and a
safe upgrade path. Never use real user data to demonstrate a report.

## Sensitive-data rules for contributors

- Never commit statements, snapshots, edits, staging batches, private config,
  browser captures with financial values, or copied legacy data.
- Reduce regressions to sanitized minimal fixtures.
- Never write to `/mnt/d/Dropbox/MoneyAI/`; it is a read-only verification
  source. Use the isolated verifier documented in
  [Testing and legacy verification](docs/testing-and-verification.md).
- Avoid logging request bodies, uploaded contents, corrected values, or full
  server paths. Production unexpected errors should remain generic to clients.
- Review dependency changes with `npm audit` and inspect release provenance for
  security-critical packages.

## Backup and incident response

Keep encrypted, tested backups of `Statements`, `LatestMergedEdits.json`, and
the remaining active user directory. If compromise is suspected, stop access,
preserve relevant infrastructure logs without copying financial payloads,
rotate proxy/session credentials, restore to a clean host, and verify data from
known-good source exports plus edits. The generated snapshot alone is not a
complete recovery source.
