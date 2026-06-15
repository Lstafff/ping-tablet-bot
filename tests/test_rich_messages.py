import unittest
from dataclasses import dataclass

from app.rich_messages import total_stats_rich_html


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
        )

        self.assertIn("<h1>📊 Статистика всех матчей</h1>", rich_html)
        self.assertIn("<table bordered striped>", rich_html)
        self.assertIn("<tr><td>Партии</td><td align=\"right\">5</td></tr>", rich_html)
        self.assertIn("<tr><td>Всего мячей</td><td align=\"right\">82</td></tr>", rich_html)


if __name__ == "__main__":
    unittest.main()
