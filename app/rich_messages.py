from __future__ import annotations

import html
from typing import Any, Optional, Protocol


class StatsLike(Protocol):
    games: int
    wins: int
    losses: int
    points_for: int
    points_against: int


class TelegramRichMessageError(RuntimeError):
    pass


def total_stats_rich_html(stats: StatsLike) -> str:
    return (
        "<h1>📊 Статистика всех матчей</h1>"
        "<table bordered striped>"
        "<tr><th>Показатель</th><th>Значение</th></tr>"
        f"<tr><td>Партии</td><td align=\"right\">{stats.games}</td></tr>"
        f"<tr><td>Победы</td><td align=\"right\">{stats.wins}</td></tr>"
        f"<tr><td>Поражения</td><td align=\"right\">{stats.losses}</td></tr>"
        f"<tr><td>Мячи</td><td align=\"right\">{stats.points_for}-{stats.points_against}</td></tr>"
        f"<tr><td>Всего мячей</td><td align=\"right\">{stats.points_for + stats.points_against}</td></tr>"
        "</table>"
    )


async def render_rich_message(
    bot: Any,
    chat_id: int,
    rich_html: str,
    reply_markup: Any,
    last_message_id: Optional[int],
) -> int:
    if last_message_id is not None:
        try:
            result = await _telegram_api_request(
                bot,
                "editMessageText",
                {
                    "chat_id": chat_id,
                    "message_id": last_message_id,
                    "rich_message": {"html": rich_html},
                    "reply_markup": _to_jsonable(reply_markup),
                },
            )
            return _message_id_from_result(result, last_message_id)
        except TelegramRichMessageError as error:
            if "message is not modified" in str(error).lower():
                return last_message_id

    result = await _telegram_api_request(
        bot,
        "sendRichMessage",
        {
            "chat_id": chat_id,
            "rich_message": {"html": rich_html},
            "reply_markup": _to_jsonable(reply_markup),
        },
    )
    new_message_id = _message_id_from_result(result, None)

    if last_message_id is not None and new_message_id != last_message_id:
        try:
            await _telegram_api_request(
                bot,
                "deleteMessage",
                {"chat_id": chat_id, "message_id": last_message_id},
            )
        except TelegramRichMessageError:
            pass

    return new_message_id


async def _telegram_api_request(bot: Any, method: str, payload: dict[str, Any]) -> Any:
    import aiohttp

    url = bot.session.api.api_url(token=bot.token, method=method)
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, timeout=10) as response:
            data = await response.json(content_type=None)

    if not data.get("ok"):
        description = html.escape(str(data.get("description", "Unknown Telegram API error")))
        raise TelegramRichMessageError(f"{method}: {description}")

    return data.get("result")


def _message_id_from_result(result: Any, fallback: Optional[int]) -> int:
    if isinstance(result, dict) and isinstance(result.get("message_id"), int):
        return result["message_id"]
    if fallback is not None:
        return fallback
    raise TelegramRichMessageError("Telegram API did not return message_id.")


def _to_jsonable(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json", exclude_none=True)
    return value
