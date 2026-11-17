# Security

MiM handles bank statements and personal financial corrections. Treat its
statements, snapshots, edits, staging receipts, backups, logs, and config as
sensitive.

## No login, so keep it local

MiM has no authentication. Anyone who can reach its port can read everything,
upload statements, change accounts and rules, and replace data through
restore. By default the server listens only on `127.0.0.1`, so only your own
machine can reach it. Setting `host` in `~/.moneyinmotion/config.json` (for
example `"0.0.0.0"`) exposes it to the network; then keep the port closed in
the firewall on shared networks. If you deploy to a VM ([docs/deployment.md](docs/deployment.md)), keep it on a
private network or VPN, or behind an authenticating HTTPS reverse proxy.
Never expose the port directly to the Internet.

Defense in depth, which does **not** establish identity: Helmet headers;
site and API on one origin; `Cache-Control: no-store`; browser mutations with
a foreign `Origin` or cross-site Fetch Metadata are rejected before their
bodies are read; bounded JSON and upload sizes; Zod validation; path
containment; no symlink following below account folders; and generic error
messages in production.

## Data handling rules

- Never commit statements, snapshots, edits, staging batches, private config,
  or screenshots with financial values. Reduce failures to sanitized fixtures.
- Never write to the old C# app's folder (`D:\Dropbox\MoneyAI\`); it is
  strictly read-only.
- Don't log request bodies, uploaded contents, corrected values, or full
  paths.
- Backups are **unencrypted** ZIPs in the server user's home folder. Keep an
  encrypted copy on another device. Restore only archives you trust: the
  checksums detect damage, not tampering.
- Run only one MiM process per data folder, and keep sync tools from writing
  into it while MiM is running.
- On Windows, file permission bits don't apply. A data folder directly under a
  drive root (for example `E:\data`) inherits that drive's permissions, which
  often let every local user read it. Restrict the folder's permissions to your
  account if others use the machine.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Don't open a
public issue with exploit details or any real financial data.
