"""Read-only Hermes Projects catalog. No Hermes private Python imports."""

from __future__ import annotations

import copy
import os
import sqlite3
import threading
from pathlib import Path

_cache: dict[str, tuple[tuple, list[dict]]] = {}
_lock = threading.Lock()


def _catalog(db_path: str | Path) -> list[dict]:
    path = Path(db_path).expanduser().resolve()
    try:
        # WAL changes count too; keep a small bounded, per-file cache.
        st = path.stat()
        wal = Path(str(path) + "-wal")
        ws = wal.stat() if wal.exists() else None
        stamp = (
            st.st_mtime_ns,
            st.st_size,
            ws.st_mtime_ns if ws else None,
            ws.st_size if ws else None,
        )
        with _lock:
            cached = _cache.get(str(path))
        conn = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=0.1)
        try:
            # Probe even cached catalogs: an exclusive lock must degrade to an
            # empty catalog, not silently serve data we cannot currently read.
            conn.execute("PRAGMA schema_version").fetchone()
            if cached and cached[0] == stamp:
                return copy.deepcopy(cached[1])
            conn.row_factory = sqlite3.Row
            projects = [
                dict(r)
                for r in conn.execute(
                    "SELECT id, name, slug, color FROM projects WHERE archived = 0"
                )
            ]
            folders = list(conn.execute("SELECT project_id, path FROM project_folders"))
            for p in projects:
                p["folders"] = [
                    os.path.realpath(r["path"]).rstrip(os.sep) or os.sep
                    for r in folders
                    if r["project_id"] == p["id"] and r["path"]
                ]
        finally:
            conn.close()
    except (OSError, sqlite3.Error, ValueError):
        return []
    with _lock:
        if len(_cache) >= 64:
            _cache.clear()
        _cache[str(path)] = (stamp, projects)
    return copy.deepcopy(projects)


def list_projects(db_path: str | Path, profile: str = "default") -> list[dict]:
    return [
        dict(
            key=f"{profile}:{p['id']}",
            name=p["name"],
            slug=p["slug"],
            color=p["color"],
            profile=profile,
        )
        for p in _catalog(db_path)
    ]


def project_for_cwd(
    db_path: str | Path, cwd: str | None, profile: str = "default"
) -> dict | None:
    if not cwd:
        return None
    cwd = os.path.realpath(cwd).rstrip(os.sep) or os.sep
    matches = [
        (len(folder), p)
        for p in _catalog(db_path)
        for folder in p["folders"]
        if cwd == folder or cwd.startswith(folder.rstrip(os.sep) + os.sep)
    ]
    if not matches:
        return None
    p = max(matches, key=lambda item: item[0])[1]
    return dict(
        key=f"{profile}:{p['id']}", name=p["name"], slug=p["slug"], color=p["color"]
    )
