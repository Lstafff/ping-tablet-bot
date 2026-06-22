import unittest

from app.rating import parse_fnt_rating, parse_manual_rating


class RatingTest(unittest.TestCase):
    def test_parse_manual_rating_accepts_numbers(self) -> None:
        self.assertEqual(parse_manual_rating("1500"), "1500")
        self.assertEqual(parse_manual_rating("1500,5"), "1500.5")

    def test_parse_manual_rating_rejects_text(self) -> None:
        self.assertIsNone(parse_manual_rating("мой рейтинг 1500"))

    def test_parse_fnt_rating_from_text(self) -> None:
        page_html = "<html><body><div>Рейтинг ФНТР: 1342</div></body></html>"

        self.assertEqual(parse_fnt_rating(page_html), "1342")

    def test_parse_ttfr_rating_from_points_meta(self) -> None:
        page_html = '<meta name="description" content="Санкт-Петербург. Количество очков: 2219">'

        self.assertEqual(parse_fnt_rating(page_html), "2219")

    def test_parse_rttf_rating_from_active_fnt_tab(self) -> None:
        page_html = (
            '<h3><dfn>1409</dfn></h3>'
            '<ul id="tabs">'
            '<li data-tab="rat_s">rttf <dfn>1409</dfn></li>'
            '<li class="act" data-tab="rat_f">фнтр <dfn>2233</dfn></li>'
            '</ul>'
            '<section class="player-stats"><table><tr><td>Место в рейтинге:</td><td>1</td></tr></table></section>'
        )

        self.assertEqual(parse_fnt_rating(page_html), "2233")

    def test_parse_fnt_rating_from_json(self) -> None:
        page_html = "<script>{\"rating\": 1577}</script>"

        self.assertEqual(parse_fnt_rating(page_html), "1577")


if __name__ == "__main__":
    unittest.main()
