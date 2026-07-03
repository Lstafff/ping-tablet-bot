from __future__ import annotations

import logging
from typing import Any, Optional, Protocol

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import InlineKeyboardMarkup, InputRichMessage, Message


class MessageStateStorage(Protocol):
    def get_last_message_id(self, user_id: int) -> Optional[int]:
        ...

    def set_last_message_id(self, user_id: int, message_id: int) -> None:
        ...


class RichRenderer:
    def __init__(self, storage: MessageStateStorage) -> None:
        self.storage = storage

    async def render(
        self,
        bot: Bot,
        chat_id: int,
        user_id: int,
        text: str,
        reply_markup: InlineKeyboardMarkup,
        force_new: bool = False,
    ) -> None:
        last_message_id = self.storage.get_last_message_id(user_id)
        if force_new and last_message_id is not None:
            await delete_message_by_id(bot, chat_id, last_message_id)

        if not force_new and last_message_id is not None:
            try:
                message_id = await render_rich_message(bot, chat_id, text, reply_markup, last_message_id)
                self.storage.set_last_message_id(user_id, message_id)
                return
            except Exception as error:
                logging.exception("Failed to render rich message")
                if is_message_not_modified(error):
                    return
                await delete_message_by_id(bot, chat_id, last_message_id)

        message_id = await render_rich_message(bot, chat_id, text, reply_markup, None)
        self.storage.set_last_message_id(user_id, message_id)


async def render_rich_message(
    bot: Bot,
    chat_id: int,
    rich_html: str,
    reply_markup: InlineKeyboardMarkup,
    last_message_id: Optional[int],
) -> int:
    telegram_rich_html = rich_html.replace("\n", "<br/>")

    if last_message_id is not None:
        try:
            result = await bot.edit_message_text(
                chat_id=chat_id,
                message_id=last_message_id,
                rich_message=InputRichMessage(html=telegram_rich_html),
                reply_markup=reply_markup,
                parse_mode=None,
            )
            return message_id_from_result(result, last_message_id)
        except Exception as error:
            if is_message_not_modified(error):
                await update_reply_markup(bot, chat_id, last_message_id, reply_markup)
                return last_message_id

    sent = await bot.send_rich_message(
        chat_id=chat_id,
        rich_message=InputRichMessage(html=telegram_rich_html),
        reply_markup=reply_markup,
    )
    new_message_id = message_id_from_result(sent, None)

    if last_message_id is not None and new_message_id != last_message_id:
        await delete_message_by_id(bot, chat_id, last_message_id)

    return new_message_id


async def delete_message(bot: Bot, message: Message) -> None:
    await delete_message_by_id(bot, message.chat.id, message.message_id)


async def delete_message_by_id(bot: Bot, chat_id: int, message_id: int) -> None:
    try:
        await bot.delete_message(chat_id, message_id)
    except TelegramBadRequest:
        pass


def is_message_not_modified(error: Exception) -> bool:
    return "message is not modified" in str(error).lower()


async def update_reply_markup(
    bot: Bot,
    chat_id: int,
    message_id: int,
    reply_markup: InlineKeyboardMarkup,
) -> None:
    try:
        await bot.edit_message_reply_markup(chat_id=chat_id, message_id=message_id, reply_markup=reply_markup)
    except Exception as error:
        if not is_message_not_modified(error):
            raise


def message_id_from_result(result: Any, fallback: Optional[int]) -> int:
    message_id = getattr(result, "message_id", None)
    if isinstance(message_id, int):
        return message_id
    if fallback is not None:
        return fallback
    raise RuntimeError("Telegram API did not return message_id.")
