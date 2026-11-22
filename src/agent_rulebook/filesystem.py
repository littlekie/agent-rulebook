"""Preview and create files without replacing existing project content."""

import os
from pathlib import Path
import stat

PROPOSALS = {
    "AGENTS.md": "docs/ai-governance/AGENTS.proposed.md",
    "REVIEW.md": "docs/ai-governance/REVIEW.proposed.md",
}


def root_path(value):
    # macOS /tmp and home paths may have symlink ancestors. Resolve the user's
    # selected root once; symlinks *inside* that root remain forbidden.
    root = Path(value).expanduser().resolve()
    if root.exists() and not root.is_dir():
        raise ValueError("Target is not a directory: " + str(root))
    return root


def checked_path(root, relative):
    parts = relative.split("/")
    if any(part in ("", ".", "..") for part in parts) or "\\" in relative:
        raise ValueError("Invalid relative path: " + relative)
    current = root
    for index, part in enumerate(parts):
        current = current / part
        if current.is_symlink():
            raise ValueError("Target path contains a symlink: " + relative)
        if current.exists():
            mode = current.stat().st_mode
            expected = stat.S_ISREG if index == len(parts) - 1 else stat.S_ISDIR
            if not expected(mode):
                raise ValueError("Target path type conflict: " + relative)
    return current


def plan(root, files):
    entries = []
    for name, content in sorted(files.items()):
        target = checked_path(root, name)
        if name in PROPOSALS and target.exists() and target.read_bytes() != content:
            name = PROPOSALS[name]
            # These are explicitly human integration drafts, not new active rules.
            content = ("<!-- Integration proposal: preserve existing project rules; paths are relative to the project root. -->\n".encode("utf-8")
                       + content)
            target = checked_path(root, name)
        action = "create"
        if target.exists():
            action = "unchanged" if target.read_bytes() == content else "conflict"
        entries.append({"path": name, "action": action, "content": content})
    return entries


def apply_plan(root, entries):
    # Recheck the entire plan before writing. Exclusive creation also protects
    # existing files if another invocation creates one after the preflight.
    pending = []
    for entry in entries:
        path = checked_path(root, entry["path"])
        if path.exists():
            if path.read_bytes() != entry["content"]:
                raise ValueError("File changed before writing: " + entry["path"])
        else:
            pending.append((path, entry["content"]))
    created = []
    try:
        for path, content in pending:
            checked_path(root, path.relative_to(root).as_posix())
            path.parent.mkdir(parents=True, exist_ok=True)
            # Unbuffered writes let rollback track each successfully written
            # prefix, including a short write before a later disk error.
            with path.open("xb", buffering=0) as stream:
                identity = os.fstat(stream.fileno())
                record = {"path": path, "device": identity.st_dev,
                          "inode": identity.st_ino, "written": b""}
                created.append(record)
                offset = 0
                while offset < len(content):
                    count = stream.write(content[offset:])
                    if not count:
                        raise OSError("Write made no progress: " + str(path))
                    offset += count
                    record["written"] = content[:offset]
    except (OSError, ValueError) as error:
        # Remove only files created by this invocation, not somebody else's work.
        retained = []
        for record in reversed(created):
            path = record["path"]
            try:
                checked_path(root, path.relative_to(root).as_posix())
                current = path.lstat()
                if ((current.st_dev, current.st_ino) == (record["device"], record["inode"])
                        and path.read_bytes() == record["written"]):
                    path.unlink()
                else:
                    retained.append(str(path))
            except FileNotFoundError:
                pass
            except (OSError, ValueError):
                retained.append(str(path))
        if retained:
            raise OSError(str(error) + "; changed or unsafe-to-clean files were retained: "
                          + ", ".join(retained)) from error
        raise
