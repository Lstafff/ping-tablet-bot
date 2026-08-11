import unittest

from app.storage import require_non_negative_offset, require_positive_limit


class StorageSecurityTest(unittest.TestCase):
    def test_require_positive_limit_rejects_non_positive_limit(self) -> None:
        with self.assertRaises(ValueError):
            require_positive_limit(0, maximum=100)

    def test_require_positive_limit_caps_large_limit(self) -> None:
        self.assertEqual(require_positive_limit(250, maximum=100), 100)

    def test_require_non_negative_offset_rejects_negative_offset(self) -> None:
        with self.assertRaises(ValueError):
            require_non_negative_offset(-1)


if __name__ == "__main__":
    unittest.main()
