import unittest
from dataclasses import dataclass

from app.texts import (
    format_day,
    format_rich_user_name,
    format_stats,
    opponent_daily_stats,
    opponent_stats,
    rich_to_basic_html,
    total_stats_rich_html,
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


class RichMessagesTest(unittest.TestCase):
    def test_total_stats_rich_html_uses_heading_and_table(self) -> None:
        rich_html = total_stats_rich_html(
            Stats(wins=3, losses=2, points_for=43, points_against=39),
            "<Глеб & Co>",
        )

        self.assertIn("<h2>📊 Статистика всех матчей</h2><hr/><table bordered striped>", rich_html)
        self.assertIn("<table bordered striped>", rich_html)
        self.assertIn("<th>🥷 &lt;Глеб &amp; Co&gt;</th>", rich_html)
        self.assertIn("<tr><td>Победы</td><td align=\"right\">3</td><td align=\"right\">2</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего сыграно</td><td colspan=\"2\" align=\"right\">5</td></tr>", rich_html)
        self.assertIn("<tr><td>Мячи</td><td align=\"right\">43</td><td align=\"right\">39</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего мячей</td><td colspan=\"2\" align=\"right\">82</td></tr>", rich_html)

    def test_format_rich_user_name_escapes_html(self) -> None:
        self.assertEqual(format_rich_user_name(" <test&user> "), "&lt;test&amp;user&gt;")
        self.assertEqual(format_rich_user_name(""), "Игрок")

    def test_format_stats_uses_table(self) -> None:
        rich_html = format_stats(Stats(wins=3, losses=2, points_for=43, points_against=39))

        self.assertIn("<table bordered striped>", rich_html)
        self.assertIn("<th>🥷 Игрок</th>", rich_html)
        self.assertIn("<th>🏓 Соперники</th>", rich_html)
        self.assertIn("<tr><td>Победы</td><td align=\"right\">3</td><td align=\"right\">2</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего сыграно</td><td colspan=\"2\" align=\"right\">5</td></tr>", rich_html)
        self.assertIn("<tr><td>Мячи</td><td align=\"right\">43</td><td align=\"right\">39</td></tr>", rich_html)
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

        self.assertIn("<th>День</th><th>@me</th><th>@test</th>", rich_html)
        self.assertIn("<tr><td>12 июня '26</td><td align=\"right\">12</td><td align=\"right\">3</td></tr>", rich_html)

    def test_format_day_uses_russian_month(self) -> None:
        self.assertEqual(format_day("2026-06-12"), "12 июня '26")

    def test_rich_to_basic_html_downgrades_headings(self) -> None:
        self.assertEqual(
            rich_to_basic_html("<h2>Заголовок</h2><hr/>Текст<br>ещё"),
            "<b>Заголовок</b>\n\nТекст\nещё",
        )

    def test_rich_to_basic_html_downgrades_tables(self) -> None:
        self.assertEqual(
            rich_to_basic_html(format_stats(Stats(wins=3, losses=2, points_for=43, points_against=39))),
            (
                "Победы / Поражения: 3-2\n"
                "Партии: 5\n"
                "Мячи: 43-39\n"
                "Всего мячей: 82\n"
            ),
        )


if __name__ == "__main__":
    unittest.main()
