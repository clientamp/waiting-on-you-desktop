"""Portable file locks for the satellite package (no root wou imports)."""

from __future__ import annotations

import os
from typing import Any


def _ensure_byte(handle: Any) -> None:
    try:
        handle.seek(0, 2)
        if handle.tell() == 0:
            handle.write("\0")
            handle.flush()
    except OSError:
        pass


def try_exclusive_lock(handle: Any) -> bool:
    """Non-blocking exclusive lock. Never raises."""
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


def try_exclusive_lock_fd(fd: int) -> bool:
    try:
        import fcntl

        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return True
    except ImportError:
        pass
    except (OSError, BlockingIOError):
        return False
    try:
        import msvcrt

        if os.fstat(fd).st_size == 0:
            os.lseek(fd, 0, os.SEEK_SET)
            os.write(fd, b"\0")
        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
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


def release_fd_lock(fd: int) -> None:
    try:
        import fcntl

        fcntl.flock(fd, fcntl.LOCK_UN)
        return
    except ImportError:
        pass
    except OSError:
        return
    try:
        import msvcrt

        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
    except (ImportError, OSError):
        return
