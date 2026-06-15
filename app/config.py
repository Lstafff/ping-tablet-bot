from dataclasses import dataclass
from pathlib import Path
import os


def _default_database_path() -> str:
    if Path("/data").exists():
        return "/data/table_tennis.sqlite3"
    return "data/table_tennis.sqlite3"


@dataclass(frozen=True)
class Config:
    bot_token: str
    database_path: str
    seed_test_opponent: bool


def load_config() -> Config:
    token = os.getenv("BOT_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Нужно задать переменную окружения BOT_TOKEN.")

    seed_test_opponent = os.getenv("SEED_TEST_OPPONENT", "true").strip().lower()

    return Config(
        bot_token=token,
        database_path=os.getenv("DATABASE_PATH", _default_database_path()).strip(),
        seed_test_opponent=seed_test_opponent not in {"0", "false", "no", "off"},
    )
