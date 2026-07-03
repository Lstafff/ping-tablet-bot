import unittest
from dataclasses import dataclass
from typing import Optional

from app.texts import (
    format_day,
    format_game_time,
    format_player_level,
    format_recent_games,
    format_rating,
    format_rich_user_name,
    format_signed_difference,
    format_stats,
    is_fnt_rating_input,
    levels_info,
    opponent_daily_stats,
    opponent_stats,
    profile,
    score_input_error,
    score_saved,
    score_undone,
    stats_fact_candidates,
)


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
class ExtendedStats:
    games: int
    overtime_wins: int
    overtime_losses: int
    longest_own_score: Optional[int]
    longest_opponent_score: Optional[int]
    longest_points: int
    win_streak: int
    large_margin_games: int
    close_margin_games: int
    most_common_score: Optional[str]
    most_common_score_count: int

    @property
    def overtime_games(self) -> int:
        return self.overtime_wins + self.overtime_losses


@dataclass(frozen=True)
class DailyStats:
    played_on: str
    wins: int
    losses: int


@dataclass(frozen=True)
class RecentGame:
    played_at: str
    own_score: int
    opponent_score: int


@dataclass(frozen=True)
class Score:
    own_score: int
    opponent_score: int
    regular_own: int
    regular_opponent: int
    overtime_own: int
    overtime_opponent: int


@dataclass(frozen=True)
class User:
    first_name: str
    username: Optional[str]
    created_at: str
    rating: Optional[str]
    rating_is_fnt: bool


class RichMessagesTest(unittest.TestCase):
    def test_profile_uses_user_info_and_stats_table(self) -> None:
        rich_html = profile(
            User(
                first_name="Глеб",
                username="lstaff",
                created_at="2026-06-12T18:42:00+03:00",
                rating=None,
                rating_is_fnt=False,
            ),
            Stats(wins=3, losses=2, points_for=43, points_against=39),
        )

        self.assertIn("<h2>🥷 Профиль @lstaff</h2>", rich_html)
        self.assertIn("<b>･ Играет с </b>12 июня '26", rich_html)
        self.assertIn("<b>･ Уровень: </b>👶 новичок", rich_html)
        self.assertIn("<b>･ Рейтинг: </b>пока нет", rich_html)
        self.assertIn("<h2>📊 Общая статистика</h2><hr/><table bordered striped>", rich_html)
        self.assertIn("<table bordered striped>", rich_html)
        self.assertIn("<th>🥷 @lstaff</th>", rich_html)
        self.assertIn("<tr><td>Победы</td><td align=\"right\">3 (+1)</td><td align=\"right\">2</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего игр</td><td colspan=\"2\" align=\"right\">5</td></tr>", rich_html)
        self.assertIn("<tr><td>Мячи</td><td align=\"right\">43 (+4)</td><td align=\"right\">39</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего мячей</td><td colspan=\"2\" align=\"right\">82</td></tr>", rich_html)

    def test_format_rich_user_name_escapes_html(self) -> None:
        self.assertEqual(format_rich_user_name(" <test&user> "), "&lt;test&amp;user&gt;")
        self.assertEqual(format_rich_user_name(""), "Игрок")

    def test_format_stats_uses_table(self) -> None:
        rich_html = format_stats(Stats(wins=3, losses=2, points_for=43, points_against=39))

        self.assertIn("<table bordered striped>", rich_html)
        self.assertIn("<th>🥷 Игрок</th>", rich_html)
        self.assertIn("<th>🏓 Соперники</th>", rich_html)
        self.assertIn("<tr><td>Победы</td><td align=\"right\">3 (+1)</td><td align=\"right\">2</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего игр</td><td colspan=\"2\" align=\"right\">5</td></tr>", rich_html)
        self.assertIn("<tr><td>Мячи</td><td align=\"right\">43 (+4)</td><td align=\"right\">39</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего мячей</td><td colspan=\"2\" align=\"right\">82</td></tr>", rich_html)

    def test_format_stats_uses_extended_rows_and_fact_block(self) -> None:
        rich_html = format_stats(
            Stats(wins=4, losses=1, points_for=75, points_against=60),
            extended_stats=ExtendedStats(
                games=5,
                overtime_wins=2,
                overtime_losses=1,
                longest_own_score=17,
                longest_opponent_score=15,
                longest_points=32,
                win_streak=4,
                large_margin_games=0,
                close_margin_games=4,
                most_common_score="11-9",
                most_common_score_count=2,
            ),
        )

        self.assertIn("<tr><td>Овертаймы</td><td align=\"right\">2</td><td align=\"right\">1</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего овертаймов</td><td colspan=\"2\" align=\"right\">3</td></tr>", rich_html)
        self.assertIn(
            "<tr><td>Самая долгая игра</td><td align=\"right\">17</td><td align=\"right\">15</td></tr>",
            rich_html,
        )
        self.assertIn("<hr/><blockquote>", rich_html)

    def test_stats_fact_candidates_use_available_data(self) -> None:
        facts = stats_fact_candidates(
            ExtendedStats(
                games=5,
                overtime_wins=4,
                overtime_losses=1,
                longest_own_score=17,
                longest_opponent_score=15,
                longest_points=32,
                win_streak=4,
                large_margin_games=3,
                close_margin_games=0,
                most_common_score="11-9",
                most_common_score_count=2,
            )
        )

        self.assertTrue(any("80% овертаймов" in fact for fact in facts))
        self.assertTrue(any("17-15" in fact for fact in facts))
        self.assertTrue(any("4 побед подряд" in fact for fact in facts))
        self.assertTrue(any("соперников посильнее" in fact for fact in facts))
        self.assertTrue(any("11-9" in fact for fact in facts))

    def test_opponent_stats_uses_user_name(self) -> None:
        rich_html = opponent_stats("@test", Stats(wins=3, losses=2, points_for=43, points_against=39), "@me")

        self.assertIn("<th>🥷 @me</th>", rich_html)
        self.assertIn("<th>🏓 @test</th>", rich_html)
        self.assertNotIn("<th>🥷 Игрок</th>", rich_html)

    def test_opponent_daily_stats_uses_day_table(self) -> None:
        rich_html = opponent_daily_stats(
            "@test",
            [DailyStats(played_on="2026-06-12", wins=12, losses=3)],
            "@me",
        )

        self.assertIn("<th>День</th><th>🥷 @me</th><th>🏓 @test</th>", rich_html)
        self.assertIn("<tr><td>12 июня '26</td><td align=\"right\">12</td><td align=\"right\">3</td></tr>", rich_html)

    def test_format_recent_games_uses_time_table(self) -> None:
        rich_html = format_recent_games(
            [RecentGame(played_at="2026-06-12T18:42:00+03:00", own_score=11, opponent_score=7)],
            "@me",
            "@test",
        )

        self.assertIn("<th>Дата</th><th>@me</th><th>@test</th>", rich_html)
        self.assertIn("<tr><td>12 июня, 18:42</td><td align=\"right\">11</td><td align=\"right\">7</td></tr>", rich_html)

    def test_score_result_screens_show_next_score_hint_after_recent_games(self) -> None:
        recent_games = [RecentGame(played_at="2026-06-12T18:42:00+03:00", own_score=11, opponent_score=7)]
        score = Score(
            own_score=11,
            opponent_score=7,
            regular_own=11,
            regular_opponent=7,
            overtime_own=0,
            overtime_opponent=0,
        )

        for rich_html in (
            score_saved("@test", score, recent_games, "@me"),
            score_undone("@test", recent_games, "@me"),
        ):
            self.assertIn("<h2>📊 Последние 5 игр</h2>", rich_html)
            self.assertIn("<table bordered striped>", rich_html)
            self.assertIn("<hr/><blockquote>Напиши следующий счёт в чат! ⬇️</blockquote>", rich_html)

    def test_score_error_shows_next_score_hint_without_recent_games(self) -> None:
        rich_html = score_input_error("@test", ValueError("Ошибка"))

        self.assertNotIn("<h2>📊 Последние 5 игр</h2>", rich_html)
        self.assertNotIn("<table bordered striped>", rich_html)
        self.assertNotIn("<hr/><blockquote>Напиши следующий счёт в чат! ⬇️</blockquote>", rich_html)
        self.assertIn("<blockquote>Напиши следующий счёт в чат! ⬇️</blockquote>", rich_html)

    def test_format_day_uses_russian_month(self) -> None:
        self.assertEqual(format_day("2026-06-12"), "12 июня '26")

    def test_format_game_time_uses_russian_month_and_time(self) -> None:
        self.assertEqual(format_game_time("2026-06-12T18:42:00+03:00"), "12 июня, 18:42")

    def test_format_signed_difference_adds_plus_only_for_positive_values(self) -> None:
        self.assertEqual(format_signed_difference(4), "+4")
        self.assertEqual(format_signed_difference(0), "0")
        self.assertEqual(format_signed_difference(-2), "-2")

    def test_format_player_level_uses_game_boundaries(self) -> None:
        self.assertEqual(format_player_level(49, False), "👶 новичок")
        self.assertEqual(format_player_level(50, False), "🏓 любитель")
        self.assertEqual(format_player_level(149, False), "🏓 любитель")
        self.assertEqual(format_player_level(150, False), "🤘 бывалый")
        self.assertEqual(format_player_level(299, False), "🤘 бывалый")
        self.assertEqual(format_player_level(300, False), "🦾 робот")
        self.assertEqual(format_player_level(499, False), "🦾 робот")
        self.assertEqual(format_player_level(500, False), "💀 профик")

    def test_format_player_level_uses_fnt_rating(self) -> None:
        self.assertEqual(format_player_level(0, True), "💀 профик")

    def test_levels_info_lists_player_levels(self) -> None:
        rich_html = levels_info()

        self.assertIn("<h2>🎯 Уровни игроков</h2>", rich_html)
        self.assertIn("<tr><th>Уровень</th><th>Всего матчей</th></tr>", rich_html)
        self.assertIn("<tr><td>новичок 👶</td><td>меньше 50</td></tr>", rich_html)
        self.assertIn("<tr><td>любитель 🏓</td><td>50-149</td></tr>", rich_html)
        self.assertIn("<tr><td>бывалый 🤘😎</td><td>150-299</td></tr>", rich_html)
        self.assertIn("<tr><td>робот 🦾</td><td>300-499</td></tr>", rich_html)
        self.assertIn("<tr><td>профик 💀</td><td>500+</td></tr>", rich_html)
        self.assertIn(
            "<blockquote>❗️ Если у тебя рейтинг ФНТР, ты профик независимо от количества сыгранных партий</blockquote>",
            rich_html,
        )

    def test_format_rating(self) -> None:
        self.assertEqual(format_rating(None, False), "пока нет")
        self.assertEqual(format_rating("1500", False), "1500")
        self.assertEqual(format_rating("1500", True), "1500 (✅ ФНТР)")

    def test_is_fnt_rating_input_detects_rating_links(self) -> None:
        self.assertTrue(is_fnt_rating_input("https://ttfr.ru/player/1"))
        self.assertFalse(is_fnt_rating_input("1500"))

if __name__ == "__main__":
    unittest.main()
