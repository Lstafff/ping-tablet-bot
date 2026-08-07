from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Config:
    bot_token: str
    database_url: str
    seed_test_opponent: bool
    webapp_init_data_max_age_seconds: int
    bot_username: str
    webapp_allowed_origins: tuple[str, ...]
    webapp_url: str


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
    bot_username = os.getenv("BOT_USERNAME", "").strip().lstrip("@")
    webapp_allowed_origins = parse_csv_env("WEBAPP_ALLOWED_ORIGINS", ("http://localhost:5173",))
    webapp_url = os.getenv("WEBAPP_URL", "").strip().rstrip("/")
    if webapp_url and not webapp_url.startswith("https://"):
        raise RuntimeError("WEBAPP_URL должен начинаться с https://.")

    return Config(
        bot_token=token,
        database_url=database_url,
        seed_test_opponent=seed_test_opponent not in {"0", "false", "no", "off"},
        webapp_init_data_max_age_seconds=webapp_init_data_max_age_seconds,
        bot_username=bot_username,
        webapp_allowed_origins=webapp_allowed_origins,
        webapp_url=webapp_url,
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


def parse_csv_env(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return default
    values = tuple(value.strip().rstrip("/") for value in raw_value.split(",") if value.strip())
    if not values:
        raise RuntimeError(f"{name} должен содержать хотя бы один origin.")
    if "*" in values:
        raise RuntimeError(f"{name} не должен содержать wildcard origin.")
    return values
