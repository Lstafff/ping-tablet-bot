from __future__ import annotations

from typing import Optional


def parse_callback_id(data: Optional[str], prefix: str) -> Optional[int]:
    if data is None or not data.startswith(prefix):
        return None
    value = data.removeprefix(prefix)
    if not value.isdecimal():
        return None
    return int(value)


def parse_score_undo_callback(data: Optional[str]) -> Optional[tuple[int, int]]:
    if data is None:
        return None
    parts = data.split(":")
    if len(parts) != 3 or parts[0] != "score_undo":
        return None
    if not parts[1].isdecimal() or not parts[2].isdecimal():
        return None
    return int(parts[1]), int(parts[2])


def parse_stats_days_callback(data: Optional[str]) -> Optional[tuple[int, int]]:
    if data is None:
        return None
    parts = data.split(":")
    if len(parts) not in {2, 3} or parts[0] != "stats_days":
        return None
    if not parts[1].isdecimal():
        return None
    if len(parts) == 3 and not parts[2].isdecimal():
        return None
    page = int(parts[2]) if len(parts) == 3 else 1
    return int(parts[1]), page
