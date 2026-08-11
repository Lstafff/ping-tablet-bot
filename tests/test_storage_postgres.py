import os
import unittest

from app.db import PostgresConnection
from app.domain import build_extended_stats
from app.migrations import migration_001_initial_schema, run_migrations
from app.scoring import parse_score
from app.storage import Database


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()


class ExtendedStatsTest(unittest.TestCase):
    def test_build_extended_stats_counts_overtimes_and_facts_data(self) -> None:
        stats = build_extended_stats(
            [
                {"id": 3, "played_at": "2026-06-12T18:42:00+03:00", "own_score": 17, "opponent_score": 15, "is_overtime": True},
                {"id": 2, "played_at": "2026-06-11T18:42:00+03:00", "own_score": 11, "opponent_score": 7, "is_overtime": False},
                {"id": 1, "played_at": "2026-06-10T18:42:00+03:00", "own_score": 9, "opponent_score": 11, "is_overtime": False},
            ]
        )

        self.assertEqual(stats.games, 3)
        self.assertEqual((stats.overtime_wins, stats.overtime_losses), (1, 0))
        self.assertEqual((stats.longest_own_score, stats.longest_opponent_score), (17, 15))
        self.assertEqual(stats.longest_points, 32)
        self.assertEqual(stats.win_streak, 2)
        self.assertEqual(stats.close_margin_games, 2)


@unittest.skipUnless(TEST_DATABASE_URL, "Storage integration tests require TEST_DATABASE_URL.")
class PostgresMigrationTest(unittest.TestCase):
    def test_upgrade_from_version_1_preserves_existing_data(self) -> None:
        if "test" not in TEST_DATABASE_URL.lower():
            self.skipTest("TEST_DATABASE_URL must point to a dedicated test database.")

        connection = PostgresConnection(TEST_DATABASE_URL)
        try:
            connection.executescript(
                """
                DROP TABLE IF EXISTS schema_migrations CASCADE;
                DROP TABLE IF EXISTS invite_uses CASCADE;
                DROP TABLE IF EXISTS aggregate_adjustments CASCADE;
                DROP TABLE IF EXISTS elo_events CASCADE;
                DROP TABLE IF EXISTS games CASCADE;
                DROP TABLE IF EXISTS sessions CASCADE;
                DROP TABLE IF EXISTS opponents CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
                """
            )
            migration_001_initial_schema(connection)
            connection.execute(
                """
                CREATE TABLE schema_migrations (
                    version INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            connection.execute(
                "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
                (1, "initial_schema"),
            )
            connection.execute(
                """
                INSERT INTO users (telegram_id, first_name, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (1, "Existing player", "2026-08-11T00:00:00+03:00", "2026-08-11T00:00:00+03:00"),
            )
            connection.commit()
        finally:
            connection.close()

        self.assertEqual(run_migrations(TEST_DATABASE_URL), [2])
        database = Database(TEST_DATABASE_URL)
        try:
            self.assertEqual(database.get_user(1).first_name, "Existing player")
            columns = {
                row["column_name"]
                for row in database.connection.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name IN ('games', 'opponents')
                    """
                ).fetchall()
            }
            self.assertTrue({"operation_id", "history_start_game_id", "is_hidden"}.issubset(columns))
        finally:
            database.close()

        self.assertEqual(run_migrations(TEST_DATABASE_URL), [])


@unittest.skipUnless(TEST_DATABASE_URL, "Storage integration tests require TEST_DATABASE_URL.")
class PostgresStorageTest(unittest.TestCase):
    def setUp(self) -> None:
        if "test" not in TEST_DATABASE_URL.lower():
            self.skipTest("TEST_DATABASE_URL must point to a dedicated test database.")

        run_migrations(TEST_DATABASE_URL)
        self.db = Database(TEST_DATABASE_URL)
        self.db.connection.execute(
            """
            TRUNCATE TABLE
                invite_uses,
                aggregate_adjustments,
                games,
                sessions,
                opponents,
                users
            RESTART IDENTITY CASCADE
            """
        )
        self.db.connection.commit()

    def test_invite_code_can_be_used_by_multiple_players(self) -> None:
        self.db.ensure_user(1, "Игрок 1", "owner")
        self.db.ensure_user(2, "Игрок", None)
        self.db.ensure_user(3, "Игрок", None)
        invite_code = self.db.get_or_create_invite_code(1)

        first_acceptance = self.db.accept_invite(invite_code, 2)
        second_acceptance = self.db.accept_invite(invite_code, 3)
        repeated_acceptance = self.db.accept_invite(invite_code, 2)

        self.assertIsNotNone(first_acceptance)
        self.assertIsNotNone(second_acceptance)
        self.assertIsNotNone(repeated_acceptance)
        self.assertTrue(first_acceptance.is_new_opponent)
        self.assertTrue(second_acceptance.is_new_opponent)
        self.assertFalse(repeated_acceptance.is_new_opponent)
        self.assertEqual(self.db.get_invite_referral_count(1), 2)

    def test_linked_opponent_stats_are_visible_for_both_players(self) -> None:
        self.db.ensure_user(1, "Игрок 1", None)
        self.db.ensure_user(2, "Игрок 2", "test")
        first_opponent = self.db.add_opponent(1, "Игрок 2", 2)
        second_opponent = self.db.add_opponent(2, "Игрок 1", 1)

        self.db.add_game(1, first_opponent.id, parse_score("11-7"))

        first_stats = self.db.get_opponent_stats(1, first_opponent.id)
        second_stats = self.db.get_opponent_stats(2, second_opponent.id)
        self.assertEqual((first_stats.wins, first_stats.losses), (1, 0))
        self.assertEqual((second_stats.wins, second_stats.losses), (0, 1))
        self.assertEqual((first_stats.points_for, first_stats.points_against), (11, 7))
        self.assertEqual((second_stats.points_for, second_stats.points_against), (7, 11))

    def test_linked_games_rebuild_elo_for_both_players(self) -> None:
        self.db.ensure_user(1, "Игрок 1", None)
        self.db.ensure_user(2, "Игрок 2", None)
        first_opponent = self.db.add_opponent(1, "Игрок 2", 2)
        self.db.add_opponent(2, "Игрок 1", 1)

        game_id = self.db.add_game(1, first_opponent.id, parse_score("11-7"))

        self.assertEqual(self.db.get_user(1).elo_rating, 520)
        self.assertEqual(self.db.get_user(2).elo_rating, 480)
        self.assertEqual(self.db.get_user(1).elo_games, 1)
        self.assertEqual(self.db.get_user(2).elo_games, 1)

        first_history = self.db.get_recent_games(1, first_opponent.id)
        self.assertEqual((first_history[0].game_id, first_history[0].elo_change), (game_id, 20))

        self.assertTrue(self.db.delete_game(1, first_opponent.id, game_id))
        self.assertEqual(self.db.get_user(1).elo_rating, 500)
        self.assertEqual(self.db.get_user(2).elo_rating, 500)
        self.assertEqual(self.db.get_user(1).elo_games, 0)
        self.assertEqual(self.db.get_user(2).elo_games, 0)

    def test_reset_linked_opponent_stats_only_resets_initiating_player(self) -> None:
        self.db.ensure_user(1, "Игрок 1", None)
        self.db.ensure_user(2, "Игрок 2", None)
        first_opponent = self.db.add_opponent(1, "Игрок 2", 2)
        second_opponent = self.db.add_opponent(2, "Игрок 1", 1)
        self.db.add_game(1, first_opponent.id, parse_score("11-7"))
        self.db.set_games_total(1, first_opponent.id, 123, 4)
        self.db.set_points_total(1, first_opponent.id, 55, 47)

        self.db.reset_opponent_stats(1, first_opponent.id)

        first_stats = self.db.get_opponent_stats(1, first_opponent.id)
        second_stats = self.db.get_opponent_stats(2, second_opponent.id)
        self.assertEqual(len(self.db.list_opponents(1)), 1)
        self.assertEqual(len(self.db.list_opponents(2)), 1)
        self.assertEqual(first_stats.games, 0)
        self.assertEqual(second_stats.games, 127)
        self.assertEqual((first_stats.points_for, first_stats.points_against), (0, 0))
        self.assertEqual((second_stats.points_for, second_stats.points_against), (47, 55))

    def test_new_linked_game_restores_stats_from_other_player(self) -> None:
        self.db.ensure_user(1, "Игрок 1", None)
        self.db.ensure_user(2, "Игрок 2", None)
        first_opponent = self.db.add_opponent(1, "Игрок 2", 2)
        second_opponent = self.db.add_opponent(2, "Игрок 1", 1)
        self.db.add_game(1, first_opponent.id, parse_score("11-7"))

        self.db.reset_opponent_stats(1, first_opponent.id)
        self.db.add_game(2, second_opponent.id, parse_score("11-9"))

        first_stats = self.db.get_opponent_stats(1, first_opponent.id)
        second_stats = self.db.get_opponent_stats(2, second_opponent.id)
        self.assertEqual((first_stats.wins, first_stats.losses), (1, 1))
        self.assertEqual((second_stats.wins, second_stats.losses), (1, 1))

    def test_pair_starts_from_zero_after_both_players_reset(self) -> None:
        self.db.ensure_user(1, "Игрок 1", None)
        self.db.ensure_user(2, "Игрок 2", None)
        first_opponent = self.db.add_opponent(1, "Игрок 2", 2)
        second_opponent = self.db.add_opponent(2, "Игрок 1", 1)
        self.db.add_game(1, first_opponent.id, parse_score("11-7"))

        self.db.reset_opponent_stats(1, first_opponent.id)
        self.db.reset_opponent_stats(2, second_opponent.id)
        self.db.add_game(1, first_opponent.id, parse_score("11-9"))

        first_stats = self.db.get_opponent_stats(1, first_opponent.id)
        second_stats = self.db.get_opponent_stats(2, second_opponent.id)
        self.assertEqual((first_stats.wins, first_stats.losses), (1, 0))
        self.assertEqual((second_stats.wins, second_stats.losses), (0, 1))
        self.assertEqual(self.db.count_user_games(1), 1)

    def test_delete_hides_link_only_for_initiating_player_until_next_game(self) -> None:
        self.db.ensure_user(1, "Игрок 1", None)
        self.db.ensure_user(2, "Игрок 2", None)
        first_opponent = self.db.add_opponent(1, "Игрок 2", 2)
        second_opponent = self.db.add_opponent(2, "Игрок 1", 1)
        self.db.add_game(1, first_opponent.id, parse_score("11-7"))

        self.db.delete_opponent(1, first_opponent.id)

        self.assertEqual(self.db.list_opponents(1), [])
        self.assertEqual(self.db.get_opponent_stats(2, second_opponent.id).games, 1)

        self.db.add_game(2, second_opponent.id, parse_score("11-9"))
        restored = self.db.list_opponents(1)
        self.assertEqual(len(restored), 1)
        self.assertEqual(self.db.get_opponent_stats(1, restored[0].id).games, 2)

    def test_repeated_operation_id_does_not_duplicate_score_or_elo(self) -> None:
        self.db.ensure_user(1, "Игрок 1", None)
        self.db.ensure_user(2, "Игрок 2", None)
        first_opponent = self.db.add_opponent(1, "Игрок 2", 2)
        self.db.add_opponent(2, "Игрок 1", 1)

        first_game_id = self.db.add_game(1, first_opponent.id, parse_score("11-7"), "operation-1")
        second_game_id = self.db.add_game(1, first_opponent.id, parse_score("11-7"), "operation-1")

        self.assertEqual(second_game_id, first_game_id)
        self.assertEqual(self.db.count_opponent_games(1, first_opponent.id), 1)
        self.assertEqual((self.db.get_user(1).elo_rating, self.db.get_user(1).elo_games), (520, 1))

        with self.assertRaisesRegex(ValueError, "уже использован"):
            self.db.add_game(1, first_opponent.id, parse_score("11-9"), "operation-1")


if __name__ == "__main__":
    unittest.main()
