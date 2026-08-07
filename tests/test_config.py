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
        self.assertEqual(config.webapp_init_data_max_age_seconds, 24 * 60 * 60)
        self.assertEqual(config.bot_username, "")
        self.assertEqual(config.webapp_allowed_origins, ("http://localhost:5173",))
        self.assertEqual(config.webapp_url, "")

    def test_load_config_reads_webapp_init_data_max_age(self) -> None:
        with patch.dict(
            os.environ,
            {
                "BOT_TOKEN": "token",
                "DATABASE_URL": "postgresql://user:pass@host/db",
                "WEBAPP_INIT_DATA_MAX_AGE_SECONDS": "300",
            },
            clear=True,
        ):
            config = load_config()

        self.assertEqual(config.webapp_init_data_max_age_seconds, 300)

    def test_load_config_reads_webapp_delivery_settings(self) -> None:
        with patch.dict(
            os.environ,
            {
                "BOT_TOKEN": "token",
                "DATABASE_URL": "postgresql://user:pass@host/db",
                "BOT_USERNAME": "@ping_tablet_bot",
                "WEBAPP_ALLOWED_ORIGINS": "https://app.example.com/, https://preview.example.com",
                "WEBAPP_URL": "https://app.example.com/",
            },
            clear=True,
        ):
            config = load_config()

        self.assertEqual(config.bot_username, "ping_tablet_bot")
        self.assertEqual(
            config.webapp_allowed_origins,
            ("https://app.example.com", "https://preview.example.com"),
        )
        self.assertEqual(config.webapp_url, "https://app.example.com")

    def test_load_config_rejects_non_https_webapp_url(self) -> None:
        with patch.dict(
            os.environ,
            {
                "BOT_TOKEN": "token",
                "DATABASE_URL": "postgresql://user:pass@host/db",
                "WEBAPP_URL": "http://localhost:5173",
            },
            clear=True,
        ):
            with self.assertRaisesRegex(RuntimeError, "https"):
                load_config()

    def test_load_config_rejects_non_postgres_database_url(self) -> None:
        with patch.dict(os.environ, {"BOT_TOKEN": "token", "DATABASE_URL": "sqlite:///bot.db"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "Postgres"):
                load_config()

    def test_load_config_rejects_invalid_webapp_init_data_max_age(self) -> None:
        with patch.dict(
            os.environ,
            {
                "BOT_TOKEN": "token",
                "DATABASE_URL": "postgresql://user:pass@host/db",
                "WEBAPP_INIT_DATA_MAX_AGE_SECONDS": "0",
            },
            clear=True,
        ):
            with self.assertRaisesRegex(RuntimeError, "WEBAPP_INIT_DATA_MAX_AGE_SECONDS"):
                load_config()

    def test_load_config_rejects_wildcard_webapp_origin(self) -> None:
        with patch.dict(
            os.environ,
            {
                "BOT_TOKEN": "token",
                "DATABASE_URL": "postgresql://user:pass@host/db",
                "WEBAPP_ALLOWED_ORIGINS": "*",
            },
            clear=True,
        ):
            with self.assertRaisesRegex(RuntimeError, "wildcard"):
                load_config()


if __name__ == "__main__":
    unittest.main()
