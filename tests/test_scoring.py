import unittest

from app.scoring import ScoreError, parse_pair, parse_score


class ParseScoreTest(unittest.TestCase):
    def test_regular_score(self) -> None:
        score = parse_score("11-7")
        self.assertEqual(score.own_score, 11)
        self.assertEqual(score.opponent_score, 7)
        self.assertEqual(score.regular_own, 11)
        self.assertEqual(score.regular_opponent, 7)
        self.assertEqual(score.overtime_own, 0)
        self.assertEqual(score.overtime_opponent, 0)

    def test_overtime_score(self) -> None:
        score = parse_score("15 13")
        self.assertEqual(score.regular_own, 10)
        self.assertEqual(score.regular_opponent, 10)
        self.assertEqual(score.overtime_own, 5)
        self.assertEqual(score.overtime_opponent, 3)

    def test_finished_game_requires_two_point_difference(self) -> None:
        with self.assertRaises(ScoreError):
            parse_score("12-11")

    def test_pair(self) -> None:
        self.assertEqual(parse_pair("8:5"), (8, 5))


if __name__ == "__main__":
    unittest.main()
