import tempfile
import unittest
from pathlib import Path

from app.scoring import parse_score
from app.storage import Database


class StorageTest(unittest.TestCase):
    def test_manual_totals_are_stored_as_adjustments(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db = Database(str(Path(directory) / "bot.sqlite3"))
            db.ensure_user(1, "Игрок", None)
            opponent = db.add_opponent(1, "Тестовый соперник", None)
            db.add_game(1, opponent.id, parse_score("11-7"))

            db.set_games_total(1, opponent.id, 3, 2)
            db.set_points_total(1, opponent.id, 55, 47)

            stats = db.get_opponent_stats(1, opponent.id)
            raw_stats = db.get_opponent_stats(1, opponent.id, adjusted=False)

            self.assertEqual((stats.wins, stats.losses), (3, 2))
            self.assertEqual((stats.points_for, stats.points_against), (55, 47))
            self.assertEqual((raw_stats.wins, raw_stats.losses), (1, 0))
            self.assertEqual((raw_stats.points_for, raw_stats.points_against), (11, 7))

    def test_linked_opponent_stats_are_visible_for_both_players(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db = Database(str(Path(directory) / "bot.sqlite3"))
            db.ensure_user(1, "Игрок 1", None)
            db.ensure_user(2, "Игрок 2", "test")
            first_opponent = db.add_opponent(1, "Игрок 2", 2)
            second_opponent = db.add_opponent(2, "Игрок 1", 1)

            db.add_game(1, first_opponent.id, parse_score("11-7"))

            self.assertEqual(first_opponent.first_name, "Игрок 2")
            self.assertEqual(first_opponent.username, "test")

            first_stats = db.get_opponent_stats(1, first_opponent.id)
            second_stats = db.get_opponent_stats(2, second_opponent.id)

            self.assertEqual((first_stats.wins, first_stats.losses), (1, 0))
            self.assertEqual((second_stats.wins, second_stats.losses), (0, 1))
            self.assertEqual((second_stats.points_for, second_stats.points_against), (7, 11))

    def test_manual_totals_for_linked_opponent_are_visible_for_both_players(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db = Database(str(Path(directory) / "bot.sqlite3"))
            db.ensure_user(1, "Игрок 1", None)
            db.ensure_user(2, "Игрок 2", None)
            first_opponent = db.add_opponent(1, "Игрок 2", 2)
            second_opponent = db.add_opponent(2, "Игрок 1", 1)
            db.add_game(1, first_opponent.id, parse_score("11-7"))

            db.set_games_total(1, first_opponent.id, 3, 2)
            db.set_points_total(1, first_opponent.id, 55, 47)

            first_stats = db.get_opponent_stats(1, first_opponent.id)
            second_stats = db.get_opponent_stats(2, second_opponent.id)

            self.assertEqual((first_stats.wins, first_stats.losses), (3, 2))
            self.assertEqual((first_stats.points_for, first_stats.points_against), (55, 47))
            self.assertEqual((second_stats.wins, second_stats.losses), (2, 3))
            self.assertEqual((second_stats.points_for, second_stats.points_against), (47, 55))

    def test_invite_link_can_be_used_by_multiple_players(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db = Database(str(Path(directory) / "bot.sqlite3"))
            db.ensure_user(1, "Игрок 1", "owner")
            db.ensure_user(2, "Игрок", None)
            db.ensure_user(3, "Игрок", None)
            token = db.create_invite(1)

            first_acceptance = db.accept_invite(token, 2)
            second_acceptance = db.accept_invite(token, 3)
            repeated_acceptance = db.accept_invite(token, 2)

            self.assertIsNotNone(first_acceptance)
            self.assertIsNotNone(second_acceptance)
            self.assertIsNotNone(repeated_acceptance)
            self.assertTrue(first_acceptance.is_new_opponent)
            self.assertTrue(second_acceptance.is_new_opponent)
            self.assertFalse(repeated_acceptance.is_new_opponent)

            opponent_user_ids = {opponent.opponent_user_id for opponent in db.list_opponents(1)}
            self.assertEqual(opponent_user_ids, {2, 3})

    def test_delete_local_opponent_removes_stats(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db = Database(str(Path(directory) / "bot.sqlite3"))
            db.ensure_user(1, "Игрок", None)
            opponent = db.add_opponent(1, "Тестовый соперник", None)
            db.add_game(1, opponent.id, parse_score("11-7"))

            db.delete_opponent(1, opponent.id)

            self.assertEqual(db.list_opponents(1), [])
            self.assertEqual(db.get_total_stats(1).games, 0)

    def test_delete_linked_opponent_removes_shared_stats_for_both_players(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db = Database(str(Path(directory) / "bot.sqlite3"))
            db.ensure_user(1, "Игрок 1", None)
            db.ensure_user(2, "Игрок 2", None)
            first_opponent = db.add_opponent(1, "Игрок 2", 2)
            second_opponent = db.add_opponent(2, "Игрок 1", 1)
            db.add_game(1, first_opponent.id, parse_score("11-7"))

            db.delete_opponent(1, first_opponent.id)

            self.assertEqual(db.list_opponents(1), [])
            self.assertEqual(db.get_opponent_stats(2, second_opponent.id).games, 0)


if __name__ == "__main__":
    unittest.main()
