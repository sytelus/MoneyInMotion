#!/usr/bin/env python3
"""Bounded ZIP codec for MiM backups. Policy and restore commits live in Node.

Uses only Python's standard library, avoiding a home-grown ZIP parser. Never use
extractall: each member must match the checksum-verified manifest inventory and
is streamed into a fresh, private directory. Hashes detect damage, not authorship.
"""

import datetime
import hashlib
import json
import os
import stat
import sys
import zipfile

MAX_ENTRIES = 20000
MAX_BYTES = 2 * 1024**3
MAX_FILE_BYTES = 512 * 1024**2
MAX_MANIFEST_BYTES = 8 * 1024**2
CHUNK = 1024 * 1024


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def safe_name(name: str) -> str:
    require(isinstance(name, str) and 0 < len(name) <= 1024, "Invalid archive path.")
    require(not any(c in name for c in ("\\", ":", "\x00")), "Unsafe archive path.")
    require(all(p not in ("", ".", "..") for p in name.split("/")), "Unsafe archive path.")
    require(name.count("/") <= 40, "Archive path exceeds the 40-level limit.")
    require(
        name in ("config.json", "data") or name.startswith("data/"),
        "Unexpected archive member.",
    )
    return name


def inventory(root: str):
    files, directories = [], []

    def visit(absolute, relative, depth):
        require(depth <= 40, "Data folders exceed the 40-level backup limit.")
        info = os.lstat(absolute)
        require(not stat.S_ISLNK(info.st_mode), "Symbolic links cannot be backed up: " + relative)
        safe_name(relative)
        if stat.S_ISDIR(info.st_mode):
            directories.append((relative, absolute, info))
            for name in sorted(os.listdir(absolute)):
                visit(os.path.join(absolute, name), relative + "/" + name, depth + 1)
        else:
            require(stat.S_ISREG(info.st_mode), "Only regular files can be backed up: " + relative)
            require(info.st_size <= MAX_FILE_BYTES, "A data file exceeds the 512 MiB backup limit.")
            files.append((relative, absolute, info))
        require(len(files) + len(directories) <= MAX_ENTRIES, "Backup exceeds 20,000 entries.")

    visit(root, "data", 0)
    require(sum(item[2].st_size for item in files) <= MAX_BYTES, "Data exceeds the 2 GiB backup limit.")
    require(
        len({name.casefold() for name, _, _ in files + directories})
        == len(files) + len(directories),
        "Data paths differ only by letter case; rename them before backup.",
    )
    return files, directories


def fingerprint(items):
    return [(name, s.st_size, s.st_mtime_ns, s.st_ino, s.st_dev) for name, _, s in items]


def create(root: str, config_file: str, destination: str) -> dict:
    files, directories = inventory(root)
    config_stat = os.lstat(config_file)
    require(stat.S_ISREG(config_stat.st_mode), "Configuration must be a regular file, not a link.")
    require(config_stat.st_size <= MAX_MANIFEST_BYTES, "Configuration is too large.")
    with open(config_file, "rb") as stream:
        config = json.load(stream)
    manifest = {
        "format": "moneyinmotion-backup",
        "version": 1,
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "username": config["username"],
        "dataRoot": config["dataRoot"],
        "port": config["port"],
        "files": [],
        "directories": [],
    }
    # Exclusive creation and private permissions: a collision never overwrites a backup.
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as output, zipfile.ZipFile(
        output, "w", zipfile.ZIP_DEFLATED, compresslevel=6
    ) as archive:
        for name, _, info in directories:
            archive.writestr(name + "/", b"")
            manifest["directories"].append({"path": name, "mtimeNs": str(info.st_mtime_ns)})
        for name, absolute, before in files + [("config.json", config_file, config_stat)]:
            digest = hashlib.sha256()
            size = 0
            fd = os.open(absolute, os.O_RDONLY | os.O_NOFOLLOW)
            with os.fdopen(fd, "rb") as source, archive.open(name, "w", force_zip64=True) as target:
                require(os.fstat(source.fileno()).st_ino == before.st_ino, "Data changed during backup; try again.")
                while True:
                    chunk = source.read(CHUNK)
                    if not chunk:
                        break
                    size += len(chunk)
                    require(size <= MAX_FILE_BYTES, "File grew beyond the backup limit.")
                    digest.update(chunk)
                    target.write(chunk)
            after = os.lstat(absolute)
            require(
                size == before.st_size and after.st_mtime_ns == before.st_mtime_ns,
                "Data changed during backup; try again.",
            )
            manifest["files"].append({
                "path": name, "size": size, "sha256": digest.hexdigest(),
                "mtimeNs": str(before.st_mtime_ns),
            })
        current_files, current_dirs = inventory(root)
        require(
            fingerprint(files) == fingerprint(current_files)
            and fingerprint(directories) == fingerprint(current_dirs),
            "Data changed during backup; try again.",
        )
        encoded_manifest = json.dumps(manifest, separators=(",", ":")).encode("utf-8")
        require(len(encoded_manifest) <= MAX_MANIFEST_BYTES, "Backup inventory exceeds 8 MiB.")
        require(sum(f["size"] for f in manifest["files"]) + len(encoded_manifest) <= MAX_BYTES, "Backup content exceeds 2 GiB.")
        archive.writestr("manifest.json", encoded_manifest)
    require(os.path.getsize(destination) <= MAX_BYTES, "Archive exceeds the 2 GiB backup limit.")
    return summary(manifest)


def summary(manifest: dict) -> dict:
    return {
        **{key: manifest[key] for key in ("createdAt", "username", "dataRoot", "port")},
        "fileCount": len(manifest["files"]),
        "totalBytes": sum(item["size"] for item in manifest["files"]),
    }


def extract(source: str, destination: str) -> dict:
    require(os.path.getsize(source) <= MAX_BYTES, "Archive exceeds the 2 GiB restore limit.")
    require(os.path.isdir(destination) and not os.listdir(destination), "Restore staging directory must be empty.")
    with zipfile.ZipFile(source) as archive:
        members = archive.infolist()
        require(len(members) <= MAX_ENTRIES + 2, "Archive exceeds 20,000 entries.")
        require(len({m.filename.casefold() for m in members}) == len(members), "Archive has duplicate paths.")
        # Inspect codec/type/size metadata before opening ANY member, including
        # the manifest. Unsupported codecs can allocate memory before yielding.
        require(sum(m.file_size for m in members) <= MAX_BYTES, "Expanded archive exceeds 2 GiB.")
        for member in members:
            require(member.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), "Unsupported ZIP compression.")
            require(not member.flag_bits & 1, "Encrypted ZIP files are not supported.")
            mode = member.external_attr >> 16
            require(stat.S_IFMT(mode) in (0, stat.S_IFREG, stat.S_IFDIR), "Links and special files are not allowed.")
            require(member.file_size <= MAX_FILE_BYTES, "A backup member exceeds 512 MiB.")
            require(not member.is_dir() or member.file_size == 0, "Directory members must be empty.")
        manifest_info = archive.getinfo("manifest.json")
        require(manifest_info.file_size <= MAX_MANIFEST_BYTES, "Backup manifest is too large.")
        manifest = json.loads(archive.read(manifest_info))
        require(
            manifest.get("format") == "moneyinmotion-backup" and manifest.get("version") == 1,
            "Not a supported MoneyInMotion backup.",
        )
        files, directories = manifest["files"], manifest["directories"]
        require(isinstance(files, list) and isinstance(directories, list), "Invalid backup inventory.")
        expected = {}
        for item in files + directories:
            name = safe_name(item["path"])
            require(name not in expected, "Duplicate manifest path.")
            ns = int(item["mtimeNs"])
            require(-9223372036854775808 <= ns <= 9223372036854775807, "Invalid file timestamp.")
            expected[name] = item
        require(
            "config.json" in [f["path"] for f in files]
            and "data" in [d["path"] for d in directories],
            "Backup is missing configuration or data.",
        )
        require(
            {m.filename for m in members}
            == {"manifest.json"} | {f["path"] for f in files}
            | {d["path"] + "/" for d in directories},
            "Archive and manifest inventory differ.",
        )
        for item in sorted(directories, key=lambda d: d["path"].count("/")):
            require(item["path"] != "config.json", "Invalid directory in backup.")
            os.mkdir(os.path.join(destination, item["path"]), 0o700)
        total = 0
        for item in files:
            name = item["path"]
            member = archive.getinfo(name)
            require(
                type(item["size"]) is int and item["size"] == member.file_size,
                "File size does not match manifest.",
            )
            require(name != "data", "Invalid file in backup.")
            digest, size = hashlib.sha256(), 0
            target = os.path.join(destination, name)
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as output, archive.open(member) as content:
                while True:
                    chunk = content.read(CHUNK)
                    if not chunk:
                        break
                    size += len(chunk)
                    total += len(chunk)
                    require(size <= item["size"] and total <= MAX_BYTES, "Expanded content exceeds declared size.")
                    digest.update(chunk)
                    output.write(chunk)
            require(
                size == item["size"] and digest.hexdigest() == item["sha256"],
                "Backup integrity check failed: " + name,
            )
            ns = int(item["mtimeNs"])
            os.utime(target, ns=(ns, ns))
        for item in sorted(directories, key=lambda d: -d["path"].count("/")):
            ns = int(item["mtimeNs"])
            os.utime(os.path.join(destination, item["path"]), ns=(ns, ns))
    return summary(manifest)


if __name__ == "__main__":
    try:
        require(sys.version_info >= (3, 9), "Backup and restore require Python 3.9 or newer.")
        if sys.argv[1] == "create":
            result = create(*sys.argv[2:])
        elif sys.argv[1] == "extract":
            result = extract(*sys.argv[2:])
        else:
            raise ValueError("Unknown archive operation.")
        print(json.dumps(result))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
