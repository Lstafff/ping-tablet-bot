import unittest

from app.match_image import render_match_score_image, score_font_size


try:
    import PIL  # noqa: F401

    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False


class MatchImageTest(unittest.TestCase):
    @unittest.skipUnless(HAS_PILLOW, "Match image rendering requires Pillow.")
    def test_render_match_score_image_returns_png(self) -> None:
        image = render_match_score_image(12, 9)

        self.assertTrue(image.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_score_font_size_shrinks_long_scores(self) -> None:
        self.assertEqual(score_font_size("9"), 120)
        self.assertEqual(score_font_size("123"), 100)
        self.assertEqual(score_font_size("1234"), 78)


if __name__ == "__main__":
    unittest.main()
