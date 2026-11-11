"""Smoke for scripts/benchmark_scanner_unchanged.py (measurements, not performance gates)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "benchmark_scanner_unchanged.py"
BASELINE_PARENT = ROOT / "scratch" / "bench-baseline" / "HEAD"


def _run_json(*args: str) -> dict:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), *args, "--json"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(proc.stdout)


def test_scanner_unchanged_benchmark_emits_counts_and_zero_classified():
    report = _run_json("--chats", "12")
    assert report["fixture"]["chats"] == 12
    assert report["fixture"]["scan_budget"] == 100
    assert report["timing"]["wall_seconds"] >= 0
    assert report["summary"]["chats_seen"] == 12
    assert report["summary"]["classified"] == 0
    assert report["summary"]["attempted"] == 0
    assert report["model"]["invocations"] == 0
    assert "git" in report
    assert "head" in report["git"]
    assert report["git"].get("source_hash")
    assert report["git"].get("source_scope") == "wou/"


def test_large_fixture_respects_scan_budget_cap_not_fixture_size():
    report = _run_json("--chats", "200", "--scan-budget", "100")
    assert report["fixture"]["chats"] == 200
    assert report["fixture"]["scan_budget"] == 100
    assert report["summary"]["chats_seen"] == 200
    assert report["model"]["invocations"] == 0


def test_scan_budget_clamps_to_minimum_five():
    report = _run_json("--chats", "3", "--scan-budget", "2")
    assert report["fixture"]["chats"] == 3
    assert report["fixture"]["scan_budget"] == 5
    assert report["fixture"]["scan_budget_requested"] == 2
    assert report["summary"]["chats_seen"] == 3


def test_trials_report_median():
    report = _run_json("--chats", "8", "--trials", "3")
    assert report["trials"]["count"] == 3
    assert len(report["trials"]["wall_seconds_all"]) == 3
    assert report["trials"]["wall_seconds_median"] >= 0


@pytest.mark.skipif(
    subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], cwd=ROOT, capture_output=True).returncode != 0,
    reason="git worktree required for archive baseline smoke",
)
def test_baseline_ref_runs_without_checkout():
    before = set(BASELINE_PARENT.iterdir()) if BASELINE_PARENT.is_dir() else set()
    report = _run_json("--chats", "10", "--baseline-ref", "HEAD", "--trials", "1")
    after = set(BASELINE_PARENT.iterdir()) if BASELINE_PARENT.is_dir() else set()
    assert "baseline_compare" in report
    compare = report["baseline_compare"]
    assert compare["baseline_ref"] == "HEAD"
    assert "delta_wall_seconds" in compare
    assert "Measured medians" in compare["note"]
    assert "same_source_hash" in compare
    assert "same_head" in compare
    assert compare.get("baseline_archive_path")
    assert after - before, "baseline extract should create a new directory, not overwrite prior evidence"
    if compare["same_head"] and report["git"].get("dirty"):
        assert compare["same_source_hash"] is False or "dirty worktree" in compare["note"]


def test_worktree_source_hash_includes_untracked_wou(tmp_path):
    """Fingerprint changes when an untracked wou/ file appears (git ls-files scope)."""
    import importlib.util

    subprocess.run(["git", "init"], cwd=tmp_path, check=True, capture_output=True)
    (tmp_path / "wou").mkdir()
    (tmp_path / "wou" / "probe.py").write_text("x = 1\n")
    subprocess.run(["git", "add", "wou/probe.py"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "init"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )

    spec = importlib.util.spec_from_file_location("bench", SCRIPT)
    assert spec and spec.loader
    bench = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bench)

    h1 = bench._worktree_source_hash(tmp_path)
    (tmp_path / "wou" / "extra.py").write_text("y = 2\n")
    h2 = bench._worktree_source_hash(tmp_path)
    assert h1 and h2 and h1 != h2
