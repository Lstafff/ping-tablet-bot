from __future__ import annotations

import asyncio
import unittest

from app.domain import DailyStats, ExtendedStats, Opponent, RecentGame, Stats, User
from app.services import RATING_INVALID, RATING_UPDATED, TennisService


class FakeStorage:
    def __init__(self) -> None:
        self.user = User(
            telegram_id=1,
            first_name="Игрок",
            username="player",
            last_message_id=None,
            created_at="2026-07-03T12:00:00+03:00",
            rating=None,
            rating_is_fnt=False,
        )
        self.opponent = Opponent(
            id=10,
            owner_id=1,
            name="Соперник",
            opponent_user_id=None,
        )
        self.sessions: list[tuple[int, str, int | None]] = []
        self.saved_scores: list[tuple[int, int, int, int]] = []
        self.cleared_sessions: list[int] = []
        self.rating_updates: list[tuple[int, str | None, bool]] = []

    def ensure_user(self, telegram_id, first_name, username):
        return self.user

    def ensure_test_opponent(self, telegram_id):
        return None

    def clear_session(self, user_id):
        self.cleared_sessions.append(user_id)

    def get_session(self, user_id):
        return None

    def list_opponents(self, user_id):
        return [self.opponent]

    def get_opponent(self, user_id, opponent_id):
        return self.opponent

    def get_user(self, user_id):
        return self.user

    def add_game(self, user_id, opponent_id, score):
        self.saved_scores.append((user_id, opponent_id, score.own_score, score.opponent_score))
        return 42

    def get_recent_games(self, user_id, opponent_id, limit=5, offset=0):
        games = [
            RecentGame(played_at="2026-07-03T12:00:00+03:00", own_score=11, opponent_score=7),
            RecentGame(played_at="2026-07-02T12:00:00+03:00", own_score=9, opponent_score=11),
        ]
        return games[offset : offset + limit]

    def set_session(self, user_id, mode, opponent_id):
        self.sessions.append((user_id, mode, opponent_id))

    def set_games_total(self, user_id, opponent_id, wins, losses):
        return None

    def set_points_total(self, user_id, opponent_id, points_for, points_against):
        return None

    def get_opponent_stats(self, user_id, opponent_id):
        return Stats(wins=1, losses=1, points_for=20, points_against=18)

    def get_opponent_extended_stats(self, user_id, opponent_id):
        return ExtendedStats(
            games=2,
            overtime_wins=0,
            overtime_losses=0,
            longest_own_score=11,
            longest_opponent_score=11,
            longest_points=20,
            win_streak=1,
            large_margin_games=0,
            close_margin_games=1,
            most_common_score="11-7",
            most_common_score_count=1,
        )

    def get_total_stats(self, user_id):
        return Stats(wins=1, losses=1, points_for=20, points_against=18)

    def get_total_extended_stats(self, user_id):
        return self.get_opponent_extended_stats(user_id, 10)

    def get_opponent_daily_stats(self, user_id, opponent_id):
        return [
            DailyStats(played_on="2026-07-03", wins=1, losses=0),
            DailyStats(played_on="2026-07-02", wins=0, losses=1),
            DailyStats(played_on="2026-07-01", wins=1, losses=0),
        ]

    def count_opponent_games(self, user_id, opponent_id):
        return 2

    def set_user_rating(self, user_id, rating, rating_is_fnt):
        self.rating_updates.append((user_id, rating, rating_is_fnt))


class TennisServiceTest(unittest.TestCase):
    def test_submit_score_adds_game_and_returns_view_data(self) -> None:
        storage = FakeStorage()
        service = TennisService(storage, seed_test_opponent=False)

        result = service.submit_score(1, 10, "11-7")

        self.assertIsNone(result.error)
        self.assertEqual(result.game_id, 42)
        self.assertEqual(result.opponent_name, "Соперник")
        self.assertEqual(result.user_name, "@player")
        self.assertEqual(storage.saved_scores, [(1, 10, 11, 7)])

    def test_submit_score_returns_error_without_saving(self) -> None:
        storage = FakeStorage()
        service = TennisService(storage, seed_test_opponent=False)

        result = service.submit_score(1, 10, "11-10")

        self.assertIsNotNone(result.error)
        self.assertEqual(storage.saved_scores, [])

    def test_daily_stats_view_clamps_page(self) -> None:
        service = TennisService(FakeStorage(), seed_test_opponent=False)

        view = service.get_opponent_daily_stats(1, 10, page=99, page_size=2)

        self.assertEqual(view.page, 2)
        self.assertEqual(view.total_pages, 2)
        self.assertEqual([item.played_on for item in view.daily_stats], ["2026-07-01"])

    def test_submit_rating_input_updates_manual_rating(self) -> None:
        storage = FakeStorage()
        service = TennisService(storage, seed_test_opponent=False)

        result = asyncio.run(service.submit_rating_input(1, "1500,5"))

        self.assertEqual(result.status, RATING_UPDATED)
        self.assertEqual(storage.rating_updates, [(1, "1500.5", False)])
        self.assertEqual(storage.cleared_sessions, [1])

    def test_submit_rating_input_rejects_invalid_text(self) -> None:
        storage = FakeStorage()
        service = TennisService(storage, seed_test_opponent=False)

        result = asyncio.run(service.submit_rating_input(1, "мой рейтинг"))

        self.assertEqual(result.status, RATING_INVALID)
        self.assertEqual(storage.rating_updates, [])


if __name__ == "__main__":
    unittest.main()
