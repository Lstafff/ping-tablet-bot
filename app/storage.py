from __future__ import annotations

import secrets
import string
from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

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
from app.scoring import ParsedScore
from app.states import KNOWN_SESSION_MODES


MOSCOW_TZ = ZoneInfo("Europe/Moscow")
INVITE_CODE_ALPHABET = string.ascii_uppercase + string.digits
INVITE_CODE_LENGTH = 8
ALLOWED_SCHEMA_NAMES = {
    "aggregate_adjustments",
    "games",
    "games_updated_at",
    "invite_code",
    "invite_uses",
    "opponents",
    "points_updated_at",
    "rating",
    "rating_is_fnt",
    "users",
}


class PostgresConnection:
    def __init__(self, database_url: str) -> None:
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as error:
            raise RuntimeError(
                "Для подключения к Postgres нужно установить зависимость psycopg[binary]."
            ) from error

        self._connection = psycopg.connect(database_url, row_factory=dict_row, connect_timeout=10)

    def execute(self, query: str, parameters: tuple[Any, ...] = ()) -> Any:
        return self._connection.execute(self._prepare_query(query), parameters)

    def executescript(self, script: str) -> None:
        for statement in script.split(";"):
            statement = statement.strip()
            if statement:
                self.execute(statement)

    def commit(self) -> None:
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()

    def __enter__(self) -> PostgresConnection:
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        if exc_type is None:
            self._connection.commit()
        else:
            self._connection.rollback()

    @staticmethod
    def _prepare_query(query: str) -> str:
        return query.replace("?", "%s")


class Database:
    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise RuntimeError("Нужно задать DATABASE_URL для подключения к Postgres.")
        self.database_url = database_url
        self.connection = PostgresConnection(database_url)
        self._migrate()

    def _migrate(self) -> None:
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                telegram_id BIGINT PRIMARY KEY,
                first_name TEXT NOT NULL,
                username TEXT,
                last_message_id BIGINT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                invite_code TEXT,
                rating TEXT,
                rating_is_fnt INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS opponents (
                id BIGSERIAL PRIMARY KEY,
                owner_id BIGINT NOT NULL,
                opponent_user_id BIGINT,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(owner_id, opponent_user_id),
                UNIQUE(owner_id, name),
                FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS games (
                id BIGSERIAL PRIMARY KEY,
                created_by_id BIGINT NOT NULL,
                owner_id BIGINT,
                opponent_id BIGINT,
                player_a_id BIGINT NOT NULL,
                player_b_id BIGINT,
                player_a_score INTEGER NOT NULL,
                player_b_score INTEGER NOT NULL,
                regular_a INTEGER NOT NULL,
                regular_b INTEGER NOT NULL,
                overtime_a INTEGER NOT NULL,
                overtime_b INTEGER NOT NULL,
                played_at TEXT NOT NULL,
                FOREIGN KEY(created_by_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
                FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
                FOREIGN KEY(opponent_id) REFERENCES opponents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS aggregate_adjustments (
                owner_id BIGINT NOT NULL,
                opponent_id BIGINT NOT NULL,
                games_won_delta INTEGER NOT NULL DEFAULT 0,
                games_lost_delta INTEGER NOT NULL DEFAULT 0,
                points_for_delta INTEGER NOT NULL DEFAULT 0,
                points_against_delta INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                games_updated_at TEXT,
                points_updated_at TEXT,
                PRIMARY KEY(owner_id, opponent_id),
                FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
                FOREIGN KEY(opponent_id) REFERENCES opponents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sessions (
                owner_id BIGINT PRIMARY KEY,
                mode TEXT NOT NULL,
                opponent_id BIGINT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
                FOREIGN KEY(opponent_id) REFERENCES opponents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS invite_uses (
                inviter_id BIGINT NOT NULL,
                invited_user_id BIGINT NOT NULL,
                invite_code TEXT NOT NULL,
                accepted_at TEXT NOT NULL,
                PRIMARY KEY(inviter_id, invited_user_id),
                FOREIGN KEY(inviter_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
                FOREIGN KEY(invited_user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
            );
            """
        )
        self._ensure_column("users", "invite_code", "TEXT")
        self._ensure_column("users", "rating", "TEXT")
        self._ensure_column("users", "rating_is_fnt", "INTEGER NOT NULL DEFAULT 0")
        self._ensure_column("aggregate_adjustments", "games_updated_at", "TEXT")
        self._ensure_column("aggregate_adjustments", "points_updated_at", "TEXT")
        self._backfill_adjustment_dates()
        self._ensure_indexes()
        self.connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code
            ON users(invite_code)
            WHERE invite_code IS NOT NULL
            """
        )
        self.connection.commit()

    def close(self) -> None:
        self.connection.close()

    def _ensure_indexes(self) -> None:
        for statement in (
            """
            CREATE INDEX IF NOT EXISTS idx_opponents_owner_name
            ON opponents(owner_id, lower(name))
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_opponents_owner_user
            ON opponents(owner_id, opponent_user_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_games_unlinked_opponent_history
            ON games(owner_id, opponent_id, played_at DESC, id DESC)
            WHERE owner_id IS NOT NULL AND opponent_id IS NOT NULL
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_games_linked_players_history
            ON games(player_a_id, player_b_id, played_at DESC, id DESC)
            WHERE player_b_id IS NOT NULL
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_invite_uses_inviter
            ON invite_uses(inviter_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
            ON sessions(updated_at)
            """,
        ):
            self.connection.execute(statement)

    def _backfill_adjustment_dates(self) -> None:
        self.connection.execute(
            """
            UPDATE aggregate_adjustments
            SET games_updated_at = updated_at
            WHERE games_updated_at IS NULL
            """
        )
        self.connection.execute(
            """
            UPDATE aggregate_adjustments
            SET points_updated_at = updated_at
            WHERE points_updated_at IS NULL
            """
        )

    def _ensure_column(self, table: str, column: str, definition: str) -> None:
        table = require_schema_name(table)
        column = require_schema_name(column)
        columns = {
            row["column_name"]
            for row in self.connection.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
                """,
                (table, column),
            ).fetchall()
        }
        if column not in columns:
            self.connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

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
            SELECT telegram_id, first_name, username, last_message_id, created_at, rating, rating_is_fnt
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
        )

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
                return self.get_opponent(owner_id, int(row["id"]))
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
                u.username
            FROM opponents o
            LEFT JOIN users u ON u.telegram_id = o.opponent_user_id
            WHERE o.owner_id = ?
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
            )
            for row in rows
        ]

    def get_opponent(self, owner_id: int, opponent_id: int) -> Opponent:
        row = self.connection.execute(
            """
            SELECT
                o.id,
                o.owner_id,
                o.name,
                o.opponent_user_id,
                u.first_name,
                u.username
            FROM opponents o
            LEFT JOIN users u ON u.telegram_id = o.opponent_user_id
            WHERE o.owner_id = ? AND o.id = ?
            """,
            (owner_id, opponent_id),
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
        )

    def delete_opponent(self, owner_id: int, opponent_id: int) -> None:
        opponent = self.get_opponent(owner_id, opponent_id)
        linked_opponent = self._get_linked_opponent(owner_id, opponent_id)
        with self.connection:
            self._reset_stats_for_opponent(owner_id, opponent_id, opponent, linked_opponent)

            self.connection.execute(
                """
                DELETE FROM opponents
                WHERE owner_id = ? AND id = ?
                """,
                (owner_id, opponent_id),
            )

    def reset_opponent_stats(self, owner_id: int, opponent_id: int) -> None:
        opponent = self.get_opponent(owner_id, opponent_id)
        linked_opponent = self._get_linked_opponent(owner_id, opponent_id)
        with self.connection:
            self._reset_stats_for_opponent(owner_id, opponent_id, opponent, linked_opponent)

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

    def add_game(self, owner_id: int, opponent_id: int, score: ParsedScore) -> int:
        opponent = self.get_opponent(owner_id, opponent_id)
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
                overtime_a, overtime_b, played_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            """

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
            ),
        )
        row = cursor.fetchone()
        self.connection.commit()
        return int(row["id"])

    def delete_game(self, owner_id: int, opponent_id: int, game_id: int) -> bool:
        opponent = self.get_opponent(owner_id, opponent_id)
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

        self.connection.commit()
        return cursor.rowcount > 0

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
                WHERE
                    (player_a_id = ? AND player_b_id = ?)
                    OR
                    (player_a_id = ? AND player_b_id = ?)
                ORDER BY played_at DESC
                """,
                (owner_id, opponent.opponent_user_id, opponent.opponent_user_id, owner_id),
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
            WHERE
                (player_a_id = ? AND player_b_id = ?)
                OR
                (player_a_id = ? AND player_b_id = ?)
            """,
            (owner_id, opponent.opponent_user_id, opponent.opponent_user_id, owner_id),
        ).fetchone()
        return int(row["games_count"])

    def get_recent_games(self, owner_id: int, opponent_id: int, limit: int = 5, offset: int = 0) -> list[RecentGame]:
        limit = require_positive_limit(limit, maximum=100)
        offset = require_non_negative_offset(offset)
        opponent = self.get_opponent(owner_id, opponent_id)

        if opponent.opponent_user_id is None:
            rows = self.connection.execute(
                """
                SELECT played_at, player_a_score, player_b_score
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
                )
                for row in rows
            ]

        rows = self.connection.execute(
            """
            SELECT player_a_id, player_b_id, player_a_score, player_b_score, played_at
            FROM games
            WHERE
                (player_a_id = ? AND player_b_id = ?)
                OR
                (player_a_id = ? AND player_b_id = ?)
            ORDER BY played_at DESC, id DESC
            LIMIT ?
            OFFSET ?
            """,
            (owner_id, opponent.opponent_user_id, opponent.opponent_user_id, owner_id, limit, offset),
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
                )
            )
        return recent_games

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
            WHERE
                (player_a_id = ? AND player_b_id = ?)
                OR
                (player_a_id = ? AND player_b_id = ?)
            """,
            (owner_id, opponent.opponent_user_id, opponent.opponent_user_id, owner_id),
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
            WHERE
                (player_a_id = ? AND player_b_id = ?)
                OR
                (player_a_id = ? AND player_b_id = ?)
            ORDER BY played_at DESC, id DESC
            """,
            (owner_id, opponent.opponent_user_id, opponent.opponent_user_id, owner_id),
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

    def _reset_stats_for_opponent(
        self,
        owner_id: int,
        opponent_id: int,
        opponent: Opponent,
        linked_opponent: Optional[Opponent],
    ) -> None:
        if opponent.opponent_user_id is None:
            self.connection.execute(
                """
                DELETE FROM games
                WHERE owner_id = ? AND opponent_id = ?
                """,
                (owner_id, opponent_id),
            )
        else:
            self.connection.execute(
                """
                DELETE FROM games
                WHERE
                    (player_a_id = ? AND player_b_id = ?)
                    OR
                    (player_a_id = ? AND player_b_id = ?)
                """,
                (owner_id, opponent.opponent_user_id, opponent.opponent_user_id, owner_id),
            )

        self._delete_adjustment(owner_id, opponent_id)
        if linked_opponent is not None:
            self._delete_adjustment(linked_opponent.owner_id, linked_opponent.id)

    def _get_linked_opponent(self, owner_id: int, opponent_id: int) -> Optional[Opponent]:
        opponent = self.get_opponent(owner_id, opponent_id)
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
        return self.get_opponent(opponent.opponent_user_id, int(row["id"]))

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
            WHERE owner_id = ? AND opponent_user_id = ?
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


def require_schema_name(name: str) -> str:
    if name not in ALLOWED_SCHEMA_NAMES:
        raise ValueError("Недопустимое имя таблицы или колонки.")
    return name


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
