"""Cross-platform exclusive file locks (POSIX fcntl, Windows msvcrt)."""

from __future__ import annotations

from typing import Any


def _ensure_byte(handle: Any) -> None:
    handle.seek(0, 2)
    if handle.tell() == 0:
        handle.write("\0")
        handle.flush()


def exclusive_lock(handle: Any) -> None:
    """Acquire before read/merge/write; unsupported platforms and IO failures raise."""
    try:
        import fcntl

        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        return
    except ImportError:
        pass
    try:
        import msvcrt

        _ensure_byte(handle)
        handle.seek(0)
        while True:
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                return
            except OSError as exc:
                import errno
                import time

                if exc.errno not in (errno.EACCES, errno.EAGAIN, errno.EDEADLK):
                    raise
                time.sleep(0.05)
    except ImportError as exc:
        raise RuntimeError("No supported file-lock implementation") from exc


def try_exclusive_lock(handle: Any) -> bool:
    """Non-blocking exclusive lock on an open file handle. Never raises."""
    try:
        import fcntl

        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return True
    except ImportError:
        pass
    except (OSError, BlockingIOError):
        return False
    try:
        import msvcrt

        _ensure_byte(handle)
        handle.seek(0)
        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        return True
    except ImportError:
        return False
    except OSError:
        return False


def release_lock(handle: Any) -> None:
    try:
        import fcntl

        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        return
    except ImportError:
        pass
    except OSError:
        return
    try:
        import msvcrt

        handle.seek(0)
        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
    except (ImportError, OSError):
        return
