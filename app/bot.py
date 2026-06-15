import asyncio
import logging
from typing import Optional

from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, Message, User as TelegramUser

from app import texts
from app.config import load_config
from app.keyboards import (
    back_to_opponent_keyboard,
    edit_keyboard,
    invite_keyboard,
    main_menu_keyboard,
    opponent_keyboard,
    opponents_keyboard,
)
from app.scoring import ScoreError, parse_pair, parse_score
from app.storage import Database


router = Router()
db: Optional[Database] = None
seed_test_opponent = True


@router.message(CommandStart())
async def start(message: Message, bot: Bot) -> None:
    user_id = message.from_user.id
    ensure_user(message.from_user)
    await delete_message(bot, message)

    payload = parse_start_payload(message.text or "")
    if payload.startswith("invite_"):
        await accept_invite_flow(message, payload.removeprefix("invite_"), bot)
        return

    await show_main_menu(bot, message.chat.id, user_id)


@router.message(Command("menu"))
async def menu(message: Message, bot: Bot) -> None:
    user_id = message.from_user.id
    ensure_user(message.from_user)
    await delete_message(bot, message)
    await show_main_menu(bot, message.chat.id, user_id)


@router.callback_query(F.data == "main")
async def main_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    user_id = callback.from_user.id
    db.clear_session(user_id)
    await show_main_menu(bot, callback.message.chat.id, user_id)


@router.callback_query(F.data == "stats_all")
async def stats_all_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    stats = db.get_total_stats(callback.from_user.id)
    has_opponents = bool(db.list_opponents(callback.from_user.id))
    await render(bot, callback.message.chat.id, callback.from_user.id, texts.total_stats(stats), main_menu_keyboard(has_opponents))


@router.callback_query(F.data == "invite")
async def invite_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    token = db.create_invite(callback.from_user.id)
    bot_info = await bot.get_me()
    invite_link = f"https://t.me/{bot_info.username}?start=invite_{token}"
    await render(bot, callback.message.chat.id, callback.from_user.id, texts.invite(invite_link), invite_keyboard())


@router.callback_query(F.data == "opponents")
async def opponents_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    await show_opponents(bot, callback.message.chat.id, callback.from_user.id)


@router.callback_query(F.data.startswith("opponent:"))
async def opponent_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = int(callback.data.split(":", 1)[1])
    db.clear_session(callback.from_user.id)
    await show_opponent(bot, callback.message.chat.id, callback.from_user.id, opponent_id)


@router.callback_query(F.data.startswith("score_add:"))
async def score_add_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = int(callback.data.split(":", 1)[1])
    opponent = db.get_opponent(callback.from_user.id, opponent_id)
    db.set_session(callback.from_user.id, "await_score", opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.score_prompt(texts.opponent_title(opponent)),
        back_to_opponent_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("edit:"))
async def edit_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = int(callback.data.split(":", 1)[1])
    opponent = db.get_opponent(callback.from_user.id, opponent_id)
    stats = db.get_opponent_stats(callback.from_user.id, opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.edit_menu(texts.opponent_title(opponent), stats),
        edit_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("edit_games:"))
async def edit_games_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = int(callback.data.split(":", 1)[1])
    opponent = db.get_opponent(callback.from_user.id, opponent_id)
    db.set_session(callback.from_user.id, "await_edit_games", opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.edit_games_prompt(texts.opponent_title(opponent)),
        back_to_opponent_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("edit_points:"))
async def edit_points_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = int(callback.data.split(":", 1)[1])
    opponent = db.get_opponent(callback.from_user.id, opponent_id)
    db.set_session(callback.from_user.id, "await_edit_points", opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.edit_points_prompt(texts.opponent_title(opponent)),
        back_to_opponent_keyboard(opponent_id),
    )


@router.message()
async def text_message(message: Message, bot: Bot) -> None:
    user_id = message.from_user.id
    ensure_user(message.from_user)
    await delete_message(bot, message)

    session = db.get_session(user_id)
    if session is None or session.opponent_id is None:
        await show_main_menu(bot, message.chat.id, user_id)
        return

    if session.mode == "await_score":
        await handle_score_input(message, bot, user_id, session.opponent_id)
        return

    if session.mode == "await_edit_games":
        await handle_edit_games_input(message, bot, user_id, session.opponent_id)
        return

    if session.mode == "await_edit_points":
        await handle_edit_points_input(message, bot, user_id, session.opponent_id)
        return

    db.clear_session(user_id)
    await show_main_menu(bot, message.chat.id, user_id)


async def handle_score_input(message: Message, bot: Bot, user_id: int, opponent_id: int) -> None:
    opponent = db.get_opponent(user_id, opponent_id)
    try:
        score = parse_score(message.text or "")
    except ScoreError as error:
        await render(
            bot,
            message.chat.id,
            user_id,
            texts.score_input_error(texts.opponent_title(opponent), error),
            back_to_opponent_keyboard(opponent_id),
        )
        return

    db.add_game(user_id, opponent_id, score)
    stats = db.get_opponent_stats(user_id, opponent_id)
    await render(
        bot,
        message.chat.id,
        user_id,
        texts.score_saved(texts.opponent_title(opponent), score, stats),
        back_to_opponent_keyboard(opponent_id),
    )


async def handle_edit_games_input(message: Message, bot: Bot, user_id: int, opponent_id: int) -> None:
    try:
        wins, losses = parse_pair(message.text or "", "8-5")
    except ScoreError as error:
        await render(bot, message.chat.id, user_id, texts.plain_error(error), back_to_opponent_keyboard(opponent_id))
        return

    db.set_games_total(user_id, opponent_id, wins, losses)
    db.clear_session(user_id)
    await show_opponent(bot, message.chat.id, user_id, opponent_id)


async def handle_edit_points_input(message: Message, bot: Bot, user_id: int, opponent_id: int) -> None:
    try:
        points_for, points_against = parse_pair(message.text or "", "132-118")
    except ScoreError as error:
        await render(bot, message.chat.id, user_id, texts.plain_error(error), back_to_opponent_keyboard(opponent_id))
        return

    db.set_points_total(user_id, opponent_id, points_for, points_against)
    db.clear_session(user_id)
    await show_opponent(bot, message.chat.id, user_id, opponent_id)


async def show_main_menu(bot: Bot, chat_id: int, user_id: int) -> None:
    opponents = db.list_opponents(user_id)
    await render(bot, chat_id, user_id, texts.MAIN_MENU_TEXT, main_menu_keyboard(bool(opponents)))


async def show_opponents(bot: Bot, chat_id: int, user_id: int) -> None:
    opponents = db.list_opponents(user_id)
    if not opponents:
        await show_main_menu(bot, chat_id, user_id)
        return
    await render(bot, chat_id, user_id, texts.OPPONENTS_MENU_TEXT, opponents_keyboard(opponents))


async def show_opponent(bot: Bot, chat_id: int, user_id: int, opponent_id: int) -> None:
    opponent = db.get_opponent(user_id, opponent_id)
    stats = db.get_opponent_stats(user_id, opponent_id)
    await render(bot, chat_id, user_id, texts.opponent_stats(texts.opponent_title(opponent), stats), opponent_keyboard(opponent_id))


async def accept_invite_flow(message: Message, token: str, bot: Bot) -> None:
    user_id = message.from_user.id
    inviter_id = db.accept_invite(token, user_id)
    if inviter_id is None:
        text = texts.INVITE_INVALID_TEXT
    elif inviter_id == user_id:
        text = texts.INVITE_SELF_TEXT
    else:
        text = texts.INVITE_ACCEPTED_TEXT
    has_opponents = bool(db.list_opponents(user_id))
    await render(bot, message.chat.id, user_id, text, main_menu_keyboard(has_opponents))


async def render(
    bot: Bot,
    chat_id: int,
    user_id: int,
    text: str,
    reply_markup: InlineKeyboardMarkup,
) -> None:
    user = db.get_user(user_id)
    if user.last_message_id is not None:
        try:
            await bot.edit_message_text(
                chat_id=chat_id,
                message_id=user.last_message_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode=ParseMode.HTML,
            )
            return
        except TelegramBadRequest as error:
            if "message is not modified" in str(error).lower():
                return

    sent = await bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=reply_markup,
        parse_mode=ParseMode.HTML,
    )
    db.set_last_message_id(user_id, sent.message_id)


async def delete_message(bot: Bot, message: Message) -> None:
    try:
        await bot.delete_message(message.chat.id, message.message_id)
    except TelegramBadRequest:
        pass


def ensure_user(user: Optional[TelegramUser]) -> None:
    if user is None:
        return
    db.ensure_user(user.id, user.first_name or texts.DEFAULT_USER_NAME, user.username)
    if seed_test_opponent:
        db.ensure_test_opponent(user.id)


def parse_start_payload(text: str) -> str:
    parts = text.split(maxsplit=1)
    if len(parts) < 2:
        return ""
    return parts[1].strip()


async def main() -> None:
    global db, seed_test_opponent
    logging.basicConfig(level=logging.INFO)
    config = load_config()
    seed_test_opponent = config.seed_test_opponent
    db = Database(config.database_path)

    bot = Bot(token=config.bot_token)
    dispatcher = Dispatcher()
    dispatcher.include_router(router)
    await dispatcher.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
