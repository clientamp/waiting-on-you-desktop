"""Caller-owned collect read cache: contract tests (implement in wou.collect)."""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests_py.test_collect import add_message, add_session, make_state_db


def _collect():
    import wou.collect as collect

    return collect


def _require_read_cache():
    collect = _collect()
    cache_cls = getattr(collect, "CollectionReadCache", None)
    assert cache_cls is not None, "wou.collect must export CollectionReadCache"
    assert callable(getattr(cache_cls, "clear", None)), "CollectionReadCache.clear"
    assert callable(getattr(cache_cls, "close", None)), "CollectionReadCache.close"
    return collect, cache_cls


def _is_message_content_select(sql: str) -> bool:
    s = sql.lower()
    return "from messages where" in s and "substr(rtrim(content" in s


def _content_selects(queries: list[str]) -> int:
    return sum(1 for q in queries if _is_message_content_select(q))


def _seed_chat(db: Path, *, now: float, sid: str = "s1") -> None:
    make_state_db(db)
    add_session(db, sid, title="Chat", started_at=now - 100, last_activity_at=now - 10)
    add_message(db, "m1", sid, "user", "user says hi", timestamp=now - 20)
    add_message(db, "m2", sid, "assistant", "agent says hello", timestamp=now - 5)


def _cfg(db: Path, collect, cache, **overrides):
    now = overrides.pop("now", 1_700_100_000.0)
    data = {
        "days": 10,
        "local_profiles": [{"name": "default", "state_db": str(db)}],
    }
    cfg = collect.Config.from_dict(data, hermes_home=db.parent)
    for key, value in overrides.items():
        setattr(cfg, key, value)
    cfg.read_cache = cache
    return cfg, now


@pytest.fixture
def trace_connect(monkeypatch):
    collect = _collect()
    queries: list[str] = []
    real_connect = sqlite3.connect

    def connect(*args, **kwargs):
        conn = real_connect(*args, **kwargs)
        conn.set_trace_callback(queries.append)
        return conn

    monkeypatch.setattr(collect.sqlite3, "connect", connect)
    return collect, queries


def test_collection_read_cache_exported():
    _require_read_cache()


def test_second_collect_unchanged_hits_cache_no_content_selects(tmp_path, trace_connect):
    collect, queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)

    first = collect.collect_db(db, cfg, now=now)
    first_content = _content_selects(queries)
    assert first, "seeded chat should be collected"
    assert first_content >= 1, "first collect must read message content"

    queries.clear()
    second = collect.collect_db(db, cfg, now=now)
    assert second == first
    assert _content_selects(queries) == 0, "unchanged DB should not re-query message content"


def test_cached_rows_are_deep_copies_safe_from_caller_mutation(tmp_path, trace_connect):
    collect, _queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)

    rows = collect.collect_db(db, cfg, now=now)
    assert rows[0]["agent_last"] == "agent says hello"
    rows[0]["agent_last"] = "mutated by caller"
    rows[0]["user_last"] = "also mutated"

    again = collect.collect_db(db, cfg, now=now)
    assert again[0]["agent_last"] == "agent says hello"
    assert again[0]["user_last"] == "user says hi"
    assert again[0] is not rows[0]


def test_wal_message_edit_visible_without_session_timestamp_change(tmp_path, trace_connect):
    collect, queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    with sqlite3.connect(db) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.commit()

    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)
    before = collect.collect_db(db, cfg, now=now)
    assert before[0]["agent_last"] == "agent says hello"

    with sqlite3.connect(db) as conn:
        conn.execute(
            "UPDATE messages SET content=? WHERE id=?",
            ("agent revised in WAL", "m2"),
        )
        conn.commit()

    queries.clear()
    after = collect.collect_db(db, cfg, now=now)
    assert after[0]["agent_last"] == "agent revised in WAL"


def test_advancing_now_drops_sessions_outside_lookback(tmp_path, trace_connect):
    collect, _queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache, days=10)

    assert len(collect.collect_db(db, cfg, now=now)) == 1
    later = now + 11 * 86400
    assert collect.collect_db(db, cfg, now=later) == []


def test_advancing_now_twice_keeps_empty_after_lookback_filter(tmp_path, trace_connect):
    """cached_now advances on filtered hit but entry.rows must not resurrect stale sessions."""
    collect, _queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache, days=10)

    assert len(collect.collect_db(db, cfg, now=now)) == 1
    later = now + 11 * 86400
    assert collect.collect_db(db, cfg, now=later) == []
    assert collect.collect_db(db, cfg, now=later) == []


def test_db_replacement_during_loader_does_not_pin_old_rows(
    tmp_path, trace_connect, monkeypatch
):
    """os.replace mid-_collect_db_from_conn must not bind old rows to the new inode."""
    collect, _queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    replacement = tmp_path / "replacement.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now, sid="old")
    make_state_db(replacement)
    add_session(replacement, "new", title="Replacement", started_at=now - 50)
    add_message(replacement, "m-new", "new", "user", "from replacement file")

    real = collect._collect_db_from_conn
    replaced = False

    def collecting_with_replace(conn, cfg, now=None):
        nonlocal replaced
        rows = real(conn, cfg, now=now)
        if not replaced:
            os.replace(replacement, db)
            replaced = True
        return rows

    monkeypatch.setattr(collect, "_collect_db_from_conn", collecting_with_replace)

    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)
    first = collect.collect_db(db, cfg, now=now)
    assert [r["id"] for r in first] == ["old"]

    second = collect.collect_db(db, cfg, now=now)
    assert len(second) == 1
    assert second[0]["id"] == "new"
    assert second[0]["title"] == "Replacement"


def _bulk_seed_chats(db: Path, *, count: int, now: float) -> None:
    make_state_db(db)
    conn = sqlite3.connect(db)
    started = now - 100
    for i in range(count):
        sid = f"s{i}"
        conn.execute(
            "INSERT INTO sessions (id, source, title, started_at, last_activity_at, archived, hidden, created_source) "
            "VALUES (?, 'desktop', ?, ?, ?, 0, 0, 'desktop')",
            (sid, f"Chat {i}", started, started),
        )
        conn.execute(
            "INSERT INTO messages (id, session_id, role, content, active, timestamp) "
            "VALUES (?, ?, 'user', ?, 1, ?)",
            (f"m{i}", sid, f"msg-{i}", started),
        )
    conn.commit()
    conn.close()


def test_read_cache_bounds_fifth_db_evicts_oldest(tmp_path, trace_connect):
    collect, queries = trace_connect
    _, cache_cls = _require_read_cache()
    now = 1_700_100_000.0
    dbs = []
    for i in range(5):
        db = tmp_path / f"profile{i}" / "state.db"
        db.parent.mkdir()
        _seed_chat(db, now=now, sid=f"s{i}")
        dbs.append(db)

    cache = cache_cls()
    cfgs = []
    for db in dbs:
        cfg, _ = _cfg(db, collect, cache, now=now)
        cfgs.append(cfg)

    for db, cfg in zip(dbs, cfgs, strict=True):
        collect.collect_db(db, cfg, now=now)

    resolved = str(dbs[0].resolve())
    assert resolved not in cache._entries
    assert len(cache._entries) == collect.MAX_READ_CACHE_DBS

    queries.clear()
    collect.collect_db(dbs[0], cfgs[0], now=now)
    assert _content_selects(queries) >= 1


def test_oversize_collect_never_cached_and_rereads(tmp_path, trace_connect):
    collect, queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    over = collect.MAX_READ_CACHE_ROWS + 1
    _bulk_seed_chats(db, count=over, now=now)

    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)
    first = collect.collect_db(db, cfg, now=now)
    assert len(first) == over

    key = str(db.resolve())
    assert cache._entries[key].rows is None

    queries.clear()
    second = collect.collect_db(db, cfg, now=now)
    assert len(second) == over
    assert second == first
    assert _content_selects(queries) >= 1


def test_read_cache_connection_not_left_in_transaction(tmp_path):
    collect, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    over = collect.MAX_READ_CACHE_ROWS + 1
    _bulk_seed_chats(db, count=over, now=now)

    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)
    collect.collect_db(db, cfg, now=now)

    key = str(db.resolve())
    entry = cache._entries.get(key)
    assert entry is not None
    in_txn = getattr(entry.conn, "in_transaction", None)
    if in_txn is not None:
        assert not in_txn

    with sqlite3.connect(db) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.commit()
    writer = sqlite3.connect(db)
    rc = writer.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()[0]
    writer.close()
    assert rc == 0


def test_tail_chars_change_invalidates_message_cache(tmp_path, trace_connect):
    collect, queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    long_tail = "tail-" + ("x" * 400)
    make_state_db(db)
    add_session(db, "s1", started_at=now - 50)
    add_message(db, "m1", "s1", "user", "u")
    add_message(db, "m2", "s1", "assistant", long_tail)

    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache, tail_chars=900)
    short = collect.collect_db(db, cfg, now=now)
    assert len(short[0]["agent_last"]) <= 901

    cfg.tail_chars = 50
    queries.clear()
    narrower = collect.collect_db(db, cfg, now=now)
    assert len(narrower[0]["agent_last"]) < len(short[0]["agent_last"])
    assert _content_selects(queries) >= 1


def test_days_change_invalidates_session_cache(tmp_path, trace_connect):
    collect, queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache, days=1)
    assert len(collect.collect_db(db, cfg, now=now)) == 1

    cfg.days = 0
    queries.clear()
    assert collect.collect_db(db, cfg, now=now) == []
    assert any("from sessions" in q.lower() for q in queries)


def test_db_file_replacement_invalidates_cache(tmp_path, trace_connect):
    collect, _queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)

    first = collect.collect_db(db, cfg, now=now)
    assert first[0]["title"] == "Chat"

    db.unlink()
    make_state_db(db)
    add_session(db, "s2", title="Replacement", started_at=now - 50)
    add_message(db, "m3", "s2", "user", "new")

    second = collect.collect_db(db, cfg, now=now)
    assert len(second) == 1
    assert second[0]["id"] == "s2"
    assert second[0]["title"] == "Replacement"


def test_cache_clear_and_close_release_state(tmp_path, trace_connect):
    collect, _queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)

    collect.collect_db(db, cfg, now=now)
    cache.clear()
    collect.collect_db(db, cfg, now=now)
    cache.close()
    collect.collect_db(db, cfg, now=now)


def test_same_cache_instance_reused_across_collect_calls(tmp_path, trace_connect):
    """Scanner keeps one read_cache on Config across scans."""
    collect, queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)

    collect.collect_db(db, cfg, now=now)
    queries.clear()
    collect.collect_db(db, cfg, now=now)
    assert _content_selects(queries) == 0
    assert cfg.read_cache is cache


def test_lock_fails_closed_not_stale_cache(tmp_path, trace_connect):
    collect, _queries = trace_connect
    _, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    with sqlite3.connect(db) as conn:
        conn.execute("PRAGMA journal_mode=DELETE")
        conn.commit()

    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)

    warm = collect.collect_db(db, cfg, now=now)
    assert warm

    holder = sqlite3.connect(db, timeout=0.1)
    holder.execute("BEGIN EXCLUSIVE")
    locked = collect.collect_db(db, cfg, now=now)
    holder.close()
    assert locked == [], "locked read must fail closed, not return stale cache"


def test_collect_does_not_hold_read_transaction_blocking_wal_checkpoint(tmp_path):
    collect, cache_cls = _require_read_cache()
    db = tmp_path / "state.db"
    now = 1_700_100_000.0
    _seed_chat(db, now=now)
    with sqlite3.connect(db) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.commit()

    cache = cache_cls()
    cfg, now = _cfg(db, collect, cache)
    assert collect.collect_db(db, cfg, now=now)

    writer = sqlite3.connect(db)
    writer.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    writer.close()


def test_scanner_collect_cfg_reuses_scanner_read_cache(tmp_path):
    from wou.scanner import Scanner

    _, cache_cls = _require_read_cache()
    data_dir = tmp_path / "wou"
    data_dir.mkdir()
    (data_dir / "wou.db").touch()
    scanner = Scanner(data_dir)
    cfg_a = scanner._collect_cfg({})
    cfg_b = scanner._collect_cfg({})
    assert cfg_a.read_cache is scanner._read_cache
    assert cfg_b.read_cache is scanner._read_cache
    assert isinstance(cfg_a.read_cache, cache_cls)


def test_background_runner_loop_exits_closes_read_cache_once(tmp_path):
    """BackgroundRunner._loop must close the scanner read cache on thread exit."""
    from unittest.mock import Mock

    from wou.scanner import BackgroundRunner, Scanner

    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "wou.db").touch()
    scanner = Scanner(data_dir)
    runner = BackgroundRunner(scanner)

    class _FakeOwnerLock:
        def release(self) -> None:
            pass

    runner._owner_lock = _FakeOwnerLock()
    original_close = scanner.close_read_cache
    scanner.close_read_cache = Mock(wraps=original_close)  # type: ignore[method-assign]

    runner._stop.set()
    runner._loop()

    scanner.close_read_cache.assert_called_once()
