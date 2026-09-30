# Full data backup and restore

Use **Settings → Backups and restore** before development, upgrades, or risky
data changes. A backup preserves the active user's stored files and application
configuration. Restore replaces the complete user folder with those saved files;
it does not import statements, merge old and new files, or rebuild transactions.

This feature needs Node.js 24+ and **Python 3.9+**, available as `python3` on the
server. Python's standard-library ZIP implementation streams archive contents;
there are no Python packages to install. Browser users install nothing.

## What is included

Every regular file and empty directory under `<dataRoot>/<username>` is included:

- original statements and top-level account configurations;
- the existing merged snapshot, saved corrections/rules, and older local backups;
- staging files and upload manifests;
- any other regular files within that user's data directory; and
- the exact contents of `~/.moneyinmotion/config.json`, stored separately in the ZIP.

The archive has a versioned manifest containing the creation time, original data
location, username, port, file inventory, sizes, modification times, and SHA-256
checksums. This is an archive format, not a financial schema change or an
import/rule history journal. Checksums detect damage; they do not prove who made
an archive. Only restore backups you trust.

Other users, app source/build files, installed dependencies, browser preferences,
unsaved forms, and backup ZIPs outside the user folder are not included. File bytes,
relative paths, empty folders, and data-file modification times are preserved.
Ownership, permissions, ACLs, creation/access times, and filesystem links are not
portable backup state: restored files are private to the server user (files 0600,
directories 0700). Symbolic links and special files reject a backup rather than silently
omitting data or following paths outside its scope.

## Create a backup

1. Finish any pending imports or edits. If Settings shows a pending restart,
   restart first so saved settings and active data refer to the same instance.
2. Open **Settings → Backups and restore** and choose **Create full backup**.
3. Keep the page open. The app temporarily blocks other data operations, waits for
   earlier edits/rebuilds, and writes the archive without changing financial files.
4. Inspect **Backup saved**, including the file count and exact server path.
   **Download ZIP copy** saves another copy through your browser.

The default server filename is:

```text
~/<user_alias>_mim_backup_<UTC-datetime>_<unique-suffix>.zip
```

The alias is the configured `username`, not necessarily the operating-system
account. `~` is the home of the OS account running the server, not the browser
user's home. For example, username `alex` produces
`/home/service/alex_mim_backup_2026-09-30T14-30-00-000Z_1234abcd.zip` when the
service runs as `service`. The suffix prevents collisions. Existing archives
are never overwritten. A failed creation removes its `.partial` file and does
not appear as a completed backup.

Backups are **not encrypted**. Protect the directory and keep an encrypted copy
on another device or storage system. A same-disk ZIP does not protect against
disk failure. No automatic schedule, expiry, deletion, or off-machine replication
is included; plan retention and free space yourself.

## Review and restore

1. Close other MiM tabs and finish unsaved work. Open Settings.
2. The newest matching ZIP filename in the server home folder is selected by
   default. Choose another saved backup or use **browse for a backup ZIP on this
   device**. Browser security controls where its picker opens; the app cannot
   force the browser picker to start in the server's home directory.
3. Choose **Review restore**. The server extracts to a private sibling workspace,
   checks the manifest, every path/size/checksum, and reads the stored account
   configurations, snapshot, and rules. No active data is replaced yet.
4. Check the archive date, username, file count, destination, and saved port.
   Type the username exactly, then choose **Restore and replace data**.
   **Cancel** leaves active data unchanged and removes the private preview.
5. The website reloads to clear stale browser state and shows the restore result,
   including where the previous data was retained. Restart if the restored port
   differs from the currently listening port. Reload any other open tabs.

Restores must target the archive's **original data root and username**. A ZIP
cannot nominate an arbitrary write destination. If those differ from the running
instance, first select the original location in Settings and restart. Relocating
a backup to a different root is an administrator migration, not this restore
workflow. This restriction also preserves existing absolute paths in receipts.

A preview expires after 15 minutes, or when replaced by another preview. If data
or saved settings change between preview and confirmation, confirmation is
rejected: review again. File browsing/upload and validation alone never authorize
replacement. An expired preview must not be treated as a reusable restore token.

## Replacement and recovery behavior

The extracted directory is prepared on the same filesystem as the active data.
On confirmation, the app retains the current directory, renames the candidate
into its place, restores the config file, and invalidates the transaction cache.
Files created after the backup disappear from active data; they remain in the
retained previous directory. The restored snapshot is loaded as saved, without
replaying an import/rebuild that could change financial results.

Recovery material is retained at:

```text
<dataRoot>/.mim-restore-<username>-<unique>/
    previous/              Full data directory from before the restore
    config-before.json     Application configuration from before the restore
    incoming/config.json   Restored configuration
```

The result displays the actual path. These folders contain
private financial data and are outside subsequent full-user backups. Keep them
until the restored Accounts, Overview, and Rules have been checked; remove them
manually only after confirming which copy is no longer needed.

A caught replacement error attempts rollback. An on-disk
`~/.moneyinmotion/restore-pending.json` marker allows startup to roll back a
process interruption **before** normal startup creates directories or loads data.
If rollback fails, data endpoints remain blocked; preserve all recovery files,
stop the app, correct the underlying filesystem issue, and restart. Do not delete
the marker to force startup. This is process-interruption recovery, not a
filesystem snapshot or a guarantee against power loss, disk failure, or malicious
external writers. Only one MiM process may own the directory. Stop scripts,
sync tools, and other programs that write into it during backup/restore.

If the server cannot start because the configuration file is corrupt, the web
restore controls are unavailable. Stop the server, preserve the broken config,
and repair the root/username/port to the known original values before starting
the UI and selecting a known-good archive. An administrator can also inspect a
ZIP with standard archive tools and recover `data/` and `config.json` while MiM
is stopped. Never merge that extraction into a partially populated active tree.
Keep the old tree aside, verify ownership, and start without rebuilding to inspect
the saved state. Rebuild is a separate, intentional operation afterward.

## Limits and troubleshooting

- Maximum ZIP: 2 GiB; total expanded content including the manifest: 2 GiB;
  individual file: 512 MiB; 20,000 data files/directories; 40 folder levels;
  manifest: 8 MiB. Archive processing times out after 10 minutes.
- ZIP members must use stored or deflate compression. Encrypted ZIPs, missing or
  extra members, unsafe paths, links, duplicate/case-colliding paths, malformed
  metadata, damaged CRCs/checksums, and unreadable saved financial snapshots are
  rejected before replacement. This is not a general-purpose ZIP importer.
- Allow space for the archive, the uploaded ZIP if browsing, an expanded staged
  copy, and the retained original data. There is no free-space reservation.
  Uploaded ZIPs use a private OS temporary directory and are removed after
  validation; previews expire. A forcibly killed process may leave private
  temporary files/workspaces for administrator cleanup.
- A permission error or missing Python must be fixed on the server, under the
  same OS account that runs MiM. The app never installs tools or changes ownership.
- If a response is lost, inspect the backup list or reload before retrying.
  A restore may have completed even when the browser did not receive its result.
- Current-version readability is checked, but the ZIP does not pin the application
  version. Different future application code can interpret the same saved bytes
  differently. Use a compatible code revision when exact historical behavior matters.

See the [API contract](api.md#backups-and-restore),
[security guidance](../SECURITY.md), and
[verification record](BACKUP_RESTORE_REVIEW.md) for implementation boundaries and
the tests actually performed.
