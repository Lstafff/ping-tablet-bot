from __future__ import annotations

import secrets
import sqlite3
import string
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

from app import texts
from app.scoring import ParsedScore


MOSCOW_TZ = ZoneInfo("Europe/Moscow")
INVITE_CODE_ALPHABET = string.ascii_uppercase + string.digits
INVITE_CODE_LENGTH = 8


@dataclass(frozen=True)
class User:
    telegram_id: int
    first_name: str
    username: Optional[str]
    last_message_id: Optional[int]


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
class Session:
    mode: str
    opponent_id: Optional[int]


@dataclass(frozen=True)
class InviteAcceptance:
    inviter_id: int
    is_self_invite: bool
    is_new_opponent: bool


class Database:
    def __init__(self, path: str) -> None:
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys = ON")
        self._migrate()

    def _migrate(self) -> None:
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                telegram_id INTEGER PRIMARY KEY,
                first_name TEXT NOT NULL,
                username TEXT,
                last_message_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS opponents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL,
                opponent_user_id INTEGER,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(owner_id, opponent_user_id),
                UNIQUE(owner_id, name),
                FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_by_id INTEGER NOT NULL,
                owner_id INTEGER,
                opponent_id INTEGER,
                player_a_id INTEGER NOT NULL,
                player_b_id INTEGER,
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
                owner_id INTEGER NOT NULL,
                opponent_id INTEGER NOT NULL,
                games_won_delta INTEGER NOT NULL DEFAULT 0,
                games_lost_delta INTEGER NOT NULL DEFAULT 0,
                points_for_delta INTEGER NOT NULL DEFAULT 0,
                points_against_delta INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(owner_id, opponent_id),
                FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
                FOREIGN KEY(opponent_id) REFERENCES opponents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sessions (
                owner_id INTEGER PRIMARY KEY,
                mode TEXT NOT NULL,
                opponent_id INTEGER,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
                FOREIGN KEY(opponent_id) REFERENCES opponents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS invites (
                token TEXT PRIMARY KEY,
                inviter_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                used_by INTEGER,
                used_at TEXT,
                FOREIGN KEY(inviter_id) REFERENCES users(telegram_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS invite_uses (
                inviter_id INTEGER NOT NULL,
                invited_user_id INTEGER NOT NULL,
                invite_code TEXT NOT NULL,
                accepted_at TEXT NOT NULL,
                PRIMARY KEY(inviter_id, invited_user_id),
                FOREIGN KEY(inviter_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
                FOREIGN KEY(invited_user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
            );
            """
        )
        self._ensure_column("users", "invite_code", "TEXT")
        self.connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code
            ON users(invite_code)
            WHERE invite_code IS NOT NULL
            """
        )
        self.connection.commit()

    def _ensure_column(self, table: str, column: str, definition: str) -> None:
        columns = {
            row["name"]
            for row in self.connection.execute(f"PRAGMA table_info({table})").fetchall()
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
            (telegram_id, first_name or texts.DEFAULT_USER_NAME, username, now, now),
        )
        self.connection.commit()
        return self.get_user(telegram_id)

    def get_user(self, telegram_id: int) -> User:
        row = self.connection.execute(
            "SELECT telegram_id, first_name, username, last_message_id FROM users WHERE telegram_id = ?",
            (telegram_id,),
        ).fetchone()
        if row is None:
            raise LookupError("Пользователь не найден.")
        return User(
            telegram_id=row["telegram_id"],
            first_name=row["first_name"],
            username=row["username"],
            last_message_id=row["last_message_id"],
        )

    def set_last_message_id(self, telegram_id: int, message_id: int) -> None:
        self.connection.execute(
            "UPDATE users SET last_message_id = ?, updated_at = ? WHERE telegram_id = ?",
            (message_id, now_moscow_iso(), telegram_id),
        )
        self.connection.commit()

    def ensure_test_opponent(self, owner_id: int) -> None:
        if self.list_opponents(owner_id):
            return
        self.add_opponent(owner_id=owner_id, name=texts.TEST_OPPONENT_NAME, opponent_user_id=None)

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
            INSERT OR IGNORE INTO opponents (owner_id, opponent_user_id, name, created_at)
            VALUES (?, ?, ?, ?)
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

            self.connection.execute(
                """
                DELETE FROM opponents
                WHERE owner_id = ? AND id = ?
                """,
                (owner_id, opponent_id),
            )

    def create_invite(self, inviter_id: int) -> str:
        return self.get_or_create_invite_code(inviter_id)

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
            row = self.connection.execute(
                """
                SELECT inviter_id
                FROM invites
                WHERE token = ?
                """,
                (invite_code,),
            ).fetchone()
            if row is None:
                return None

        inviter_id = int(row["inviter_id"])
        if inviter_id == invited_user_id:
            return InviteAcceptance(inviter_id=inviter_id, is_self_invite=True, is_new_opponent=False)

        inviter = self.get_user(inviter_id)
        invited = self.get_user(invited_user_id)
        invited_name = texts.display_user_name(invited.first_name, invited.username)
        inviter_name = texts.display_user_name(inviter.first_name, inviter.username)
        already_linked = self._has_linked_opponent(inviter_id, invited_user_id)

        self.add_opponent(inviter_id, invited_name, invited_user_id)
        self.add_opponent(invited_user_id, inviter_name, inviter_id)
        with self.connection:
            self.connection.execute(
                """
                INSERT OR IGNORE INTO invite_uses (
                    inviter_id, invited_user_id, invite_code, accepted_at
                )
                VALUES (?, ?, ?, ?)
                """,
                (inviter_id, invited_user_id, normalized_invite_code or invite_code, now_moscow_iso()),
            )
            self.connection.execute(
                """
                UPDATE invites
                SET used_by = ?, used_at = ?
                WHERE token = ?
                """,
                (invited_user_id, now_moscow_iso(), invite_code),
            )
        return InviteAcceptance(inviter_id=inviter_id, is_self_invite=False, is_new_opponent=not already_linked)

    def get_invite_referral_count(self, inviter_id: int) -> int:
        row = self.connection.execute(
            "SELECT COUNT(*) AS referral_count FROM invite_uses WHERE inviter_id = ?",
            (inviter_id,),
        ).fetchone()
        return int(row["referral_count"])

    def add_game(self, owner_id: int, opponent_id: int, score: ParsedScore) -> None:
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

        self.connection.execute(
            """
            INSERT INTO games (
                created_by_id, owner_id, opponent_id, player_a_id, player_b_id,
                player_a_score, player_b_score, regular_a, regular_b,
                overtime_a, overtime_b, played_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
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
        self.connection.commit()

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
        )

    def set_session(self, owner_id: int, mode: str, opponent_id: Optional[int]) -> None:
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

    def _get_adjustment(self, owner_id: int, opponent_id: int) -> dict[str, int]:
        row = self.connection.execute(
            """
            SELECT games_won_delta, games_lost_delta, points_for_delta, points_against_delta
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
            }
        return {
            "games_won_delta": int(row["games_won_delta"]),
            "games_lost_delta": int(row["games_lost_delta"]),
            "points_for_delta": int(row["points_for_delta"]),
            "points_against_delta": int(row["points_against_delta"]),
        }

    def _delete_adjustment(self, owner_id: int, opponent_id: int) -> None:
        self.connection.execute(
            """
            DELETE FROM aggregate_adjustments
            WHERE owner_id = ? AND opponent_id = ?
            """,
            (owner_id, opponent_id),
        )

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
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO aggregate_adjustments (
                owner_id, opponent_id, games_won_delta, games_lost_delta,
                points_for_delta, points_against_delta, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(owner_id, opponent_id) DO UPDATE SET
                games_won_delta = excluded.games_won_delta,
                games_lost_delta = excluded.games_lost_delta,
                points_for_delta = excluded.points_for_delta,
                points_against_delta = excluded.points_against_delta,
                updated_at = excluded.updated_at
            """,
            (
                owner_id,
                opponent_id,
                games_won_delta,
                games_lost_delta,
                points_for_delta,
                points_against_delta,
                now_moscow_iso(),
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
