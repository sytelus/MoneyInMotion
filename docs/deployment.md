# Production deployment

MoneyInMotion is designed to run cheaply on one ordinary Linux VM. Production
has three moving parts: one Node.js process, one data directory, and an optional
HTTPS reverse proxy. There is no Docker, database, message queue, object store,
or cluster to operate.

```text
browser ──HTTPS──> reverse proxy (optional on a private network)
                         │
                         ▼
                  Node.js / Express :3001
                         │
                         ▼
              /srv/moneyinmotion/<username>
```

The Node process serves both the compiled React website and `/api`, so only one
application port is needed. Browser users install nothing.

## Security prerequisite

MiM currently has no login or authorization layer. Anyone who can reach it can
view and change the configured user's financial data and Settings. Bind it to a
trusted private network, access it through a private VPN/tunnel, or put an
authenticating HTTPS reverse proxy in front of it. Do not expose port 3001
directly to the public Internet.

## One-time VM setup

Install Git, Node.js 24, and Python 3.9+ (for ZIP backup/restore) on a current Linux distribution. The exact Node
installation command depends on the distribution; verify the result before
continuing:

```bash
node --version
npm --version
git --version
python3 --version
```

Create a dedicated service account and directories. These example paths match
the included systemd unit:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin moneyinmotion
sudo git clone https://github.com/sytelus/MoneyInMotion.git /opt/moneyinmotion
sudo mkdir -p /srv/moneyinmotion
sudo chown -R moneyinmotion:moneyinmotion /opt/moneyinmotion /srv/moneyinmotion
```

Install and build as the service user:

```bash
sudo -H -u moneyinmotion bash -lc 'cd /opt/moneyinmotion && ./install.sh'
```

The production install performs a reproducible `npm ci`, type-checks and builds
the site, then removes compilers, tests, and other development-only packages.
This keeps the running VM smaller while leaving all build instructions in the
repository. A later `./install.sh` restores build dependencies for an upgrade
and prunes them again afterward.

## Configuration

Create the service user's single configuration file:

```bash
sudo -H -u moneyinmotion mkdir -p /home/moneyinmotion/.moneyinmotion
sudo -H -u moneyinmotion editor /home/moneyinmotion/.moneyinmotion/config.json
```

```json
{
  "dataRoot": "/srv/moneyinmotion",
  "username": "shitals",
  "port": 3001
}
```

`~/.moneyinmotion/config.json` is the only application configuration source and
can also be viewed and updated through the website's Settings page. Invalid
roots, usernames, or ports fail startup rather than silently selecting a
different directory or listener. The invalid file is preserved for repair;
moving it aside intentionally recreates defaults on the next start. File or
website changes take effect after a server restart.

## Run with systemd

The repository includes [deploy/moneyinmotion.service](../deploy/moneyinmotion.service).
It assumes:

- repository: `/opt/moneyinmotion`;
- service user/group: `moneyinmotion`;
- Node executable available as `node` in `/usr/local/bin` or `/usr/bin`; and
- configuration file: `/home/moneyinmotion/.moneyinmotion/config.json`.

If Node is installed elsewhere, or if different directories are chosen, edit
the unit before installing it. Avoid an interactive version manager for a
system service; install the selected Node version in a stable system path.

```bash
sudo cp /opt/moneyinmotion/deploy/moneyinmotion.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now moneyinmotion
sudo systemctl status moneyinmotion
curl --fail http://127.0.0.1:3001/api/health
```

Useful operating commands are deliberately ordinary:

```bash
sudo systemctl restart moneyinmotion
sudo systemctl stop moneyinmotion
sudo journalctl -u moneyinmotion -f
```

For a temporary foreground run instead of systemd:

```bash
./run.sh
```

## HTTPS and remote access

If the VM is reachable outside a trusted network, place a small reverse proxy
or access gateway in front of `127.0.0.1:3001`. It must:

- terminate TLS and authenticate every route until MiM has native login;
- proxy both static paths and `/api` to the same MiM process;
- preserve the browser-facing `Host` header (including a non-default port),
  plus `Origin` and `Sec-Fetch-Site` when present; the API rejects browser
  mutations from other origins. TLS can terminate at the proxy;
- permit multipart request bodies up to MiM's 100 MiB request limit (with at
  most 200 files and 20 MiB per file); and
- allow a long enough upstream timeout for the synchronous rebuild that follows
  an upload.

Do not put API responses containing financial data in a shared cache, and avoid
logging statement filenames, request bodies, or edit payloads.

## Upgrade

Use one writer and stop it during an application upgrade:

```bash
sudo systemctl stop moneyinmotion
sudo -H -u moneyinmotion git -C /opt/moneyinmotion pull --ff-only
sudo -H -u moneyinmotion bash -lc 'cd /opt/moneyinmotion && ./install.sh'
sudo systemctl start moneyinmotion
curl --fail http://127.0.0.1:3001/api/health
```

Before upgrading, back up the active user directory and configuration. CI
should pass before the revision is deployed. After startup, inspect Accounts,
the latest month, and Rules.

For release handoff, follow [UX-19 and UX-20](UX_DESIGN_GUIDE.md): state which
build is running, the production URL/command, active data location, restart or
rebuild needs, checks performed, and remaining limitations. A successful build
or Git push does not by itself establish that the running user-facing service
has been upgraded.

## Backup and recovery

Back up the complete active user directory while no import or edit is running.
At minimum protect:

- `Statements`: source files needed to regenerate history;
- `Merged/LatestMergedEdits.json`: corrections and reusable rules;
- `Merged`: the current materialized snapshot and local backups; and
- `staging`: manifests and recovery copies, according to the chosen retention
  policy.

Also back up `~/.moneyinmotion/config.json`. Encrypt backups and store a copy off
the VM.

Settings now provides **Create full backup** and **Review restore**. ZIPs default
to the server user's home directory; restore validates an archive, requires
explicit confirmation, replaces the whole active user tree, and retains the
previous tree/config. See [Backup and restore](backup-and-restore.md) for the
Python prerequisite, limits, original-location restriction, and recovery marker.

Do **not** rebuild merely to finish a restore: loading the archived snapshot
preserves its saved state. A rebuild is a separate operation that may change
derived results under newer application code. For offline recovery, stop MiM,
extract into a dedicated empty location, retain the old tree, restore the config,
verify ownership, start, and inspect Accounts, Overview, and Rules first.

## Operational boundary

One Node process is the supported writer. Do not run two MiM services against
the same data directory. The current filesystem persistence and in-memory cache
are intentionally simple and do not implement distributed locking.

`GET /api/health` is a liveness check. Logs go to standard output, which systemd
captures in the journal. Metrics, tracing, background jobs, and clustered
operation are deliberately outside the current single-user design.
