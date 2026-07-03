import unittest

from app.rating import (
    MAX_RATING_RESPONSE_BYTES,
    is_allowed_rating_url,
    parse_fnt_rating,
    parse_manual_rating,
    read_limited_response,
)


class FakeResponse:
    def __init__(self, content: bytes) -> None:
        self.content = content

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            return self.content
        return self.content[:size]


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

    def test_is_allowed_rating_url_accepts_known_https_hosts(self) -> None:
        self.assertTrue(is_allowed_rating_url("https://ttfr.ru/sportsman/9"))
        self.assertTrue(is_allowed_rating_url("https://www.rttf.ru/players/70524?type=f"))

    def test_is_allowed_rating_url_rejects_unsafe_or_unknown_hosts(self) -> None:
        self.assertFalse(is_allowed_rating_url("http://ttfr.ru/sportsman/9"))
        self.assertFalse(is_allowed_rating_url("https://evil.example/?next=ttfr.ru"))
        self.assertFalse(is_allowed_rating_url("https://ttfr.ru.evil.example/sportsman/9"))
        self.assertFalse(is_allowed_rating_url("https://127.0.0.1/?site=ttfr"))

    def test_read_limited_response_rejects_large_pages(self) -> None:
        response = FakeResponse(b"x" * (MAX_RATING_RESPONSE_BYTES + 1))

        with self.assertRaisesRegex(ValueError, "слишком большая"):
            read_limited_response(response)

    def test_read_limited_response_accepts_small_pages(self) -> None:
        self.assertEqual(read_limited_response(FakeResponse(b"rating")), b"rating")


if __name__ == "__main__":
    unittest.main()
