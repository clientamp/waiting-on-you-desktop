#!/usr/bin/env python3
"""Disposable-fixture benchmark: background scan over unchanged chats (no classifier calls).

Measures wall time, process CPU time (user+sys), scanner summary counts, and explicit
model-invocation count. Uses a mocked collect_fn — zero paid or local model requests.

Fixture size (--chats) and per-scan chat budget (--scan-budget) are independent.
``max_chats_per_scan`` is clamped to the product range 5–100 (see ``wou.settings``).

Compare baseline vs branch without mutating the working tree:

  python scripts/benchmark_scanner_unchanged.py --chats 200 --scan-budget 100 --json \\
    > /tmp/wou-scan-current.json

  python scripts/benchmark_scanner_unchanged.py --chats 200 --baseline-ref HEAD \\
    --trials 3 --json > /tmp/wou-scan-compare.json

Baseline code is extracted with ``git archive`` into a fresh
``scratch/bench-baseline/<ref>/<timestamp>-<id>/`` directory (never overwrites prior
runs). The same benchmark script is copied there and run via subprocess. No
``stash``, ``checkout``, or ``clone`` on the source tree.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import secrets
import shutil
import statistics
import subprocess
import sys
import tarfile
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import resource
except ImportError:  # Windows
    resource = None  # type: ignore[assignment]

ROOT = Path(__file__).resolve().parents[1]
SCAN_BUDGET_LO, SCAN_BUDGET_HI = 5, 100
DEFAULT_SCAN_BUDGET = 100

sys.path.insert(0, str(ROOT))

from wou.scanner import Scanner  # noqa: E402
from wou.settings import save_settings  # noqa: E402
from wou.store import Store  # noqa: E402


def _clamp_scan_budget(value: int) -> int:
    return max(SCAN_BUDGET_LO, min(SCAN_BUDGET_HI, value))


def _chat(key: str, msg_id: str, last_active: float) -> dict:
    return {
        "key": key,
        "agent": "Desktop",
        "title": "Bench chat",
        "last_msg_id": msg_id,
        "last_role": "assistant",
        "last_active": last_active,
        "user_last": "hi",
        "agent_last": "waiting?",
    }


def _seed(data_dir: Path, chat_count: int, t0: float) -> None:
    db = data_dir / "wou.db"
    store = Store(str(db))
    try:
        for i in range(chat_count):
            key = f"s{i}"
            store.upsert_task(
                key,
                "Desktop",
                f"Chat {i}",
                f"Open ask {key}",
                "Topic",
                1,
                "m1",
                now=t0 - 3600,
            )
            store.set_scan_state(key, "m1", t0 - 3600)
    finally:
        store.close()


def _run_once(chat_count: int, scan_budget: int, t0: float, root: Path) -> dict:
    invocations = 0

    def llm_tracked(_messages):
        nonlocal invocations
        invocations += 1
        raise RuntimeError("classifier must not run for unchanged-chat benchmark")

    with tempfile.TemporaryDirectory(prefix="wou-scan-bench-") as tmp:
        data_dir = Path(tmp)
        save_settings(data_dir, {"consented": True, "max_chats_per_scan": scan_budget})
        _seed(data_dir, chat_count, t0)
        chats = [_chat(f"s{i}", "m1", t0) for i in range(chat_count)]

        def collect_fn(_cfg, _cache_dir, now=None):
            return chats, []

        scanner = Scanner(
            data_dir,
            llm=llm_tracked,
            collect_fn=collect_fn,
            now_fn=lambda: t0,
        )

        cpu_before = None
        if resource is not None:
            usage = resource.getrusage(resource.RUSAGE_SELF)
            cpu_before = usage.ru_utime + usage.ru_stime

        wall_start = time.perf_counter()
        summary = scanner.run_once(manual=False, force_full=False)
        wall_seconds = time.perf_counter() - wall_start

        cpu_seconds = None
        if resource is not None and cpu_before is not None:
            usage = resource.getrusage(resource.RUSAGE_SELF)
            cpu_seconds = (usage.ru_utime + usage.ru_stime) - cpu_before

        if invocations != 0:
            raise RuntimeError(f"expected zero model invocations, got {invocations}")

        return {
            "root": str(root),
            "fixture": {
                "chats": chat_count,
                "scan_budget": scan_budget,
                "data_dir": "disposable_tmp",
            },
            "timing": {
                "wall_seconds": round(wall_seconds, 6),
                "cpu_seconds": round(cpu_seconds, 6) if cpu_seconds is not None else None,
            },
            "model": {"invocations": invocations},
            "summary": {
                k: summary.get(k)
                for k in (
                    "chats_seen",
                    "attempted",
                    "succeeded",
                    "failed",
                    "skipped_chats",
                    "classified",
                    "gated",
                )
            },
        }


def _git_head(root: Path = ROOT) -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
        if out.returncode == 0:
            return out.stdout.strip()
    except OSError:
        pass
    return None


def _git_ref_sha(ref: str, root: Path = ROOT) -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", ref],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
        if out.returncode == 0:
            return out.stdout.strip()
    except OSError:
        pass
    return None


_SOURCE_PREFIX = "wou/"


def _git_ls_paths(root: Path, *extra_args: str) -> list[str]:
    proc = subprocess.run(
        ["git", "ls-files", "-z", *extra_args],
        cwd=root,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0 or not proc.stdout:
        return []
    return [p.decode() for p in proc.stdout.split(b"\0") if p]


def _in_git_work_tree(root: Path) -> bool:
    proc = subprocess.run(
        ["git", "rev-parse", "--is-inside-work-tree"],
        cwd=root,
        capture_output=True,
        check=False,
    )
    return proc.returncode == 0 and proc.stdout.strip() == b"true"


def _wou_paths_from_disk(root: Path) -> list[str]:
    wou = root / "wou"
    if not wou.is_dir():
        return []
    return sorted(
        p.relative_to(root).as_posix()
        for p in wou.rglob("*")
        if p.is_file()
    )


def _scanner_source_paths(root: Path) -> list[str]:
    if _in_git_work_tree(root):
        tracked = _git_ls_paths(root)
        untracked = _git_ls_paths(root, "--others", "--exclude-standard")
        paths = {p for p in tracked + untracked if p.startswith(_SOURCE_PREFIX)}
        return sorted(paths)
    return _wou_paths_from_disk(root)


def _worktree_source_hash(root: Path) -> str | None:
    paths = _scanner_source_paths(root)
    if not paths:
        return None
    digest = hashlib.sha256()
    for rel in paths:
        digest.update(rel.encode())
        digest.update(b"\0")
        try:
            digest.update((root / rel).read_bytes())
        except OSError:
            digest.update(b"<unreadable>")
        digest.update(b"\0")
    return digest.hexdigest()[:32]


def _git_source_metadata(root: Path = ROOT) -> dict[str, Any]:
    in_git = _in_git_work_tree(root)
    head = _git_head(root) if in_git else None
    dirty = False
    diff_sha: str | None = None
    if in_git:
        try:
            status = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
            )
            dirty = bool(status.stdout.strip())
            if dirty:
                diff = subprocess.run(
                    ["git", "diff", "HEAD"],
                    cwd=root,
                    capture_output=True,
                    check=False,
                )
                diff_sha = hashlib.sha256(diff.stdout).hexdigest()[:16]
        except OSError:
            pass
    source_hash = _worktree_source_hash(root)
    return {
        "head": head,
        "dirty": dirty,
        "worktree_diff_sha": diff_sha,
        "source_hash": source_hash,
        "source_scope": _SOURCE_PREFIX,
    }


def _median_trial_metrics(trials: list[dict]) -> dict[str, float | None]:
    walls = [t["timing"]["wall_seconds"] for t in trials]
    cpus = [t["timing"]["cpu_seconds"] for t in trials if t["timing"]["cpu_seconds"] is not None]
    out: dict[str, float | None] = {"wall_seconds_median": statistics.median(walls)}
    out["cpu_seconds_median"] = statistics.median(cpus) if cpus else None
    return out


def _run_trials(
    chat_count: int, scan_budget: int, trials: int, t0: float, root: Path
) -> dict:
    runs = [
        _run_once(chat_count, scan_budget, t0, root) for _ in range(max(1, trials))
    ]
    meta = _git_source_metadata(root)
    base = runs[-1]
    base["git"] = meta
    base["trials"] = {
        "count": len(runs),
        **_median_trial_metrics(runs),
        "wall_seconds_all": [r["timing"]["wall_seconds"] for r in runs],
    }
    return base


def _baseline_scratch_parent(ref: str) -> Path:
    safe = ref.replace("/", "_")[:80]
    return ROOT / "scratch" / "bench-baseline" / safe


def _unique_baseline_dest(ref: str) -> Path:
    parent = _baseline_scratch_parent(ref)
    parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest = parent / f"{stamp}-{secrets.token_hex(4)}"
    dest.mkdir(parents=False, exist_ok=False)
    return dest


def _prepare_baseline_tree(ref: str) -> Path:
    dest = _unique_baseline_dest(ref)
    proc = subprocess.run(
        ["git", "archive", ref],
        cwd=ROOT,
        capture_output=True,
        check=True,
    )
    with tarfile.open(fileobj=io.BytesIO(proc.stdout), mode="r:*") as tar:
        if hasattr(tarfile, "data_filter"):
            tar.extractall(dest, filter="data")
        else:
            tar.extractall(dest)
    script_src = ROOT / "scripts" / "benchmark_scanner_unchanged.py"
    script_dest = dest / "scripts" / "benchmark_scanner_unchanged.py"
    script_dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(script_src, script_dest)
    return dest


def _run_in_tree(
    tree: Path, chat_count: int, scan_budget: int, trials: int, t0: float
) -> dict:
    cmd = [
        sys.executable,
        str(tree / "scripts" / "benchmark_scanner_unchanged.py"),
        "--chats",
        str(chat_count),
        "--scan-budget",
        str(scan_budget),
        "--trials",
        str(trials),
        "--json",
        "--internal-root",
        str(tree),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def _compare_report(current: dict, baseline: dict, baseline_ref: str) -> dict:
    cur_med = current["trials"]["wall_seconds_median"]
    base_med = baseline["trials"]["wall_seconds_median"]
    cur_git = current.get("git") or {}
    base_git = baseline.get("git") or {}
    same_head = bool(cur_git.get("head")) and cur_git.get("head") == base_git.get("head")
    same_source = bool(cur_git.get("source_hash")) and cur_git.get("source_hash") == base_git.get(
        "source_hash"
    )
    notes = [
        "Measured medians from repeated trials; not a claimed speedup ratio.",
    ]
    if same_head and not same_source:
        notes.append(
            "HEAD matches but worktree source_hash differs from archived baseline; "
            "timings compare committed ref vs dirty/untracked wou/ tree, not identical code."
        )
    elif cur_git.get("dirty") and same_head:
        notes.append(
            "Current run is from a dirty worktree at the same HEAD as baseline_ref; "
            "baseline is the clean archive only."
        )
    return {
        "baseline_ref": baseline_ref,
        "baseline_archive_path": baseline.get("root"),
        "baseline_git": base_git,
        "current_git": cur_git,
        "same_head": same_head,
        "same_source_hash": same_source,
        "baseline_median_wall_seconds": base_med,
        "current_median_wall_seconds": cur_med,
        "delta_wall_seconds": round(cur_med - base_med, 6),
        "note": " ".join(notes),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chats", type=int, default=100, help="unchanged chats in fixture")
    parser.add_argument(
        "--scan-budget",
        type=int,
        default=DEFAULT_SCAN_BUDGET,
        help=f"max_chats_per_scan for this run (clamped {SCAN_BUDGET_LO}-{SCAN_BUDGET_HI})",
    )
    parser.add_argument("--trials", type=int, default=1, help="repeat runs; report median wall time")
    parser.add_argument(
        "--baseline-ref",
        type=str,
        default=None,
        help="git ref to extract via git archive and run the same benchmark (optional)",
    )
    parser.add_argument("--json", action="store_true", help="print JSON only")
    parser.add_argument(
        "--internal-root",
        type=str,
        default=None,
        help=argparse.SUPPRESS,
    )
    args = parser.parse_args()
    if args.chats < 1:
        print("chats must be >= 1", file=sys.stderr)
        return 2
    if args.trials < 1:
        print("trials must be >= 1", file=sys.stderr)
        return 2

    root = Path(args.internal_root).resolve() if args.internal_root else ROOT
    if root != ROOT:
        sys.path.insert(0, str(root))

    requested_budget = args.scan_budget
    scan_budget = _clamp_scan_budget(requested_budget)
    t0 = 1_700_000_000.0

    report = _run_trials(args.chats, scan_budget, args.trials, t0, root)
    if requested_budget != scan_budget:
        report["fixture"]["scan_budget_requested"] = requested_budget

    if args.baseline_ref and args.internal_root is None:
        tree = _prepare_baseline_tree(args.baseline_ref)
        baseline = _run_in_tree(tree, args.chats, scan_budget, args.trials, t0)
        ref_sha = _git_ref_sha(args.baseline_ref)
        if ref_sha:
            baseline.setdefault("git", {})["head"] = ref_sha
            baseline["git"]["dirty"] = False
            baseline["git"]["from_archive"] = True
        report["baseline_compare"] = _compare_report(report, baseline, args.baseline_ref)

    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
