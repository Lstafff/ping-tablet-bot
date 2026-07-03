from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import parse_qsl


DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60


class WebAppAuthError(ValueError):
    pass


@dataclass(frozen=True)
class WebAppUser:
    id: int
    first_name: Optional[str]
    username: Optional[str]


def validate_init_data(
    init_data: str,
    bot_token: str,
    max_age_seconds: int = DEFAULT_INIT_DATA_MAX_AGE_SECONDS,
    now: Optional[int] = None,
) -> WebAppUser:
    try:
        parsed = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=True))
    except ValueError as error:
        raise WebAppAuthError("Некорректная initData.") from error
    received_hash = parsed.pop("hash", "")
    if not received_hash:
        raise WebAppAuthError("Нет подписи initData.")

    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(parsed.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, received_hash):
        raise WebAppAuthError("Недействительная подпись initData.")

    auth_date = parse_auth_date(parsed.get("auth_date"))
    current_time = int(time.time()) if now is None else now
    if auth_date > current_time:
        raise WebAppAuthError("initData из будущего.")
    if max_age_seconds > 0 and current_time - auth_date > max_age_seconds:
        raise WebAppAuthError("initData устарела.")

    raw_user = parsed.get("user")
    if not raw_user:
        raise WebAppAuthError("В initData нет пользователя.")

    return parse_webapp_user(raw_user)


def parse_auth_date(raw_auth_date: Optional[str]) -> int:
    if raw_auth_date is None:
        raise WebAppAuthError("В initData нет auth_date.")
    try:
        return int(raw_auth_date)
    except ValueError as error:
        raise WebAppAuthError("Некорректный auth_date.") from error


def parse_webapp_user(raw_user: str) -> WebAppUser:
    try:
        user_data: dict[str, Any] = json.loads(raw_user)
    except json.JSONDecodeError as error:
        raise WebAppAuthError("Некорректный пользователь initData.") from error

    user_id = user_data.get("id")
    if not isinstance(user_id, int):
        raise WebAppAuthError("В initData нет id пользователя.")

    first_name = user_data.get("first_name")
    username = user_data.get("username")
    return WebAppUser(
        id=user_id,
        first_name=first_name if isinstance(first_name, str) else None,
        username=username if isinstance(username, str) else None,
    )
