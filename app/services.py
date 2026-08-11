from __future__ import annotations

import asyncio
import logging
import unicodedata
from dataclasses import dataclass
from typing import Callable, Optional

from app.domain import (
    DEFAULT_USER_NAME,
    DailyStats,
    ExtendedStats,
    Opponent,
    RecentGame,
    Session,
    Stats,
    User,
    display_user_name,
    opponent_title,
)
from app.rating import fetch_fnt_rating, is_allowed_rating_url, parse_manual_rating
from app.scoring import ParsedScore, ScoreError, parse_pair, parse_score
from app.states import (
    DAILY_STATS_PAGE_SIZE,
    SESSION_EDIT_GAMES,
    SESSION_EDIT_POINTS,
    SESSION_INVITE_CODE,
    SESSION_RATING,
    SESSION_SCORE,
)
from app.storage import Database


INVITE_INVALID = "invalid"
INVITE_SELF = "self"
INVITE_ACCEPTED = "accepted"
INVITE_ALREADY_CONNECTED = "already_connected"

RATING_EMPTY = "empty"
RATING_INVALID = "invalid"
RATING_UPDATED = "updated"


@dataclass(frozen=True)
class MainMenuView:
    has_opponents: bool


@dataclass(frozen=True)
class InviteView:
    code: str
    link: str


@dataclass(frozen=True)
class InviteAcceptResult:
    status: str
    inviter_id: Optional[int]
    has_opponents: bool


@dataclass(frozen=True)
class RatingPromptView:
    has_rating: bool


@dataclass(frozen=True)
class RatingInputResult:
    status: str
    has_rating: bool


@dataclass(frozen=True)
class OpponentView:
    opponent: Opponent
    opponent_name: str
    opponent_elo_rating: Optional[int] = None


@dataclass(frozen=True)
class EditMenuView:
    opponent_name: str
    stats: Stats
    user_name: str


@dataclass(frozen=True)
class ScoreSubmission:
    opponent_id: int
    opponent_name: str
    user_name: str
    score: Optional[ParsedScore]
    game_id: Optional[int]
    recent_games: list[RecentGame]
    error: Optional[ScoreError]
    elo_rating: Optional[int] = None
    elo_change: Optional[int] = None
    opponent_elo_rating: Optional[int] = None


@dataclass(frozen=True)
class ScoreUndoResult:
    deleted: bool
    opponent_name: str
    user_name: str
    recent_games: list[RecentGame]


@dataclass(frozen=True)
class OpponentStatsView:
    opponent_name: str
    stats: Stats
    extended_stats: ExtendedStats
    user_name: str


@dataclass(frozen=True)
class OpponentDailyStatsView:
    opponent_name: str
    daily_stats: list[DailyStats]
    user_name: str
    page: int
    total_pages: int


@dataclass(frozen=True)
class OpponentGamesView:
    opponent_name: str
    games: list[RecentGame]
    user_name: str
    page: int
    total_pages: int


@dataclass(frozen=True)
class HistoryGame:
    opponent_id: int
    opponent_name: str
    played_at: str
    own_score: int
    opponent_score: int
    game_id: Optional[int] = None
    elo_change: Optional[int] = None


@dataclass(frozen=True)
class GameHistoryView:
    games: list[HistoryGame]
    page: int
    total_pages: int


@dataclass(frozen=True)
class ProfileView:
    user: User
    stats: Stats
    extended_stats: ExtendedStats


@dataclass(frozen=True)
class OpponentActionResult:
    opponent_name: str
    has_opponents: bool


class TennisService:
    def __init__(
        self,
        storage: Database,
        seed_test_opponent: bool = True,
        rating_fetcher: Callable[[str], Optional[str]] = fetch_fnt_rating,
    ) -> None:
        self.storage = storage
        self.seed_test_opponent = seed_test_opponent
        self.rating_fetcher = rating_fetcher

    def ensure_user(self, telegram_id: int, first_name: Optional[str], username: Optional[str]) -> User:
        user = self.storage.ensure_user(telegram_id, first_name or DEFAULT_USER_NAME, username)
        if self.seed_test_opponent:
            self.storage.ensure_test_opponent(telegram_id)
        return user

    def clear_session(self, user_id: int) -> None:
        self.storage.clear_session(user_id)

    def get_session(self, user_id: int) -> Optional[Session]:
        return self.storage.get_session(user_id)

    def get_main_menu(self, user_id: int) -> MainMenuView:
        return MainMenuView(has_opponents=bool(self.storage.list_opponents(user_id)))

    def create_invite(self, inviter_id: int, bot_username: str) -> InviteView:
        invite_code = self.create_invite_code(inviter_id)
        return InviteView(code=invite_code, link=f"https://t.me/{bot_username}?start=invite_{invite_code}")

    def create_invite_code(self, inviter_id: int) -> str:
        return self.storage.get_or_create_invite_code(inviter_id)

    def start_invite_code_input(self, user_id: int) -> None:
        self.storage.set_session(user_id, SESSION_INVITE_CODE, None)

    def accept_invite(self, invite_code: str, user_id: int) -> InviteAcceptResult:
        acceptance = self.storage.accept_invite(invite_code, user_id)
        has_opponents = bool(self.storage.list_opponents(user_id))
        if acceptance is None:
            return InviteAcceptResult(status=INVITE_INVALID, inviter_id=None, has_opponents=has_opponents)
        if acceptance.is_self_invite:
            return InviteAcceptResult(status=INVITE_SELF, inviter_id=acceptance.inviter_id, has_opponents=has_opponents)
        if acceptance.is_new_opponent:
            return InviteAcceptResult(
                status=INVITE_ACCEPTED,
                inviter_id=acceptance.inviter_id,
                has_opponents=has_opponents,
            )
        return InviteAcceptResult(
            status=INVITE_ALREADY_CONNECTED,
            inviter_id=acceptance.inviter_id,
            has_opponents=has_opponents,
        )

    def get_invited_user_name(self, invited_user_id: int) -> str:
        invited = self.storage.get_user(invited_user_id)
        return display_user_name(invited.first_name, invited.username)

    def start_rating_input(self, user_id: int) -> RatingPromptView:
        user = self.storage.get_user(user_id)
        self.storage.set_session(user_id, SESSION_RATING, None)
        return RatingPromptView(has_rating=user.rating is not None)

    def clear_rating(self, user_id: int) -> None:
        self.storage.set_user_rating(user_id, None, False)
        self.storage.clear_session(user_id)

    async def submit_rating_input(self, user_id: int, raw_text: str) -> RatingInputResult:
        rating_input = raw_text.strip()
        user = self.storage.get_user(user_id)
        if not rating_input:
            return RatingInputResult(status=RATING_EMPTY, has_rating=user.rating is not None)

        if is_allowed_rating_url(rating_input):
            try:
                rating = await asyncio.to_thread(self.rating_fetcher, rating_input)
            except Exception:
                logging.exception("Failed to fetch FNT rating")
                rating = None
            if rating is None:
                return RatingInputResult(status=RATING_INVALID, has_rating=user.rating is not None)
            self.storage.set_user_rating(user_id, rating, True)
        else:
            rating = parse_manual_rating(rating_input)
            if rating is None:
                return RatingInputResult(status=RATING_INVALID, has_rating=user.rating is not None)
            self.storage.set_user_rating(user_id, rating, False)

        self.storage.clear_session(user_id)
        return RatingInputResult(status=RATING_UPDATED, has_rating=True)

    def list_opponents(self, user_id: int) -> list[Opponent]:
        return self.storage.list_opponents(user_id)

    def get_opponent_view(self, user_id: int, opponent_id: int) -> OpponentView:
        opponent = self.storage.get_opponent(user_id, opponent_id)
        return OpponentView(
            opponent=opponent,
            opponent_name=opponent_title(opponent),
            opponent_elo_rating=opponent.elo_rating,
        )

    def start_score_input(self, user_id: int, opponent_id: int) -> OpponentView:
        view = self.get_opponent_view(user_id, opponent_id)
        self.storage.set_session(user_id, SESSION_SCORE, opponent_id)
        return view

    def submit_score(
        self,
        user_id: int,
        opponent_id: int,
        raw_score: str,
        operation_id: Optional[str] = None,
    ) -> ScoreSubmission:
        opponent = self.storage.get_opponent(user_id, opponent_id)
        opponent_name = opponent_title(opponent)
        opponent_elo_rating = opponent.elo_rating
        try:
            score = parse_score(raw_score)
        except ScoreError as error:
            return ScoreSubmission(
                opponent_id=opponent_id,
                opponent_name=opponent_name,
                user_name="",
                score=None,
                game_id=None,
                recent_games=[],
                error=error,
                opponent_elo_rating=opponent_elo_rating,
            )

        game_id = self.storage.add_game(user_id, opponent_id, score, operation_id=operation_id)
        recent_games = self.storage.get_recent_games(user_id, opponent_id)
        user = self.storage.get_user(user_id)
        elo_event = self.storage.get_elo_event(game_id, user_id) if opponent.opponent_user_id is not None else None
        if opponent.opponent_user_id is not None:
            opponent_elo_rating = self.storage.get_user(opponent.opponent_user_id).elo_rating
        return ScoreSubmission(
            opponent_id=opponent_id,
            opponent_name=opponent_name,
            user_name=display_user_name(user.first_name, user.username),
            score=score,
            game_id=game_id,
            recent_games=recent_games,
            error=None,
            elo_rating=elo_event.rating_after if elo_event is not None else None,
            elo_change=elo_event.rating_change if elo_event is not None else None,
            opponent_elo_rating=opponent_elo_rating,
        )

    def undo_score(self, user_id: int, opponent_id: int, game_id: int) -> ScoreUndoResult:
        deleted = self.storage.delete_game(user_id, opponent_id, game_id)
        opponent = self.storage.get_opponent(user_id, opponent_id)
        opponent_name = opponent_title(opponent)
        if not deleted:
            return ScoreUndoResult(deleted=False, opponent_name=opponent_name, user_name="", recent_games=[])

        self.storage.set_session(user_id, SESSION_SCORE, opponent_id)
        recent_games = self.storage.get_recent_games(user_id, opponent_id)
        user = self.storage.get_user(user_id)
        return ScoreUndoResult(
            deleted=True,
            opponent_name=opponent_name,
            user_name=display_user_name(user.first_name, user.username),
            recent_games=recent_games,
        )

    def get_edit_menu(self, user_id: int, opponent_id: int) -> EditMenuView:
        opponent = self.storage.get_opponent(user_id, opponent_id)
        stats = self.storage.get_opponent_stats(user_id, opponent_id)
        user = self.storage.get_user(user_id)
        return EditMenuView(
            opponent_name=opponent_title(opponent),
            stats=stats,
            user_name=display_user_name(user.first_name, user.username),
        )

    def start_edit_games_input(self, user_id: int, opponent_id: int) -> OpponentView:
        view = self.get_opponent_view(user_id, opponent_id)
        self.storage.set_session(user_id, SESSION_EDIT_GAMES, opponent_id)
        return view

    def start_edit_points_input(self, user_id: int, opponent_id: int) -> OpponentView:
        view = self.get_opponent_view(user_id, opponent_id)
        self.storage.set_session(user_id, SESSION_EDIT_POINTS, opponent_id)
        return view

    def set_games_total_from_input(self, user_id: int, opponent_id: int, raw_text: str) -> None:
        wins, losses = parse_pair(raw_text, "8-5")
        self.storage.set_games_total(user_id, opponent_id, wins, losses)
        self.storage.clear_session(user_id)

    def set_points_total_from_input(self, user_id: int, opponent_id: int, raw_text: str) -> None:
        points_for, points_against = parse_pair(raw_text, "132-118")
        self.storage.set_points_total(user_id, opponent_id, points_for, points_against)
        self.storage.clear_session(user_id)

    def get_opponent_total_stats(self, user_id: int, opponent_id: int) -> OpponentStatsView:
        opponent = self.storage.get_opponent(user_id, opponent_id)
        stats = self.storage.get_opponent_stats(user_id, opponent_id)
        extended_stats = self.storage.get_opponent_extended_stats(user_id, opponent_id)
        user = self.storage.get_user(user_id)
        return OpponentStatsView(
            opponent_name=opponent_title(opponent),
            stats=stats,
            extended_stats=extended_stats,
            user_name=display_user_name(user.first_name, user.username),
        )

    def get_opponent_stats(self, user_id: int, opponent_id: int) -> Stats:
        self.storage.get_opponent(user_id, opponent_id)
        return self.storage.get_opponent_stats(user_id, opponent_id)

    def get_opponent_daily_stats(
        self,
        user_id: int,
        opponent_id: int,
        page: int = 1,
        page_size: int = DAILY_STATS_PAGE_SIZE,
    ) -> OpponentDailyStatsView:
        opponent = self.storage.get_opponent(user_id, opponent_id)
        daily_stats = self.storage.get_opponent_daily_stats(user_id, opponent_id)
        user = self.storage.get_user(user_id)
        total_pages = max(1, (len(daily_stats) + page_size - 1) // page_size)
        page = min(max(page, 1), total_pages)
        page_start = (page - 1) * page_size
        return OpponentDailyStatsView(
            opponent_name=opponent_title(opponent),
            daily_stats=daily_stats[page_start : page_start + page_size],
            user_name=display_user_name(user.first_name, user.username),
            page=page,
            total_pages=total_pages,
        )

    def get_opponent_games_stats(
        self,
        user_id: int,
        opponent_id: int,
        page: int = 1,
        page_size: int = DAILY_STATS_PAGE_SIZE,
    ) -> OpponentGamesView:
        opponent = self.storage.get_opponent(user_id, opponent_id)
        user = self.storage.get_user(user_id)
        games_count = self.storage.count_opponent_games(user_id, opponent_id)
        total_pages = max(1, (games_count + page_size - 1) // page_size)
        page = min(max(page, 1), total_pages)
        offset = (page - 1) * page_size
        games = self.storage.get_recent_games(user_id, opponent_id, limit=page_size, offset=offset)
        return OpponentGamesView(
            opponent_name=opponent_title(opponent),
            games=games,
            user_name=display_user_name(user.first_name, user.username),
            page=page,
            total_pages=total_pages,
        )

    def get_game_history(
        self,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
    ) -> GameHistoryView:
        opponents = {
            opponent.id: opponent_title(opponent)
            for opponent in self.storage.list_opponents(user_id)
        }
        games_count = self.storage.count_user_games(user_id)
        total_pages = max(1, (games_count + page_size - 1) // page_size)
        page = min(max(page, 1), total_pages)
        page_start = (page - 1) * page_size
        rows = self.storage.get_user_game_history(user_id, limit=page_size, offset=page_start)
        return GameHistoryView(
            games=[
                HistoryGame(
                    opponent_id=row["opponent_id"],
                    opponent_name=opponents.get(row["opponent_id"], "Соперник"),
                    played_at=row["played_at"],
                    own_score=row["own_score"],
                    opponent_score=row["opponent_score"],
                    game_id=row["game_id"],
                    elo_change=row["elo_change"],
                )
                for row in rows
            ],
            page=page,
            total_pages=total_pages,
        )

    def get_profile(self, user_id: int) -> ProfileView:
        return ProfileView(
            user=self.storage.get_user(user_id),
            stats=self.storage.get_total_stats(user_id),
            extended_stats=self.storage.get_total_extended_stats(user_id),
        )

    def update_display_name(self, user_id: int, display_name: str) -> ProfileView:
        normalized = " ".join(display_name.split())
        if not normalized:
            raise ValueError("Введите имя.")
        self.storage.set_user_display_name(user_id, normalized)
        return self.get_profile(user_id)

    def update_avatar(self, user_id: int, avatar_value: str) -> ProfileView:
        normalized = avatar_value.strip()
        is_image = normalized.startswith((
            "data:image/png;base64,",
            "data:image/jpeg;base64,",
            "data:image/webp;base64,",
        ))
        is_emoji = len(normalized) <= 32 and any(
            unicodedata.category(character) in {"So", "Sk"} for character in normalized
        )
        if not (is_image or is_emoji) or len(normalized) > 200_000:
            raise ValueError("Выберите изображение или эмодзи.")
        self.storage.set_user_avatar(user_id, normalized)
        return self.get_profile(user_id)

    def reset_opponent_stats(self, user_id: int, opponent_id: int) -> OpponentActionResult:
        opponent = self.storage.get_opponent(user_id, opponent_id)
        opponent_name = opponent_title(opponent)
        self.storage.reset_opponent_stats(user_id, opponent_id)
        self.storage.clear_session(user_id)
        return OpponentActionResult(
            opponent_name=opponent_name,
            has_opponents=bool(self.storage.list_opponents(user_id)),
        )

    def delete_opponent(self, user_id: int, opponent_id: int) -> OpponentActionResult:
        opponent = self.storage.get_opponent(user_id, opponent_id)
        opponent_name = opponent_title(opponent)
        self.storage.delete_opponent(user_id, opponent_id)
        self.storage.clear_session(user_id)
        return OpponentActionResult(
            opponent_name=opponent_name,
            has_opponents=bool(self.storage.list_opponents(user_id)),
        )
