import unittest

from app.storage import require_schema_name


class StorageSecurityTest(unittest.TestCase):
    def test_require_schema_name_accepts_known_schema_name(self) -> None:
        self.assertEqual(require_schema_name("users"), "users")

    def test_require_schema_name_rejects_unknown_schema_name(self) -> None:
        with self.assertRaises(ValueError):
            require_schema_name("users; DROP TABLE users;")


if __name__ == "__main__":
    unittest.main()
