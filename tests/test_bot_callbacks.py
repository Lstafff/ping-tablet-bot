import unittest

from app.callbacks import (
    parse_callback_id,
    parse_score_undo_callback,
    parse_stats_days_callback,
    parse_stats_games_callback,
)


class BotCallbackParsingTest(unittest.TestCase):
    def test_parse_callback_id_accepts_expected_prefix(self) -> None:
        self.assertEqual(parse_callback_id("opponent:42", "opponent:"), 42)

    def test_parse_callback_id_rejects_malformed_data(self) -> None:
        self.assertIsNone(parse_callback_id("opponent:not-number", "opponent:"))
        self.assertIsNone(parse_callback_id("delete:42", "opponent:"))
        self.assertIsNone(parse_callback_id(None, "opponent:"))

    def test_parse_score_undo_callback(self) -> None:
        self.assertEqual(parse_score_undo_callback("score_undo:7:15"), (7, 15))
        self.assertIsNone(parse_score_undo_callback("score_undo:7"))
        self.assertIsNone(parse_score_undo_callback("score_undo:7:nope"))

    def test_parse_stats_days_callback(self) -> None:
        self.assertEqual(parse_stats_days_callback("stats_days:3"), (3, 1))
        self.assertEqual(parse_stats_days_callback("stats_days:3:2"), (3, 2))
        self.assertIsNone(parse_stats_days_callback("stats_days:nope:2"))

    def test_parse_stats_games_callback(self) -> None:
        self.assertEqual(parse_stats_games_callback("stats_games:3"), (3, 1))
        self.assertEqual(parse_stats_games_callback("stats_games:3:2"), (3, 2))
        self.assertIsNone(parse_stats_games_callback("stats_games:nope:2"))


if __name__ == "__main__":
    unittest.main()
