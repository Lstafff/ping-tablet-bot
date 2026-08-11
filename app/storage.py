from __future__ import annotations

import secrets
import string
from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

from app.db import CURRENT_SCHEMA_VERSION, PostgresConnection
from app.domain import (
    DEFAULT_USER_NAME,
    TEST_OPPONENT_NAME,
    DailyStats,
    ExtendedStats,
    InviteAcceptance,
    Opponent,
    RecentGame,
    Session,
    Stats,
    User,
    build_extended_stats,
    display_user_name,
)
from app.elo import EloEvent, EloGame, INITIAL_ELO_RATING, calculate_rating_change, rebuild_elo_ratings
from app.scoring import ParsedScore
from app.states import KNOWN_SESSION_MODES


MOSCOW_TZ = ZoneInfo("Europe/Moscow")
INVITE_CODE_ALPHABET = string.ascii_uppercase + string.digits
INVITE_CODE_LENGTH = 8
class Database:
    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise RuntimeError("Нужно задать DATABASE_URL для подключения к Postgres.")
        self.database_url = database_url
        self.connection = PostgresConnection(database_url)
        self._assert_schema_current()

    def close(self) -> None:
        self.connection.close()

    def _assert_schema_current(self) -> None:
        table = self.connection.execute(
            "SELECT to_regclass('public.schema_migrations') AS table_name"
        ).fetchone()
        if table is None or table["table_name"] is None:
            raise RuntimeError("Схема Postgres не инициализирована. Запустите python -m app.migrations.")
        row = self.connection.execute(
            "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations"
        ).fetchone()
        if int(row["version"]) != CURRENT_SCHEMA_VERSION:
            raise RuntimeError(
                "Схема Postgres устарела. Запустите python -m app.migrations перед приложением."
            )

    def recalculate_elo_ratings(self) -> None:
        with self.connection:
            self._recalculate_elo_ratings()

    def _recalculate_elo_ratings(self) -> None:
        rows = self.connection.execute(
            """
            SELECT id, player_a_id, player_b_id, player_a_score, player_b_score, played_at
            FROM games
            WHERE player_b_id IS NOT NULL
            ORDER BY played_at ASC, id ASC
            """
        ).fetchall()
        games = [
            EloGame(
                game_id=int(row["id"]),
                player_a_id=int(row["player_a_id"]),
                player_b_id=int(row["player_b_id"]),
                player_a_score=int(row["player_a_score"]),
                player_b_score=int(row["player_b_score"]),
                played_at=str(row["played_at"]),
            )
            for row in rows
        ]
        ratings, games_played, events = rebuild_elo_ratings(games)

        self.connection.execute("DELETE FROM elo_events")
        self.connection.execute(
            "UPDATE users SET elo_rating = ?, elo_games = 0",
            (INITIAL_ELO_RATING,),
        )
        for event in events:
            self._insert_elo_event(event)
        for player_id, rating in ratings.items():
            self.connection.execute(
                "UPDATE users SET elo_rating = ?, elo_games = ? WHERE telegram_id = ?",
                (rating, games_played[player_id], player_id),
            )

    def _insert_elo_event(self, event: EloEvent) -> None:
        self.connection.execute(
            """
            INSERT INTO elo_events (
                game_id, player_id, opponent_id, rating_before,
                rating_change, rating_after, played_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.game_id,
                event.player_id,
                event.opponent_id,
                event.rating_before,
                event.rating_change,
                event.rating_after,
                event.played_at,
            ),
        )

    def ensure_user(self, telegram_id: int, first_name: str, username: Optional[str]) -> User:
        now = now_moscow_iso()
        self.connection.execute(
            """
            INSERT INTO users (telegram_id, first_name, username, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(telegram_id) DO UPDATE SET
                first_name = excluded.first_name,
                username = excluded.username,
                updated_at = excluded.updated_at
            """,
            (telegram_id, first_name or DEFAULT_USER_NAME, username, now, now),
        )
        self.connection.commit()
        return self.get_user(telegram_id)

    def get_user(self, telegram_id: int) -> User:
        row = self.connection.execute(
            """
            SELECT
                telegram_id, first_name, username, last_message_id, created_at,
                rating, rating_is_fnt, display_name, avatar_value, elo_rating, elo_games
            FROM users
            WHERE telegram_id = ?
            """,
            (telegram_id,),
        ).fetchone()
        if row is None:
            raise LookupError("Пользователь не найден.")
        return User(
            telegram_id=row["telegram_id"],
            first_name=row["first_name"],
            username=row["username"],
            last_message_id=row["last_message_id"],
            created_at=row["created_at"],
            rating=row["rating"],
            rating_is_fnt=bool(row["rating_is_fnt"]),
            display_name=row["display_name"],
            avatar_value=row["avatar_value"],
            elo_rating=int(row["elo_rating"]),
            elo_games=int(row["elo_games"]),
        )

    def get_elo_event(self, game_id: int, player_id: int) -> Optional[EloEvent]:
        row = self.connection.execute(
            """
            SELECT game_id, player_id, opponent_id, rating_before,
                   rating_change, rating_after, played_at
            FROM elo_events
            WHERE game_id = ? AND player_id = ?
            """,
            (game_id, player_id),
        ).fetchone()
        if row is None:
            return None
        return EloEvent(
            game_id=int(row["game_id"]),
            player_id=int(row["player_id"]),
            opponent_id=int(row["opponent_id"]),
            rating_before=int(row["rating_before"]),
            rating_change=int(row["rating_change"]),
            rating_after=int(row["rating_after"]),
            played_at=str(row["played_at"]),
        )

    def set_user_display_name(self, telegram_id: int, display_name: str) -> None:
        self.connection.execute(
            "UPDATE users SET display_name = ?, updated_at = ? WHERE telegram_id = ?",
            (display_name, now_moscow_iso(), telegram_id),
        )
        self.connection.commit()

    def set_user_avatar(self, telegram_id: int, avatar_value: str) -> None:
        self.connection.execute(
            "UPDATE users SET avatar_value = ?, updated_at = ? WHERE telegram_id = ?",
            (avatar_value, now_moscow_iso(), telegram_id),
        )
        self.connection.commit()

    def set_last_message_id(self, telegram_id: int, message_id: int) -> None:
        self.connection.execute(
            "UPDATE users SET last_message_id = ?, updated_at = ? WHERE telegram_id = ?",
            (message_id, now_moscow_iso(), telegram_id),
        )
        self.connection.commit()

    def get_last_message_id(self, telegram_id: int) -> Optional[int]:
        row = self.connection.execute(
            "SELECT last_message_id FROM users WHERE telegram_id = ?",
            (telegram_id,),
        ).fetchone()
        if row is None:
            return None
        return row["last_message_id"]

    def set_user_rating(self, telegram_id: int, rating: Optional[str], rating_is_fnt: bool) -> None:
        self.connection.execute(
            """
            UPDATE users
            SET rating = ?, rating_is_fnt = ?, updated_at = ?
            WHERE telegram_id = ?
            """,
            (rating, int(rating_is_fnt), now_moscow_iso(), telegram_id),
        )
        self.connection.commit()

    def ensure_test_opponent(self, owner_id: int) -> None:
        if self.list_opponents(owner_id):
            return
        self.add_opponent(owner_id=owner_id, name=TEST_OPPONENT_NAME, opponent_user_id=None)

    def add_opponent(self, owner_id: int, name: str, opponent_user_id: Optional[int]) -> Opponent:
        now = now_moscow_iso()
        if opponent_user_id is not None:
            row = self.connection.execute(
                """
                SELECT id FROM opponents
                WHERE owner_id = ? AND opponent_user_id = ?
                """,
                (owner_id, opponent_user_id),
            ).fetchone()
            if row is not None:
                opponent_id = int(row["id"])
                self.connection.execute(
                    "UPDATE opponents SET is_hidden = FALSE WHERE id = ?",
                    (opponent_id,),
                )
                self.connection.commit()
                return self._get_opponent_record(owner_id, opponent_id, include_hidden=True)
            name = self._unique_opponent_name(owner_id, name)

        self.connection.execute(
            """
            INSERT INTO opponents (owner_id, opponent_user_id, name, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT DO NOTHING
            """,
            (owner_id, opponent_user_id, name, now),
        )
        self.connection.commit()

        if opponent_user_id is not None:
            row = self.connection.execute(
                """
                SELECT id FROM opponents
                WHERE owner_id = ? AND opponent_user_id = ?
                """,
                (owner_id, opponent_user_id),
            ).fetchone()
        else:
            row = self.connection.execute(
                """
                SELECT id FROM opponents
                WHERE owner_id = ? AND name = ? AND opponent_user_id IS NULL
                """,
                (owner_id, name),
            ).fetchone()
        return self.get_opponent(owner_id, int(row["id"]))

    def list_opponents(self, owner_id: int) -> list[Opponent]:
        rows = self.connection.execute(
            """
            SELECT
                o.id,
                o.owner_id,
                o.name,
                o.opponent_user_id,
                u.first_name,
                u.username,
                u.elo_rating,
                o.history_start_game_id,
                o.is_hidden
            FROM opponents o
            LEFT JOIN users u ON u.telegram_id = o.opponent_user_id
            WHERE o.owner_id = ? AND o.is_hidden = FALSE
            ORDER BY lower(o.name)
            """,
            (owner_id,),
        ).fetchall()
        return [
            Opponent(
                id=row["id"],
                owner_id=row["owner_id"],
                name=row["name"],
                opponent_user_id=row["opponent_user_id"],
                first_name=row["first_name"],
                username=row["username"],
                elo_rating=int(row["elo_rating"]) if row["elo_rating"] is not None else None,
                history_start_game_id=int(row["history_start_game_id"]),
                is_hidden=bool(row["is_hidden"]),
            )
            for row in rows
        ]

    def get_opponent(self, owner_id: int, opponent_id: int) -> Opponent:
        return self._get_opponent_record(owner_id, opponent_id, include_hidden=False)

    def _get_opponent_record(self, owner_id: int, opponent_id: int, *, include_hidden: bool) -> Opponent:
        row = self.connection.execute(
            """
            SELECT
                o.id,
                o.owner_id,
                o.name,
                o.opponent_user_id,
                u.first_name,
                u.username,
                u.elo_rating,
                o.history_start_game_id,
                o.is_hidden
            FROM opponents o
            LEFT JOIN users u ON u.telegram_id = o.opponent_user_id
            WHERE o.owner_id = ? AND o.id = ? AND (? OR o.is_hidden = FALSE)
            """,
            (owner_id, opponent_id, include_hidden),
        ).fetchone()
        if row is None:
            raise LookupError("Соперник не найден.")
        return Opponent(
            id=row["id"],
            owner_id=row["owner_id"],
            name=row["name"],
            opponent_user_id=row["opponent_user_id"],
            first_name=row["first_name"],
            username=row["username"],
            elo_rating=int(row["elo_rating"]) if row["elo_rating"] is not None else None,
            history_start_game_id=int(row["history_start_game_id"]),
            is_hidden=bool(row["is_hidden"]),
        )

    def delete_opponent(self, owner_id: int, opponent_id: int) -> None:
        opponent = self.get_opponent(owner_id, opponent_id)
        with self.connection:
            if opponent.opponent_user_id is None:
                self.connection.execute(
                    "DELETE FROM opponents WHERE owner_id = ? AND id = ?",
                    (owner_id, opponent_id),
                )
                return

            purged_games = self._reset_linked_stats_for_owner(opponent)
            self.connection.execute(
                "UPDATE opponents SET is_hidden = TRUE WHERE owner_id = ? AND id = ?",
                (owner_id, opponent_id),
            )
            if purged_games:
                self._recalculate_elo_ratings()

    def reset_opponent_stats(self, owner_id: int, opponent_id: int) -> None:
        opponent = self.get_opponent(owner_id, opponent_id)
        with self.connection:
            if opponent.opponent_user_id is None:
                self.connection.execute(
                    "DELETE FROM games WHERE owner_id = ? AND opponent_id = ?",
                    (owner_id, opponent_id),
                )
                self._delete_adjustment(owner_id, opponent_id)
                return

            purged_games = self._reset_linked_stats_for_owner(opponent)
            if purged_games:
                self._recalculate_elo_ratings()

    def get_or_create_invite_code(self, inviter_id: int) -> str:
        row = self.connection.execute(
            "SELECT invite_code FROM users WHERE telegram_id = ?",
            (inviter_id,),
        ).fetchone()
        if row is None:
            raise LookupError("Пользователь не найден.")
        if row["invite_code"]:
            return str(row["invite_code"])

        invite_code = self._generate_unique_invite_code()
        self.connection.execute(
            """
            UPDATE users
            SET invite_code = ?, updated_at = ?
            WHERE telegram_id = ?
            """,
            (invite_code, now_moscow_iso(), inviter_id),
        )
        self.connection.commit()
        return invite_code

    def accept_invite(self, invite_code: str, invited_user_id: int) -> Optional[InviteAcceptance]:
        normalized_invite_code = normalize_invite_code(invite_code)
        row = self.connection.execute(
            """
            SELECT telegram_id AS inviter_id
            FROM users
            WHERE invite_code = ?
            """,
            (normalized_invite_code,),
        ).fetchone()
        if row is None:
            return None

        inviter_id = int(row["inviter_id"])
        if inviter_id == invited_user_id:
            return InviteAcceptance(inviter_id=inviter_id, is_self_invite=True, is_new_opponent=False)

        inviter = self.get_user(inviter_id)
        invited = self.get_user(invited_user_id)
        invited_name = display_user_name(invited.first_name, invited.username)
        inviter_name = display_user_name(inviter.first_name, inviter.username)
        already_linked = self._has_linked_opponent(inviter_id, invited_user_id)

        self.add_opponent(inviter_id, invited_name, invited_user_id)
        self.add_opponent(invited_user_id, inviter_name, inviter_id)
        with self.connection:
            self.connection.execute(
                """
                INSERT INTO invite_uses (
                    inviter_id, invited_user_id, invite_code, accepted_at
                )
                VALUES (?, ?, ?, ?)
                ON CONFLICT DO NOTHING
                """,
                (inviter_id, invited_user_id, normalized_invite_code or invite_code, now_moscow_iso()),
            )
        return InviteAcceptance(inviter_id=inviter_id, is_self_invite=False, is_new_opponent=not already_linked)

    def get_invite_referral_count(self, inviter_id: int) -> int:
        row = self.connection.execute(
            "SELECT COUNT(*) AS referral_count FROM invite_uses WHERE inviter_id = ?",
            (inviter_id,),
        ).fetchone()
        return int(row["referral_count"])

    def add_game(
        self,
        owner_id: int,
        opponent_id: int,
        score: ParsedScore,
        operation_id: Optional[str] = None,
    ) -> int:
        opponent = self.get_opponent(owner_id, opponent_id)
        normalized_operation_id = operation_id.strip() if operation_id is not None else None
        if normalized_operation_id == "":
            normalized_operation_id = None
        if normalized_operation_id is not None and len(normalized_operation_id) > 64:
            raise ValueError("Идентификатор операции слишком длинный.")
        now = now_moscow_iso()
        if opponent.opponent_user_id is None:
            owner_column = owner_id
            opponent_column = opponent.id
            player_b_id = None
        else:
            owner_column = None
            opponent_column = None
            player_b_id = opponent.opponent_user_id

        insert_query = """
            INSERT INTO games (
                created_by_id, owner_id, opponent_id, player_a_id, player_b_id,
                player_a_score, player_b_score, regular_a, regular_b,
                overtime_a, overtime_b, played_at, operation_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING
            RETURNING id
            """

        with self.connection:
            if normalized_operation_id is not None:
                existing_game_id = self._existing_operation_game_id(
                    owner_id,
                    normalized_operation_id,
                    opponent,
                    score,
                )
                if existing_game_id is not None:
                    return existing_game_id

            locked_ratings: dict[int, tuple[int, int]] = {}
            if player_b_id is not None:
                self._prepare_linked_pair_for_game(opponent)
                locked_ratings = self._lock_linked_ratings(owner_id, player_b_id)

            cursor = self.connection.execute(
                insert_query,
                (
                    owner_id,
                    owner_column,
                    opponent_column,
                    owner_id,
                    player_b_id,
                    score.own_score,
                    score.opponent_score,
                    score.regular_own,
                    score.regular_opponent,
                    score.overtime_own,
                    score.overtime_opponent,
                    now,
                    normalized_operation_id,
                ),
            )
            row = cursor.fetchone()
            if row is None:
                if normalized_operation_id is None:
                    raise RuntimeError("Не удалось сохранить игру.")
                existing_game_id = self._existing_operation_game_id(
                    owner_id,
                    normalized_operation_id,
                    opponent,
                    score,
                )
                if existing_game_id is None:
                    raise RuntimeError("Не удалось сохранить игру.")
                return existing_game_id

            game_id = int(row["id"])
            if player_b_id is not None:
                self._append_linked_elo_events(
                    game_id,
                    owner_id,
                    player_b_id,
                    score,
                    now,
                    locked_ratings,
                )
        return game_id

    def _existing_operation_game_id(
        self,
        owner_id: int,
        operation_id: str,
        opponent: Opponent,
        score: ParsedScore,
    ) -> Optional[int]:
        row = self.connection.execute(
            """
            SELECT
                id, owner_id, opponent_id, player_a_id, player_b_id,
                player_a_score, player_b_score, regular_a, regular_b,
                overtime_a, overtime_b
            FROM games
            WHERE created_by_id = ? AND operation_id = ?
            """,
            (owner_id, operation_id),
        ).fetchone()
        if row is None:
            return None

        if opponent.opponent_user_id is None:
            same_opponent = (
                row["owner_id"] == owner_id
                and row["opponent_id"] == opponent.id
                and row["player_b_id"] is None
            )
        else:
            same_opponent = (
                row["owner_id"] is None
                and row["opponent_id"] is None
                and row["player_a_id"] == owner_id
                and row["player_b_id"] == opponent.opponent_user_id
            )
        same_score = (
            row["player_a_score"] == score.own_score
            and row["player_b_score"] == score.opponent_score
            and row["regular_a"] == score.regular_own
            and row["regular_b"] == score.regular_opponent
            and row["overtime_a"] == score.overtime_own
            and row["overtime_b"] == score.overtime_opponent
        )
        if not same_opponent or not same_score:
            raise ValueError("Идентификатор операции уже использован для другого счёта.")
        return int(row["id"])

    def delete_game(self, owner_id: int, opponent_id: int, game_id: int) -> bool:
        opponent = self.get_opponent(owner_id, opponent_id)
        with self.connection:
            if opponent.opponent_user_id is None:
                cursor = self.connection.execute(
                    """
                    DELETE FROM games
                    WHERE id = ? AND created_by_id = ? AND owner_id = ? AND opponent_id = ?
                    """,
                    (game_id, owner_id, owner_id, opponent_id),
                )
            else:
                cursor = self.connection.execute(
                    """
                    DELETE FROM games
                    WHERE
                        id = ?
                        AND created_by_id = ?
                        AND (
                            (player_a_id = ? AND player_b_id = ?)
                            OR
                            (player_a_id = ? AND player_b_id = ?)
                        )
                    """,
                    (
                        game_id,
                        owner_id,
                        owner_id,
                        opponent.opponent_user_id,
                        opponent.opponent_user_id,
                        owner_id,
                    ),
                )

            deleted = cursor.rowcount > 0
            if deleted and opponent.opponent_user_id is not None:
                self._recalculate_elo_ratings()
        return deleted

    def get_opponent_stats(self, owner_id: int, opponent_id: int, adjusted: bool = True) -> Stats:
        opponent = self.get_opponent(owner_id, opponent_id)
        stats = self._raw_stats_for_opponent(owner_id, opponent)
        if not adjusted:
            return stats
        adjustment = self._get_adjustment(owner_id, opponent_id)
        return Stats(
            wins=stats.wins + adjustment["games_won_delta"],
            losses=stats.losses + adjustment["games_lost_delta"],
            points_for=stats.points_for + adjustment["points_for_delta"],
            points_against=stats.points_against + adjustment["points_against_delta"],
        )

    def get_total_stats(self, owner_id: int) -> Stats:
        total = Stats(wins=0, losses=0, points_for=0, points_against=0)
        for opponent in self.list_opponents(owner_id):
            stats = self.get_opponent_stats(owner_id, opponent.id)
            total = Stats(
                wins=total.wins + stats.wins,
                losses=total.losses + stats.losses,
                points_for=total.points_for + stats.points_for,
                points_against=total.points_against + stats.points_against,
            )
        return total

    def get_opponent_extended_stats(self, owner_id: int, opponent_id: int) -> ExtendedStats:
        opponent = self.get_opponent(owner_id, opponent_id)
        return build_extended_stats(self._game_rows_for_opponent(owner_id, opponent))

    def get_total_extended_stats(self, owner_id: int) -> ExtendedStats:
        rows: list[dict[str, Any]] = []
        for opponent in self.list_opponents(owner_id):
            rows.extend(self._game_rows_for_opponent(owner_id, opponent))
        rows.sort(key=lambda row: (row["played_at"], row["id"]), reverse=True)
        return build_extended_stats(rows)

    def get_opponent_daily_stats(self, owner_id: int, opponent_id: int) -> list[DailyStats]:
        opponent = self.get_opponent(owner_id, opponent_id)
        daily: dict[str, tuple[int, int]] = {}

        if opponent.opponent_user_id is None:
            rows = self.connection.execute(
                """
                SELECT played_at, player_a_score, player_b_score
                FROM games
                WHERE owner_id = ? AND opponent_id = ?
                ORDER BY played_at DESC
                """,
                (owner_id, opponent.id),
            ).fetchall()
            for row in rows:
                own_score = int(row["player_a_score"])
                opponent_score = int(row["player_b_score"])
                add_daily_result(daily, row["played_at"], own_score, opponent_score)
        else:
            rows = self.connection.execute(
                """
                SELECT player_a_id, player_b_id, player_a_score, player_b_score, played_at
                FROM games
                WHERE id > ? AND (
                    (player_a_id = ? AND player_b_id = ?)
                    OR
                    (player_a_id = ? AND player_b_id = ?)
                )
                ORDER BY played_at DESC
                """,
                (
                    opponent.history_start_game_id,
                    owner_id,
                    opponent.opponent_user_id,
                    opponent.opponent_user_id,
                    owner_id,
                ),
            ).fetchall()
            for row in rows:
                if int(row["player_a_id"]) == owner_id:
                    own_score = int(row["player_a_score"])
                    opponent_score = int(row["player_b_score"])
                else:
                    own_score = int(row["player_b_score"])
                    opponent_score = int(row["player_a_score"])
                add_daily_result(daily, row["played_at"], own_score, opponent_score)

        adjustment = self._get_adjustment(owner_id, opponent_id)
        add_daily_delta(
            daily,
            adjustment["games_updated_at"],
            adjustment["games_won_delta"],
            adjustment["games_lost_delta"],
        )

        return [
            DailyStats(played_on=played_on, wins=wins, losses=losses)
            for played_on, (wins, losses) in sorted(daily.items(), reverse=True)
        ]

    def count_opponent_games(self, owner_id: int, opponent_id: int) -> int:
        opponent = self.get_opponent(owner_id, opponent_id)

        if opponent.opponent_user_id is None:
            row = self.connection.execute(
                """
                SELECT COUNT(*) AS games_count
                FROM games
                WHERE owner_id = ? AND opponent_id = ?
                """,
                (owner_id, opponent.id),
            ).fetchone()
            return int(row["games_count"])

        row = self.connection.execute(
            """
            SELECT COUNT(*) AS games_count
            FROM games
            WHERE id > ? AND (
                (player_a_id = ? AND player_b_id = ?)
                OR
                (player_a_id = ? AND player_b_id = ?)
            )
            """,
            (
                opponent.history_start_game_id,
                owner_id,
                opponent.opponent_user_id,
                opponent.opponent_user_id,
                owner_id,
            ),
        ).fetchone()
        return int(row["games_count"])

    def get_recent_games(self, owner_id: int, opponent_id: int, limit: int = 5, offset: int = 0) -> list[RecentGame]:
        limit = require_positive_limit(limit, maximum=100)
        offset = require_non_negative_offset(offset)
        opponent = self.get_opponent(owner_id, opponent_id)

        if opponent.opponent_user_id is None:
            rows = self.connection.execute(
                """
                SELECT id, played_at, player_a_score, player_b_score
                FROM games
                WHERE owner_id = ? AND opponent_id = ?
                ORDER BY played_at DESC, id DESC
                LIMIT ?
                OFFSET ?
                """,
                (owner_id, opponent.id, limit, offset),
            ).fetchall()
            return [
                RecentGame(
                    played_at=row["played_at"],
                    own_score=int(row["player_a_score"]),
                    opponent_score=int(row["player_b_score"]),
                    game_id=int(row["id"]),
                )
                for row in rows
            ]

        rows = self.connection.execute(
            """
            SELECT
                g.id,
                g.player_a_id,
                g.player_b_id,
                g.player_a_score,
                g.player_b_score,
                g.played_at,
                e.rating_change AS elo_change
            FROM games g
            LEFT JOIN elo_events e ON e.game_id = g.id AND e.player_id = ?
            WHERE g.id > ? AND (
                (g.player_a_id = ? AND g.player_b_id = ?)
                OR
                (g.player_a_id = ? AND g.player_b_id = ?)
            )
            ORDER BY g.played_at DESC, g.id DESC
            LIMIT ?
            OFFSET ?
            """,
            (
                owner_id,
                opponent.history_start_game_id,
                owner_id,
                opponent.opponent_user_id,
                opponent.opponent_user_id,
                owner_id,
                limit,
                offset,
            ),
        ).fetchall()
        recent_games: list[RecentGame] = []
        for row in rows:
            if int(row["player_a_id"]) == owner_id:
                own_score = int(row["player_a_score"])
                opponent_score = int(row["player_b_score"])
            else:
                own_score = int(row["player_b_score"])
                opponent_score = int(row["player_a_score"])
            recent_games.append(
                RecentGame(
                    played_at=row["played_at"],
                    own_score=own_score,
                    opponent_score=opponent_score,
                    game_id=int(row["id"]),
                    elo_change=int(row["elo_change"]) if row["elo_change"] is not None else None,
                )
            )
        return recent_games

    def count_user_games(self, owner_id: int) -> int:
        row = self.connection.execute(
            """
            SELECT COUNT(*) AS games_count
            FROM (
                SELECT g.id
                FROM games g
                JOIN opponents o ON o.id = g.opponent_id AND o.owner_id = g.owner_id
                WHERE g.owner_id = ? AND o.is_hidden = FALSE

                UNION ALL

                SELECT g.id
                FROM games g
                JOIN opponents o
                  ON o.owner_id = ?
                 AND o.opponent_user_id = CASE
                    WHEN g.player_a_id = ? THEN g.player_b_id
                    ELSE g.player_a_id
                 END
                WHERE
                    o.is_hidden = FALSE
                    AND g.player_b_id IS NOT NULL
                    AND g.id > o.history_start_game_id
                    AND (g.player_a_id = ? OR g.player_b_id = ?)
            ) history
            """,
            (owner_id, owner_id, owner_id, owner_id, owner_id),
        ).fetchone()
        return int(row["games_count"])

    def get_user_game_history(self, owner_id: int, limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
        limit = require_positive_limit(limit, maximum=100)
        offset = require_non_negative_offset(offset)
        rows = self.connection.execute(
            """
            SELECT
                history.opponent_id,
                history.id,
                history.played_at,
                history.own_score,
                history.opponent_score,
                history.elo_change
            FROM (
                SELECT
                    o.id AS opponent_id,
                    g.id,
                    g.played_at,
                    g.player_a_score AS own_score,
                    g.player_b_score AS opponent_score,
                    NULL::INTEGER AS elo_change
                FROM games g
                JOIN opponents o ON o.id = g.opponent_id AND o.owner_id = g.owner_id
                WHERE g.owner_id = ? AND o.is_hidden = FALSE

                UNION ALL

                SELECT
                    o.id AS opponent_id,
                    g.id,
                    g.played_at,
                    CASE WHEN g.player_a_id = ? THEN g.player_a_score ELSE g.player_b_score END AS own_score,
                    CASE WHEN g.player_a_id = ? THEN g.player_b_score ELSE g.player_a_score END AS opponent_score,
                    e.rating_change AS elo_change
                FROM games g
                JOIN opponents o
                  ON o.owner_id = ?
                 AND o.opponent_user_id = CASE
                    WHEN g.player_a_id = ? THEN g.player_b_id
                    ELSE g.player_a_id
                 END
                LEFT JOIN elo_events e ON e.game_id = g.id AND e.player_id = ?
                WHERE
                    o.is_hidden = FALSE
                    AND g.player_b_id IS NOT NULL
                    AND g.id > o.history_start_game_id
                    AND (g.player_a_id = ? OR g.player_b_id = ?)
            ) history
            ORDER BY history.played_at DESC, history.id DESC
            LIMIT ?
            OFFSET ?
            """,
            (
                owner_id,
                owner_id,
                owner_id,
                owner_id,
                owner_id,
                owner_id,
                owner_id,
                owner_id,
                limit,
                offset,
            ),
        ).fetchall()
        return [
            {
                "opponent_id": int(row["opponent_id"]),
                "game_id": int(row["id"]),
                "played_at": str(row["played_at"]),
                "own_score": int(row["own_score"]),
                "opponent_score": int(row["opponent_score"]),
                "elo_change": int(row["elo_change"]) if row["elo_change"] is not None else None,
            }
            for row in rows
        ]

    def set_games_total(self, owner_id: int, opponent_id: int, wins: int, losses: int) -> None:
        with self.connection:
            self._set_games_total_for_one(owner_id, opponent_id, wins, losses)
            linked_opponent = self._get_linked_opponent(owner_id, opponent_id)
            if linked_opponent is not None:
                self._set_games_total_for_one(linked_opponent.owner_id, linked_opponent.id, losses, wins)

    def set_points_total(self, owner_id: int, opponent_id: int, points_for: int, points_against: int) -> None:
        with self.connection:
            self._set_points_total_for_one(owner_id, opponent_id, points_for, points_against)
            linked_opponent = self._get_linked_opponent(owner_id, opponent_id)
            if linked_opponent is not None:
                self._set_points_total_for_one(linked_opponent.owner_id, linked_opponent.id, points_against, points_for)

    def _set_games_total_for_one(self, owner_id: int, opponent_id: int, wins: int, losses: int) -> None:
        raw = self.get_opponent_stats(owner_id, opponent_id, adjusted=False)
        adjustment = self._get_adjustment(owner_id, opponent_id)
        self._upsert_adjustment(
            owner_id=owner_id,
            opponent_id=opponent_id,
            games_won_delta=wins - raw.wins,
            games_lost_delta=losses - raw.losses,
            points_for_delta=adjustment["points_for_delta"],
            points_against_delta=adjustment["points_against_delta"],
            games_updated_at=now_moscow_iso(),
            points_updated_at=adjustment["points_updated_at"],
        )

    def _set_points_total_for_one(self, owner_id: int, opponent_id: int, points_for: int, points_against: int) -> None:
        raw = self.get_opponent_stats(owner_id, opponent_id, adjusted=False)
        adjustment = self._get_adjustment(owner_id, opponent_id)
        self._upsert_adjustment(
            owner_id=owner_id,
            opponent_id=opponent_id,
            games_won_delta=adjustment["games_won_delta"],
            games_lost_delta=adjustment["games_lost_delta"],
            points_for_delta=points_for - raw.points_for,
            points_against_delta=points_against - raw.points_against,
            games_updated_at=adjustment["games_updated_at"],
            points_updated_at=now_moscow_iso(),
        )

    def set_session(self, owner_id: int, mode: str, opponent_id: Optional[int]) -> None:
        if mode not in KNOWN_SESSION_MODES:
            raise ValueError("Недопустимый режим сессии.")
        self.connection.execute(
            """
            INSERT INTO sessions (owner_id, mode, opponent_id, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(owner_id) DO UPDATE SET
                mode = excluded.mode,
                opponent_id = excluded.opponent_id,
                updated_at = excluded.updated_at
            """,
            (owner_id, mode, opponent_id, now_moscow_iso()),
        )
        self.connection.commit()

    def get_session(self, owner_id: int) -> Optional[Session]:
        row = self.connection.execute(
            "SELECT mode, opponent_id FROM sessions WHERE owner_id = ?",
            (owner_id,),
        ).fetchone()
        if row is None:
            return None
        return Session(mode=row["mode"], opponent_id=row["opponent_id"])

    def clear_session(self, owner_id: int) -> None:
        self.connection.execute("DELETE FROM sessions WHERE owner_id = ?", (owner_id,))
        self.connection.commit()

    def _raw_stats_for_opponent(self, owner_id: int, opponent: Opponent) -> Stats:
        wins = 0
        losses = 0
        points_for = 0
        points_against = 0

        if opponent.opponent_user_id is None:
            rows = self.connection.execute(
                """
                SELECT player_a_score, player_b_score
                FROM games
                WHERE owner_id = ? AND opponent_id = ?
                """,
                (owner_id, opponent.id),
            ).fetchall()
            for row in rows:
                own_score = int(row["player_a_score"])
                opponent_score = int(row["player_b_score"])
                points_for += own_score
                points_against += opponent_score
                if own_score > opponent_score:
                    wins += 1
                else:
                    losses += 1
            return Stats(wins=wins, losses=losses, points_for=points_for, points_against=points_against)

        rows = self.connection.execute(
            """
            SELECT player_a_id, player_b_id, player_a_score, player_b_score
            FROM games
            WHERE id > ? AND (
                (player_a_id = ? AND player_b_id = ?)
                OR
                (player_a_id = ? AND player_b_id = ?)
            )
            """,
            (
                opponent.history_start_game_id,
                owner_id,
                opponent.opponent_user_id,
                opponent.opponent_user_id,
                owner_id,
            ),
        ).fetchall()
        for row in rows:
            if int(row["player_a_id"]) == owner_id:
                own_score = int(row["player_a_score"])
                opponent_score = int(row["player_b_score"])
            else:
                own_score = int(row["player_b_score"])
                opponent_score = int(row["player_a_score"])

            points_for += own_score
            points_against += opponent_score
            if own_score > opponent_score:
                wins += 1
            else:
                losses += 1

        return Stats(wins=wins, losses=losses, points_for=points_for, points_against=points_against)

    def _game_rows_for_opponent(self, owner_id: int, opponent: Opponent) -> list[dict[str, Any]]:
        if opponent.opponent_user_id is None:
            rows = self.connection.execute(
                """
                SELECT
                    id,
                    played_at,
                    player_a_score,
                    player_b_score,
                    overtime_a,
                    overtime_b
                FROM games
                WHERE owner_id = ? AND opponent_id = ?
                ORDER BY played_at DESC, id DESC
                """,
                (owner_id, opponent.id),
            ).fetchall()
            return [
                {
                    "id": int(row["id"]),
                    "played_at": row["played_at"],
                    "own_score": int(row["player_a_score"]),
                    "opponent_score": int(row["player_b_score"]),
                    "is_overtime": bool(int(row["overtime_a"]) or int(row["overtime_b"])),
                }
                for row in rows
            ]

        rows = self.connection.execute(
            """
            SELECT
                id,
                player_a_id,
                player_b_id,
                player_a_score,
                player_b_score,
                overtime_a,
                overtime_b,
                played_at
            FROM games
            WHERE id > ? AND (
                (player_a_id = ? AND player_b_id = ?)
                OR
                (player_a_id = ? AND player_b_id = ?)
            )
            ORDER BY played_at DESC, id DESC
            """,
            (
                opponent.history_start_game_id,
                owner_id,
                opponent.opponent_user_id,
                opponent.opponent_user_id,
                owner_id,
            ),
        ).fetchall()
        game_rows: list[dict[str, Any]] = []
        for row in rows:
            if int(row["player_a_id"]) == owner_id:
                own_score = int(row["player_a_score"])
                opponent_score = int(row["player_b_score"])
                overtime_own = int(row["overtime_a"])
                overtime_opponent = int(row["overtime_b"])
            else:
                own_score = int(row["player_b_score"])
                opponent_score = int(row["player_a_score"])
                overtime_own = int(row["overtime_b"])
                overtime_opponent = int(row["overtime_a"])

            game_rows.append(
                {
                    "id": int(row["id"]),
                    "played_at": row["played_at"],
                    "own_score": own_score,
                    "opponent_score": opponent_score,
                    "is_overtime": bool(overtime_own or overtime_opponent),
                }
            )
        return game_rows

    def _get_adjustment(self, owner_id: int, opponent_id: int) -> dict[str, int]:
        row = self.connection.execute(
            """
            SELECT
                games_won_delta,
                games_lost_delta,
                points_for_delta,
                points_against_delta,
                games_updated_at,
                points_updated_at
            FROM aggregate_adjustments
            WHERE owner_id = ? AND opponent_id = ?
            """,
            (owner_id, opponent_id),
        ).fetchone()
        if row is None:
            return {
                "games_won_delta": 0,
                "games_lost_delta": 0,
                "points_for_delta": 0,
                "points_against_delta": 0,
                "games_updated_at": None,
                "points_updated_at": None,
            }
        return {
            "games_won_delta": int(row["games_won_delta"]),
            "games_lost_delta": int(row["games_lost_delta"]),
            "points_for_delta": int(row["points_for_delta"]),
            "points_against_delta": int(row["points_against_delta"]),
            "games_updated_at": row["games_updated_at"],
            "points_updated_at": row["points_updated_at"],
        }

    def _delete_adjustment(self, owner_id: int, opponent_id: int) -> None:
        self.connection.execute(
            """
            DELETE FROM aggregate_adjustments
            WHERE owner_id = ? AND opponent_id = ?
            """,
            (owner_id, opponent_id),
        )

    def _reset_linked_stats_for_owner(self, opponent: Opponent) -> bool:
        if opponent.opponent_user_id is None:
            raise ValueError("Для локального соперника нужен локальный сброс.")

        linked_opponent = self._get_linked_opponent(opponent.owner_id, opponent.id)
        cutoff = self._max_linked_game_id(opponent.owner_id, opponent.opponent_user_id)
        self.connection.execute(
            """
            UPDATE opponents
            SET history_start_game_id = ?
            WHERE owner_id = ? AND id = ?
            """,
            (cutoff, opponent.owner_id, opponent.id),
        )
        self._delete_adjustment(opponent.owner_id, opponent.id)

        if linked_opponent is not None and self._opponent_has_retained_stats(linked_opponent):
            return False

        deleted = self.connection.execute(
            """
            DELETE FROM games
            WHERE
                (player_a_id = ? AND player_b_id = ?)
                OR
                (player_a_id = ? AND player_b_id = ?)
            """,
            (
                opponent.owner_id,
                opponent.opponent_user_id,
                opponent.opponent_user_id,
                opponent.owner_id,
            ),
        ).rowcount > 0
        self.connection.execute(
            "UPDATE opponents SET history_start_game_id = 0 WHERE owner_id = ? AND id = ?",
            (opponent.owner_id, opponent.id),
        )
        if linked_opponent is not None:
            self._delete_adjustment(linked_opponent.owner_id, linked_opponent.id)
            self.connection.execute(
                "UPDATE opponents SET history_start_game_id = 0 WHERE owner_id = ? AND id = ?",
                (linked_opponent.owner_id, linked_opponent.id),
            )
        return deleted

    def _prepare_linked_pair_for_game(self, opponent: Opponent) -> None:
        linked_opponent = self._get_linked_opponent(opponent.owner_id, opponent.id)
        if linked_opponent is None:
            return

        current_has_stats = self._opponent_has_retained_stats(opponent)
        linked_has_stats = self._opponent_has_retained_stats(linked_opponent)

        if current_has_stats and not linked_has_stats:
            self._restore_opponent_from_source(linked_opponent, opponent)
        elif linked_has_stats and not current_has_stats:
            self._restore_opponent_from_source(opponent, linked_opponent)
        elif current_has_stats and linked_has_stats:
            source, target = (
                (opponent, linked_opponent)
                if opponent.history_start_game_id <= linked_opponent.history_start_game_id
                else (linked_opponent, opponent)
            )
            if source.history_start_game_id != target.history_start_game_id or target.is_hidden:
                self._restore_opponent_from_source(target, source)
        else:
            self.connection.execute(
                """
                UPDATE opponents
                SET history_start_game_id = 0, is_hidden = FALSE
                WHERE id IN (?, ?)
                """,
                (opponent.id, linked_opponent.id),
            )
            self._delete_adjustment(opponent.owner_id, opponent.id)
            self._delete_adjustment(linked_opponent.owner_id, linked_opponent.id)

        self.connection.execute(
            "UPDATE opponents SET is_hidden = FALSE WHERE id IN (?, ?)",
            (opponent.id, linked_opponent.id),
        )

    def _restore_opponent_from_source(self, target: Opponent, source: Opponent) -> None:
        self.connection.execute(
            """
            UPDATE opponents
            SET history_start_game_id = ?, is_hidden = FALSE
            WHERE owner_id = ? AND id = ?
            """,
            (source.history_start_game_id, target.owner_id, target.id),
        )
        adjustment = self._get_adjustment(source.owner_id, source.id)
        if all(
            adjustment[key] == 0
            for key in (
                "games_won_delta",
                "games_lost_delta",
                "points_for_delta",
                "points_against_delta",
            )
        ):
            self._delete_adjustment(target.owner_id, target.id)
            return
        self._upsert_adjustment(
            owner_id=target.owner_id,
            opponent_id=target.id,
            games_won_delta=adjustment["games_lost_delta"],
            games_lost_delta=adjustment["games_won_delta"],
            points_for_delta=adjustment["points_against_delta"],
            points_against_delta=adjustment["points_for_delta"],
            games_updated_at=adjustment["games_updated_at"],
            points_updated_at=adjustment["points_updated_at"],
        )

    def _opponent_has_retained_stats(self, opponent: Opponent) -> bool:
        if opponent.is_hidden:
            return False
        if opponent.opponent_user_id is None:
            return self.count_opponent_games(opponent.owner_id, opponent.id) > 0
        row = self.connection.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM games
                WHERE id > ? AND (
                    (player_a_id = ? AND player_b_id = ?)
                    OR
                    (player_a_id = ? AND player_b_id = ?)
                )
            ) AS has_games
            """,
            (
                opponent.history_start_game_id,
                opponent.owner_id,
                opponent.opponent_user_id,
                opponent.opponent_user_id,
                opponent.owner_id,
            ),
        ).fetchone()
        if bool(row["has_games"]):
            return True
        adjustment = self._get_adjustment(opponent.owner_id, opponent.id)
        return any(
            adjustment[key] != 0
            for key in (
                "games_won_delta",
                "games_lost_delta",
                "points_for_delta",
                "points_against_delta",
            )
        )

    def _max_linked_game_id(self, player_a_id: int, player_b_id: int) -> int:
        row = self.connection.execute(
            """
            SELECT COALESCE(MAX(id), 0) AS game_id
            FROM games
            WHERE
                (player_a_id = ? AND player_b_id = ?)
                OR
                (player_a_id = ? AND player_b_id = ?)
            """,
            (player_a_id, player_b_id, player_b_id, player_a_id),
        ).fetchone()
        return int(row["game_id"])

    def _lock_linked_ratings(self, player_a_id: int, player_b_id: int) -> dict[int, tuple[int, int]]:
        rows = self.connection.execute(
            """
            SELECT telegram_id, elo_rating, elo_games
            FROM users
            WHERE telegram_id IN (?, ?)
            ORDER BY telegram_id
            FOR UPDATE
            """,
            (player_a_id, player_b_id),
        ).fetchall()
        ratings = {
            int(row["telegram_id"]): (int(row["elo_rating"]), int(row["elo_games"]))
            for row in rows
        }
        if set(ratings) != {player_a_id, player_b_id}:
            raise LookupError("Игрок не найден.")
        return ratings

    def _append_linked_elo_events(
        self,
        game_id: int,
        player_a_id: int,
        player_b_id: int,
        score: ParsedScore,
        played_at: str,
        locked_ratings: dict[int, tuple[int, int]],
    ) -> None:
        player_a_rating, player_a_games = locked_ratings[player_a_id]
        player_b_rating, player_b_games = locked_ratings[player_b_id]
        rating_change = calculate_rating_change(
            player_a_rating,
            player_b_rating,
            player_a_games,
            player_b_games,
            player_a_won=score.own_score > score.opponent_score,
        )
        player_a_after = player_a_rating + rating_change
        player_b_after = player_b_rating - rating_change
        self.connection.execute(
            "UPDATE users SET elo_rating = ?, elo_games = ? WHERE telegram_id = ?",
            (player_a_after, player_a_games + 1, player_a_id),
        )
        self.connection.execute(
            "UPDATE users SET elo_rating = ?, elo_games = ? WHERE telegram_id = ?",
            (player_b_after, player_b_games + 1, player_b_id),
        )
        self._insert_elo_event(
            EloEvent(
                game_id=game_id,
                player_id=player_a_id,
                opponent_id=player_b_id,
                rating_before=player_a_rating,
                rating_change=rating_change,
                rating_after=player_a_after,
                played_at=played_at,
            )
        )
        self._insert_elo_event(
            EloEvent(
                game_id=game_id,
                player_id=player_b_id,
                opponent_id=player_a_id,
                rating_before=player_b_rating,
                rating_change=-rating_change,
                rating_after=player_b_after,
                played_at=played_at,
            )
        )

    def _get_linked_opponent(self, owner_id: int, opponent_id: int) -> Optional[Opponent]:
        opponent = self._get_opponent_record(owner_id, opponent_id, include_hidden=True)
        if opponent.opponent_user_id is None:
            return None

        row = self.connection.execute(
            """
            SELECT id FROM opponents
            WHERE owner_id = ? AND opponent_user_id = ?
            """,
            (opponent.opponent_user_id, owner_id),
        ).fetchone()
        if row is None:
            return None
        return self._get_opponent_record(opponent.opponent_user_id, int(row["id"]), include_hidden=True)

    def _upsert_adjustment(
        self,
        owner_id: int,
        opponent_id: int,
        games_won_delta: int,
        games_lost_delta: int,
        points_for_delta: int,
        points_against_delta: int,
        games_updated_at: Optional[str],
        points_updated_at: Optional[str],
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO aggregate_adjustments (
                owner_id, opponent_id, games_won_delta, games_lost_delta,
                points_for_delta, points_against_delta, updated_at,
                games_updated_at, points_updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(owner_id, opponent_id) DO UPDATE SET
                games_won_delta = excluded.games_won_delta,
                games_lost_delta = excluded.games_lost_delta,
                points_for_delta = excluded.points_for_delta,
                points_against_delta = excluded.points_against_delta,
                updated_at = excluded.updated_at,
                games_updated_at = excluded.games_updated_at,
                points_updated_at = excluded.points_updated_at
            """,
            (
                owner_id,
                opponent_id,
                games_won_delta,
                games_lost_delta,
                points_for_delta,
                points_against_delta,
                now_moscow_iso(),
                games_updated_at,
                points_updated_at,
            ),
        )

    def _has_linked_opponent(self, owner_id: int, opponent_user_id: int) -> bool:
        row = self.connection.execute(
            """
            SELECT 1 FROM opponents
            WHERE owner_id = ? AND opponent_user_id = ? AND is_hidden = FALSE
            """,
            (owner_id, opponent_user_id),
        ).fetchone()
        return row is not None

    def _unique_opponent_name(self, owner_id: int, name: str) -> str:
        candidate = name
        counter = 2
        while self.connection.execute(
            """
            SELECT 1 FROM opponents
            WHERE owner_id = ? AND name = ?
            """,
            (owner_id, candidate),
        ).fetchone():
            candidate = f"{name} ({counter})"
            counter += 1
        return candidate

    def _generate_unique_invite_code(self) -> str:
        while True:
            invite_code = "".join(secrets.choice(INVITE_CODE_ALPHABET) for _ in range(INVITE_CODE_LENGTH))
            row = self.connection.execute(
                "SELECT 1 FROM users WHERE invite_code = ?",
                (invite_code,),
            ).fetchone()
            if row is None:
                return invite_code


def now_moscow_iso() -> str:
    return datetime.now(MOSCOW_TZ).isoformat(timespec="seconds")


def normalize_invite_code(invite_code: str) -> str:
    return invite_code.strip().replace(" ", "").upper()


def require_positive_limit(limit: int, maximum: int) -> int:
    if limit < 1:
        raise ValueError("Лимит должен быть положительным.")
    return min(limit, maximum)


def require_non_negative_offset(offset: int) -> int:
    if offset < 0:
        raise ValueError("Смещение не может быть отрицательным.")
    return offset


def add_daily_result(daily: dict[str, tuple[int, int]], played_at: str, own_score: int, opponent_score: int) -> None:
    played_on = played_at[:10]
    wins, losses = daily.get(played_on, (0, 0))
    if own_score > opponent_score:
        wins += 1
    else:
        losses += 1
    daily[played_on] = (wins, losses)


def add_daily_delta(
    daily: dict[str, tuple[int, int]],
    played_at: Optional[str],
    wins_delta: int,
    losses_delta: int,
) -> None:
    if played_at is None or (wins_delta == 0 and losses_delta == 0):
        return

    played_on = played_at[:10]
    wins, losses = daily.get(played_on, (0, 0))
    daily[played_on] = (wins + wins_delta, losses + losses_delta)
