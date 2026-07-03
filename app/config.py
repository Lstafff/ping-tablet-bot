from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Config:
    bot_token: str
    database_url: str
    seed_test_opponent: bool
    webapp_init_data_max_age_seconds: int


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
    webapp_init_data_max_age_seconds = parse_positive_int_env(
        "WEBAPP_INIT_DATA_MAX_AGE_SECONDS",
        24 * 60 * 60,
    )

    return Config(
        bot_token=token,
        database_url=database_url,
        seed_test_opponent=seed_test_opponent not in {"0", "false", "no", "off"},
        webapp_init_data_max_age_seconds=webapp_init_data_max_age_seconds,
    )


def parse_positive_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return default
    try:
        value = int(raw_value)
    except ValueError as error:
        raise RuntimeError(f"{name} должен быть целым числом.") from error
    if value < 1:
        raise RuntimeError(f"{name} должен быть положительным числом.")
    return value
