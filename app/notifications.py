from __future__ import annotations

import logging

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError

from app import texts
from app.domain import display_user_name
from app.keyboards import main_menu_keyboard
from app.rendering import RichRenderer
from app.storage import Database


async def notify_inviter_about_new_opponent(
    bot: Bot,
    database: Database,
    inviter_id: int,
    invited_user_id: int,
) -> None:
    invited_user = database.get_user(invited_user_id)
    invited_name = display_user_name(invited_user.first_name, invited_user.username)
    try:
        await RichRenderer(database).render(
            bot,
            inviter_id,
            inviter_id,
            texts.invite_new_opponent_notification(invited_name),
            main_menu_keyboard(True),
        )
    except TelegramAPIError:
        logging.exception("Failed to notify inviter about a new opponent")
