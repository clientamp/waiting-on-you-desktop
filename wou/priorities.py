"""Deterministic priority rules; due dates end at 23:59:59 local wall time.

Naive datetime.timestamp uses the host timezone including date-specific DST.
"""

from datetime import datetime, time as day_time
import re
import time


URGENCY_LEVELS = {
    '0': 'No time pressure.',
    '1': 'This week / soon.',
    '2': 'Due within about two days.',
    '3': 'Concrete work blocked right now or due today. Merely waiting for a reply is not a blocker.',
}
IMPORTANCE_LEVELS = {
    '0': 'Trivia.',
    '1': 'Minor preference or polish.',
    '2': "Meaningful work progress or a decision shaping the user's projects.",
    '3': 'Money, clients, family, health, legal, or a shipping product at stake.',
}


def score(value):
    try:
        if isinstance(value, bool):
            return 0
        return max(0, min(3, int(value)))
    except (TypeError, ValueError, OverflowError):
        return 0


def due_timestamp(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return None
    try:
        date = datetime.strptime(value, "%Y-%m-%d").date()
        return datetime.combine(date, day_time(23, 59, 59)).timestamp()
    except (ValueError, OverflowError, OSError):
        return None


def quadrant_for(urgency, importance, due_at=None, now=None):
    urgent = score(urgency) >= 2 or (
        due_at is not None
        and due_at <= (time.time() if now is None else now) + 48 * 3600
    )
    important = score(importance) >= 2
    return (1 if important else 3) if urgent else (2 if important else 4)
