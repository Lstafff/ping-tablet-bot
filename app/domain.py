from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any, Optional


DEFAULT_USER_NAME = "Игрок"
TEST_OPPONENT_NAME = "Тестовый соперник"
TEST_OPPONENT_USERNAME = "test"


@dataclass(frozen=True)
class User:
    telegram_id: int
    first_name: str
    username: Optional[str]
    last_message_id: Optional[int]
    created_at: str
    rating: Optional[str]
    rating_is_fnt: bool


@dataclass(frozen=True)
class Opponent:
    id: int
    owner_id: int
    name: str
    opponent_user_id: Optional[int]
    first_name: Optional[str] = None
    username: Optional[str] = None


@dataclass(frozen=True)
class Stats:
    wins: int
    losses: int
    points_for: int
    points_against: int

    @property
    def games(self) -> int:
        return self.wins + self.losses


@dataclass(frozen=True)
class ExtendedStats:
    games: int
    overtime_wins: int
    overtime_losses: int
    longest_own_score: Optional[int]
    longest_opponent_score: Optional[int]
    longest_points: int
    win_streak: int
    large_margin_games: int
    close_margin_games: int
    most_common_score: Optional[str]
    most_common_score_count: int

    @property
    def overtime_games(self) -> int:
        return self.overtime_wins + self.overtime_losses


@dataclass(frozen=True)
class DailyStats:
    played_on: str
    wins: int
    losses: int


@dataclass(frozen=True)
class RecentGame:
    played_at: str
    own_score: int
    opponent_score: int


@dataclass(frozen=True)
class Session:
    mode: str
    opponent_id: Optional[int]


@dataclass(frozen=True)
class InviteAcceptance:
    inviter_id: int
    is_self_invite: bool
    is_new_opponent: bool


def username_label(username: str) -> str:
    if username.startswith("@"):
        return username
    return f"@{username}"


def display_user_name(first_name: str, username: Optional[str]) -> str:
    if username:
        return username_label(username)
    return first_name or DEFAULT_USER_NAME


def opponent_title(opponent: Opponent) -> str:
    if opponent.username:
        return username_label(opponent.username)

    if opponent.opponent_user_id is None and opponent.name == TEST_OPPONENT_NAME:
        return username_label(TEST_OPPONENT_USERNAME)

    return opponent.first_name or opponent.name


def build_extended_stats(game_rows: list[dict[str, Any]]) -> ExtendedStats:
    overtime_wins = 0
    overtime_losses = 0
    longest_own_score: Optional[int] = None
    longest_opponent_score: Optional[int] = None
    longest_points = 0
    win_streak = 0
    large_margin_games = 0
    close_margin_games = 0
    score_counter: Counter[str] = Counter()

    for index, row in enumerate(game_rows):
        own_score = int(row["own_score"])
        opponent_score = int(row["opponent_score"])
        score_counter[f"{own_score}-{opponent_score}"] += 1

        if row["is_overtime"]:
            if own_score > opponent_score:
                overtime_wins += 1
            else:
                overtime_losses += 1

        points = own_score + opponent_score
        if points > longest_points:
            longest_points = points
            longest_own_score = own_score
            longest_opponent_score = opponent_score

        score_difference = abs(own_score - opponent_score)
        if score_difference > 6:
            large_margin_games += 1
        if score_difference == 2:
            close_margin_games += 1

        if index == win_streak and own_score > opponent_score:
            win_streak += 1

    most_common_score = None
    most_common_score_count = 0
    if score_counter:
        most_common_score, most_common_score_count = score_counter.most_common(1)[0]

    return ExtendedStats(
        games=len(game_rows),
        overtime_wins=overtime_wins,
        overtime_losses=overtime_losses,
        longest_own_score=longest_own_score,
        longest_opponent_score=longest_opponent_score,
        longest_points=longest_points,
        win_streak=win_streak,
        large_margin_games=large_margin_games,
        close_margin_games=close_margin_games,
        most_common_score=most_common_score,
        most_common_score_count=most_common_score_count,
    )
