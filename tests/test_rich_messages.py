import unittest
from dataclasses import dataclass

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
class User:
    first_name: str
    username: str | None
    created_at: str
    rating: str | None
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
