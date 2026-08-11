from __future__ import annotations

import os
from collections.abc import Callable

from app.db import CURRENT_SCHEMA_VERSION, PostgresConnection
from app.elo import EloGame, INITIAL_ELO_RATING, rebuild_elo_ratings


MIGRATION_LOCK_ID = 7_491_103_202_608_11
Migration = tuple[int, str, Callable[[PostgresConnection], None]]


def migration_001_initial_schema(connection: PostgresConnection) -> None:
    connection.executescript(
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
            rating_is_fnt INTEGER NOT NULL DEFAULT 0,
            display_name TEXT,
            avatar_value TEXT,
            elo_rating INTEGER NOT NULL DEFAULT 500,
            elo_games INTEGER NOT NULL DEFAULT 0
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

        CREATE TABLE IF NOT EXISTS elo_events (
            game_id BIGINT NOT NULL,
            player_id BIGINT NOT NULL,
            opponent_id BIGINT NOT NULL,
            rating_before INTEGER NOT NULL,
            rating_change INTEGER NOT NULL,
            rating_after INTEGER NOT NULL,
            played_at TEXT NOT NULL,
            PRIMARY KEY(game_id, player_id),
            FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY(player_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
            FOREIGN KEY(opponent_id) REFERENCES users(telegram_id) ON DELETE CASCADE
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

        ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS rating TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_is_fnt INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_value TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS elo_rating INTEGER NOT NULL DEFAULT 500;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS elo_games INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE aggregate_adjustments ADD COLUMN IF NOT EXISTS games_updated_at TEXT;
        ALTER TABLE aggregate_adjustments ADD COLUMN IF NOT EXISTS points_updated_at TEXT;

        UPDATE aggregate_adjustments
        SET games_updated_at = updated_at
        WHERE games_updated_at IS NULL;

        UPDATE aggregate_adjustments
        SET points_updated_at = updated_at
        WHERE points_updated_at IS NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code
        ON users(invite_code)
        WHERE invite_code IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_opponents_owner_name
        ON opponents(owner_id, lower(name));

        CREATE INDEX IF NOT EXISTS idx_opponents_owner_user
        ON opponents(owner_id, opponent_user_id);

        CREATE INDEX IF NOT EXISTS idx_games_unlinked_opponent_history
        ON games(owner_id, opponent_id, played_at DESC, id DESC)
        WHERE owner_id IS NOT NULL AND opponent_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_games_linked_players_history
        ON games(player_a_id, player_b_id, played_at DESC, id DESC)
        WHERE player_b_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_invite_uses_inviter
        ON invite_uses(inviter_id);

        CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
        ON sessions(updated_at);
        """
    )


def migration_002_phase3_boundaries(connection: PostgresConnection) -> None:
    connection.executescript(
        """
        ALTER TABLE opponents
        ADD COLUMN IF NOT EXISTS history_start_game_id BIGINT NOT NULL DEFAULT 0;

        ALTER TABLE opponents
        ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS operation_id TEXT;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_games_creator_operation
        ON games(created_by_id, operation_id)
        WHERE operation_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_games_linked_player_a_id
        ON games(player_a_id, id DESC)
        WHERE player_b_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_games_linked_player_b_id
        ON games(player_b_id, id DESC)
        WHERE player_b_id IS NOT NULL;
        """
    )
    rebuild_elo_history_if_needed(connection)


def rebuild_elo_history_if_needed(connection: PostgresConnection) -> None:
    linked_count = int(
        connection.execute(
            "SELECT COUNT(*) AS games_count FROM games WHERE player_b_id IS NOT NULL"
        ).fetchone()["games_count"]
    )
    event_count = int(
        connection.execute("SELECT COUNT(*) AS events_count FROM elo_events").fetchone()["events_count"]
    )
    if event_count == linked_count * 2:
        return

    rows = connection.execute(
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
    connection.execute("DELETE FROM elo_events")
    connection.execute(
        "UPDATE users SET elo_rating = ?, elo_games = 0",
        (INITIAL_ELO_RATING,),
    )
    for event in events:
        connection.execute(
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
    for player_id, rating in ratings.items():
        connection.execute(
            "UPDATE users SET elo_rating = ?, elo_games = ? WHERE telegram_id = ?",
            (rating, games_played[player_id], player_id),
        )


MIGRATIONS: tuple[Migration, ...] = (
    (1, "initial_schema", migration_001_initial_schema),
    (2, "phase3_boundaries", migration_002_phase3_boundaries),
)


def run_migrations(database_url: str) -> list[int]:
    if not database_url.startswith(("postgresql://", "postgres://")):
        raise RuntimeError("DATABASE_URL должен быть строкой подключения к Postgres.")

    connection = PostgresConnection(database_url)
    applied_now: list[int] = []
    try:
        connection.execute("SELECT pg_advisory_lock(?)", (MIGRATION_LOCK_ID,))
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        connection.commit()
        applied = {
            int(row["version"])
            for row in connection.execute("SELECT version FROM schema_migrations").fetchall()
        }
        for version, name, migrate in MIGRATIONS:
            if version in applied:
                continue
            with connection:
                migrate(connection)
                connection.execute(
                    "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
                    (version, name),
                )
            applied_now.append(version)

        current = connection.execute(
            "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations"
        ).fetchone()
        if int(current["version"]) != CURRENT_SCHEMA_VERSION:
            raise RuntimeError("Схема Postgres не соответствует версии приложения.")
        return applied_now
    finally:
        try:
            connection.execute("SELECT pg_advisory_unlock(?)", (MIGRATION_LOCK_ID,))
            connection.commit()
        finally:
            connection.close()


def main() -> None:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("Нужно задать переменную окружения DATABASE_URL.")
    applied = run_migrations(database_url)
    if applied:
        print(f"Applied database migrations: {', '.join(str(version) for version in applied)}")
    else:
        print(f"Database schema is current at version {CURRENT_SCHEMA_VERSION}.")


if __name__ == "__main__":
    main()
