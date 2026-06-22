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

    def test_parse_fnt_rating_from_json(self) -> None:
        page_html = "<script>{\"rating\": 1577}</script>"

        self.assertEqual(parse_fnt_rating(page_html), "1577")


if __name__ == "__main__":
    unittest.main()
