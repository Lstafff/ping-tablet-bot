import unittest

from app.elo import EloGame, calculate_rating_change, rebuild_elo_ratings, rating_k_factor


class EloTest(unittest.TestCase):
    def test_equal_rated_players_exchange_twelve_points(self) -> None:
        change = calculate_rating_change(500, 500, 30, 30, player_a_won=True)

        self.assertEqual(change, 12)

    def test_upset_is_worth_more_than_expected_win(self) -> None:
        expected_win = calculate_rating_change(700, 500, 30, 30, player_a_won=True)
        upset = calculate_rating_change(500, 700, 30, 30, player_a_won=True)

        self.assertEqual(expected_win, 6)
        self.assertEqual(upset, 18)

    def test_new_players_use_faster_calibration(self) -> None:
        self.assertEqual(rating_k_factor(0, 50), 40)
        self.assertEqual(rating_k_factor(10, 50), 32)
        self.assertEqual(rating_k_factor(30, 50), 24)

    def test_history_rebuilds_in_chronological_order(self) -> None:
        games = [
            EloGame(2, 1, 2, 11, 8, "2026-07-02T12:00:00+03:00"),
            EloGame(1, 2, 1, 11, 9, "2026-07-01T12:00:00+03:00"),
        ]

        ratings, games_played, events = rebuild_elo_ratings(sorted(games, key=lambda game: (game.played_at, game.game_id)))

        self.assertEqual(games_played, {1: 2, 2: 2})
        self.assertEqual(len(events), 4)
        self.assertEqual(ratings[1] + ratings[2], 1000)
        self.assertEqual(events[0].game_id, 1)


if __name__ == "__main__":
    unittest.main()
