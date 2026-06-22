from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Config:
    bot_token: str
    database_url: str
    seed_test_opponent: bool


def load_config() -> Config:
    token = os.getenv("BOT_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Нужно задать переменную окружения BOT_TOKEN.")

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("Нужно задать переменную окружения DATABASE_URL.")
    if not database_url.startswith(("postgresql://", "postgres://")):
        raise RuntimeError("DATABASE_URL должен быть строкой подключения к Postgres.")

    seed_test_opponent = os.getenv("SEED_TEST_OPPONENT", "true").strip().lower()

    return Config(
        bot_token=token,
        database_url=database_url,
        seed_test_opponent=seed_test_opponent not in {"0", "false", "no", "off"},
    )
