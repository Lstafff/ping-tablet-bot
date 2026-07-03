import os
import unittest

from app.scoring import parse_score
from app.domain import build_extended_stats
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
class PostgresStorageTest(unittest.TestCase):
    def setUp(self) -> None:
        if "test" not in TEST_DATABASE_URL.lower():
            self.skipTest("TEST_DATABASE_URL must point to a dedicated test database.")

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

    def test_reset_linked_opponent_stats_keeps_opponents_for_both_players(self) -> None:
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
        self.assertEqual(second_stats.games, 0)
        self.assertEqual((first_stats.points_for, first_stats.points_against), (0, 0))
        self.assertEqual((second_stats.points_for, second_stats.points_against), (0, 0))


if __name__ == "__main__":
    unittest.main()
