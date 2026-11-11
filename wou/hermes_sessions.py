"""Archive / unarchive Hermes chats when the last task is done."""

from __future__ import annotations

import logging

from .paths import state_db_path_for_chat_key
from .store import session_id_from_chat_key


def is_local_default_chat(chat_key: str) -> bool:
    """Local default-profile session ids have no profile prefix."""
    return ":" not in chat_key


def _set_archived(chat_key: str, archived: bool) -> bool:
    db = None
    try:
        from hermes_state import SessionDB

        path = state_db_path_for_chat_key(chat_key)
        if not path.is_file():
            return False  # Never create a session database just to archive.
        db = SessionDB(db_path=path)
        return bool(db.set_session_archived(session_id_from_chat_key(chat_key), archived))
    except Exception as exc:
        logging.getLogger(__name__).warning("Cannot archive/unarchive chat %r: %s", chat_key, exc)
        return False
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass


def archive_chat(chat_key: str) -> bool:
    """Archive the owning profile's session, not the active UI profile."""
    return _set_archived(chat_key, True)


def unarchive_chat(chat_key: str) -> bool:
    """Restore the same owning session when its completed task is undone."""
    return _set_archived(chat_key, False)
