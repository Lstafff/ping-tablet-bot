import unittest
from dataclasses import dataclass

from app.texts import format_rich_user_name, rich_to_basic_html, total_stats_rich_html


@dataclass(frozen=True)
class Stats:
    wins: int
    losses: int
    points_for: int
    points_against: int

    @property
    def games(self) -> int:
        return self.wins + self.losses


class RichMessagesTest(unittest.TestCase):
    def test_total_stats_rich_html_uses_heading_and_table(self) -> None:
        rich_html = total_stats_rich_html(
            Stats(wins=3, losses=2, points_for=43, points_against=39),
            "<Глеб & Co>",
        )

        self.assertIn("<h2>📊 Статистика всех матчей</h2>\n\n", rich_html)
        self.assertIn("<table bordered striped>", rich_html)
        self.assertIn("<th>🥷 &lt;Глеб &amp; Co&gt;</th>", rich_html)
        self.assertIn("<tr><td>Победы</td><td align=\"right\">3</td><td align=\"right\">2</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего сыграно</td><td colspan=\"2\" align=\"right\">5</td></tr>", rich_html)
        self.assertIn("<tr><td>Мячи</td><td align=\"right\">43</td><td align=\"right\">39</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего мячей</td><td colspan=\"2\" align=\"right\">82</td></tr>", rich_html)

    def test_format_rich_user_name_escapes_html(self) -> None:
        self.assertEqual(format_rich_user_name(" <test&user> "), "&lt;test&amp;user&gt;")
        self.assertEqual(format_rich_user_name(""), "Игрок")

    def test_rich_to_basic_html_downgrades_headings(self) -> None:
        self.assertEqual(
            rich_to_basic_html("<h2>Заголовок</h2><hr/>Текст<br>ещё"),
            "<b>Заголовок</b>\n\nТекст\nещё",
        )


if __name__ == "__main__":
    unittest.main()
