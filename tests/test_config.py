import os
import unittest
from unittest.mock import patch

from app.config import load_config


class ConfigTest(unittest.TestCase):
    def test_load_config_requires_database_url(self) -> None:
        with patch.dict(os.environ, {"BOT_TOKEN": "token"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "DATABASE_URL"):
                load_config()

    def test_load_config_reads_database_url(self) -> None:
        with patch.dict(
            os.environ,
            {"BOT_TOKEN": "token", "DATABASE_URL": "postgresql://user:pass@host/db"},
            clear=True,
        ):
            config = load_config()

        self.assertEqual(config.database_url, "postgresql://user:pass@host/db")
        self.assertTrue(config.seed_test_opponent)

    def test_load_config_rejects_non_postgres_database_url(self) -> None:
        with patch.dict(os.environ, {"BOT_TOKEN": "token", "DATABASE_URL": "sqlite:///bot.db"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "Postgres"):
                load_config()


if __name__ == "__main__":
    unittest.main()
