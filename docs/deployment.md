# Optional: deploy on a Linux VM

The normal way to run MiM is on your own computer with `run.bat` or `run.sh`
(see the [README](../README.md#quick-start)). This page covers the optional
setup on a small Linux VM: one Node.js process, one data directory, systemd,
and an optional HTTPS reverse proxy. There is no Docker, database, or cluster.

```text
browser ──HTTPS──> reverse proxy (optional on a private network)
                         │
                         ▼
                  Node.js / Express :3001     serves the website and /api
                         │
                         ▼
              /srv/moneyinmotion/<username>
```

**MiM has no login.** Anyone who can reach the port can read and change
everything. Keep the VM on a private network or VPN, or behind an
authenticating HTTPS proxy, and never expose port 3001 to the Internet. See
[SECURITY.md](../SECURITY.md).

## One-time setup

Install Git, Node.js 24 or newer, and Python 3.9+ (for backup and restore) in
a stable system path such as `/usr/bin`, not through an interactive version
manager. Check them:

```bash
node --version && npm --version && git --version && python3 --version
```

Create a service account and directories. These paths match the included
systemd unit:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin moneyinmotion
sudo git clone https://github.com/sytelus/MoneyInMotion.git /opt/moneyinmotion
sudo mkdir -p /srv/moneyinmotion
sudo chown -R moneyinmotion:moneyinmotion /opt/moneyinmotion /srv/moneyinmotion
sudo -H -u moneyinmotion bash -lc 'cd /opt/moneyinmotion && ./install.sh'
```

[`install.sh`](../install.sh) runs `npm ci`, type-checks, builds, and then
prunes development packages so the VM runs only what the server needs. Run it
again after every upgrade; it reinstalls the build tools first.

Write the service user's config. It is the only setting source, also editable
in **Settings**, and changes take effect after a restart:

```bash
sudo -H -u moneyinmotion mkdir -p /home/moneyinmotion/.moneyinmotion
sudo -H -u moneyinmotion editor /home/moneyinmotion/.moneyinmotion/config.json
```

```json
{
  "dataRoot": "/srv/moneyinmotion",
  "username": "you",
  "port": 3001,
  "host": "127.0.0.1"
}
```

`host` defaults to `127.0.0.1`, which only a proxy on the same VM can reach.
Set it to the VM's private address, or `0.0.0.0` for all interfaces, only
when the network itself is trusted. An invalid file stops startup and is left
untouched for repair.

## Run with systemd

[deploy/moneyinmotion.service](../deploy/moneyinmotion.service) assumes the
repository in `/opt/moneyinmotion`, the `moneyinmotion` user and group, and
`node` in `/usr/local/bin` or `/usr/bin`. Edit the unit if yours differ.

```bash
sudo cp /opt/moneyinmotion/deploy/moneyinmotion.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now moneyinmotion
curl --fail http://127.0.0.1:3001/api/health
sudo journalctl -u moneyinmotion -f      # logs
```

For a foreground run instead, use `./run.sh` as the service user. After
`install.sh` has pruned the build tools, it serves the existing build and
warns if the source is newer.

## HTTPS and remote access

If the VM is reachable outside a trusted network, put a reverse proxy or
access gateway in front of `127.0.0.1:3001`. It must:

- terminate TLS and authenticate every route;
- proxy both the website and `/api` to the same MiM process;
- preserve the browser-facing `Host` header (including a non-default port),
  plus `Origin` and `Sec-Fetch-Site` when present, because the API rejects
  browser changes from other origins;
- accept multipart bodies up to 100 MiB (at most 200 files, 20 MiB each); and
- allow a long upstream timeout for the rebuild that follows an upload.

Don't cache API responses in a shared cache, and don't log statement
filenames, request bodies, or edit payloads.

## Upgrade

Take a backup (below) first. Then:

```bash
sudo systemctl stop moneyinmotion
sudo -H -u moneyinmotion git -C /opt/moneyinmotion pull --ff-only
sudo -H -u moneyinmotion bash -lc 'cd /opt/moneyinmotion && ./install.sh'
sudo systemctl start moneyinmotion
curl --fail http://127.0.0.1:3001/api/health
```

Then check Accounts, the latest month, and Rules in the browser.

## Backup and recovery

Use **Settings → Create full backup**; see
[backup-and-restore.md](backup-and-restore.md) for what it contains, where it
is written, and how restore works. Also keep `~/.moneyinmotion/config.json`.
Backups are unencrypted, so encrypt a copy and store it off the VM.

Run one MiM process per data directory, and don't let other tools write into
it while MiM runs.
