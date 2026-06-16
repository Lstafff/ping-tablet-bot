import asyncio
import logging
from typing import Any, Optional

from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InputRichMessage, Message, User as TelegramUser

from app import texts
from app.config import load_config
from app.keyboards import (
    back_to_opponent_keyboard,
    back_to_main_keyboard,
    delete_opponent_keyboard,
    edit_keyboard,
    invite_keyboard,
    main_menu_keyboard,
    opponent_daily_stats_keyboard,
    opponent_keyboard,
    opponents_keyboard,
)
from app.scoring import ScoreError, parse_pair, parse_score
from app.storage import Database


router = Router()
db: Optional[Database] = None
seed_test_opponent = True
DAILY_STATS_PAGE_SIZE = 14


@router.message(CommandStart())
async def start(message: Message, bot: Bot) -> None:
    user_id = message.from_user.id
    ensure_user(message.from_user)
    await delete_message(bot, message)

    payload = parse_start_payload(message.text or "")
    if payload.startswith("invite_"):
        await accept_invite_flow(message, payload.removeprefix("invite_"), bot, force_new=True)
        return

    await show_main_menu(bot, message.chat.id, user_id, force_new=True)


@router.message(Command("menu"))
async def menu(message: Message, bot: Bot) -> None:
    user_id = message.from_user.id
    ensure_user(message.from_user)
    await delete_message(bot, message)
    await show_main_menu(bot, message.chat.id, user_id, force_new=True)


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
    await show_total_stats(bot, callback.message.chat.id, callback.from_user.id)


@router.callback_query(F.data == "noop")
async def noop_callback(callback: CallbackQuery) -> None:
    await callback.answer()


@router.callback_query(F.data == "invite")
async def invite_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    invite_code = db.get_or_create_invite_code(callback.from_user.id)
    bot_info = await bot.get_me()
    invite_link = f"https://t.me/{bot_info.username}?start=invite_{invite_code}"
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.invite(invite_link, invite_code),
        invite_keyboard(invite_link),
    )


@router.callback_query(F.data == "invite_code")
async def invite_code_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    db.set_session(callback.from_user.id, "await_invite_code", None)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.invite_code_prompt(),
        back_to_main_keyboard(),
    )


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
    user = db.get_user(callback.from_user.id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.edit_menu(
            texts.opponent_title(opponent),
            stats,
            texts.display_user_name(user.first_name, user.username),
        ),
        edit_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("stats_days:"))
async def stats_days_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    parts = callback.data.split(":")
    opponent_id = int(parts[1])
    page = int(parts[2]) if len(parts) > 2 else 1
    await show_opponent_daily_stats(bot, callback.message.chat.id, callback.from_user.id, opponent_id, page)


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


@router.callback_query(F.data.startswith("delete:"))
async def delete_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = int(callback.data.split(":", 1)[1])
    opponent = db.get_opponent(callback.from_user.id, opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.delete_opponent_confirm(texts.opponent_title(opponent)),
        delete_opponent_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("delete_confirm:"))
async def delete_confirm_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = int(callback.data.split(":", 1)[1])
    opponent = db.get_opponent(callback.from_user.id, opponent_id)
    opponent_name = texts.opponent_title(opponent)
    db.delete_opponent(callback.from_user.id, opponent_id)
    db.clear_session(callback.from_user.id)
    has_opponents = bool(db.list_opponents(callback.from_user.id))
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.delete_opponent_done(opponent_name),
        main_menu_keyboard(has_opponents),
    )


@router.message()
async def text_message(message: Message, bot: Bot) -> None:
    user_id = message.from_user.id
    ensure_user(message.from_user)
    await delete_message(bot, message)

    session = db.get_session(user_id)
    if session is None:
        return

    if session.mode == "await_invite_code":
        await handle_invite_code_input(message, bot, user_id)
        return

    if session.opponent_id is None:
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


async def handle_invite_code_input(message: Message, bot: Bot, user_id: int) -> None:
    acceptance = db.accept_invite(message.text or "", user_id)
    if acceptance is None:
        await render(bot, message.chat.id, user_id, texts.INVITE_CODE_INVALID_TEXT, back_to_main_keyboard())
        return

    db.clear_session(user_id)
    if acceptance.is_self_invite:
        text = texts.INVITE_SELF_TEXT
    elif acceptance.is_new_opponent:
        text = texts.INVITE_ACCEPTED_TEXT
        await notify_inviter_about_new_opponent(bot, acceptance.inviter_id, user_id)
    else:
        text = texts.INVITE_ALREADY_CONNECTED_TEXT

    has_opponents = bool(db.list_opponents(user_id))
    await render(bot, message.chat.id, user_id, text, main_menu_keyboard(has_opponents))


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
    user = db.get_user(user_id)
    await render(
        bot,
        message.chat.id,
        user_id,
        texts.score_saved(
            texts.opponent_title(opponent),
            score,
            stats,
            texts.display_user_name(user.first_name, user.username),
        ),
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


async def show_main_menu(bot: Bot, chat_id: int, user_id: int, force_new: bool = False) -> None:
    opponents = db.list_opponents(user_id)
    await render(bot, chat_id, user_id, texts.MAIN_MENU_TEXT, main_menu_keyboard(bool(opponents)), force_new=force_new)


async def show_opponents(bot: Bot, chat_id: int, user_id: int) -> None:
    opponents = db.list_opponents(user_id)
    if not opponents:
        await show_main_menu(bot, chat_id, user_id)
        return
    await render(bot, chat_id, user_id, texts.OPPONENTS_MENU_TEXT, opponents_keyboard(opponents))


async def show_opponent(bot: Bot, chat_id: int, user_id: int, opponent_id: int) -> None:
    opponent = db.get_opponent(user_id, opponent_id)
    stats = db.get_opponent_stats(user_id, opponent_id)
    user = db.get_user(user_id)
    await render(
        bot,
        chat_id,
        user_id,
        texts.opponent_stats(
            texts.opponent_title(opponent),
            stats,
            texts.display_user_name(user.first_name, user.username),
        ),
        opponent_keyboard(opponent_id),
    )


async def show_opponent_daily_stats(bot: Bot, chat_id: int, user_id: int, opponent_id: int, page: int = 1) -> None:
    opponent = db.get_opponent(user_id, opponent_id)
    daily_stats = db.get_opponent_daily_stats(user_id, opponent_id)
    user = db.get_user(user_id)
    total_pages = max(1, (len(daily_stats) + DAILY_STATS_PAGE_SIZE - 1) // DAILY_STATS_PAGE_SIZE)
    page = min(max(page, 1), total_pages)
    page_start = (page - 1) * DAILY_STATS_PAGE_SIZE
    page_daily_stats = daily_stats[page_start : page_start + DAILY_STATS_PAGE_SIZE]
    await render(
        bot,
        chat_id,
        user_id,
        texts.opponent_daily_stats(
            texts.opponent_title(opponent),
            page_daily_stats,
            texts.display_user_name(user.first_name, user.username),
        ),
        opponent_daily_stats_keyboard(opponent_id, page, total_pages),
    )


async def show_total_stats(bot: Bot, chat_id: int, user_id: int) -> None:
    stats = db.get_total_stats(user_id)
    keyboard = back_to_main_keyboard()
    try:
        user = db.get_user(user_id)
        message_id = await render_rich_message(
            bot,
            chat_id,
            texts.total_stats_rich_html(
                stats,
                texts.display_user_name(user.first_name, user.username),
            ),
            keyboard,
            user.last_message_id,
        )
        db.set_last_message_id(user_id, message_id)
    except Exception:
        logging.exception("Failed to render rich total stats")
        await render(bot, chat_id, user_id, texts.total_stats(stats), keyboard)


async def accept_invite_flow(message: Message, token: str, bot: Bot, force_new: bool = False) -> None:
    user_id = message.from_user.id
    acceptance = db.accept_invite(token, user_id)
    if acceptance is None:
        text = texts.INVITE_INVALID_TEXT
    elif acceptance.is_self_invite:
        text = texts.INVITE_SELF_TEXT
    elif acceptance.is_new_opponent:
        text = texts.INVITE_ACCEPTED_TEXT
        await notify_inviter_about_new_opponent(bot, acceptance.inviter_id, user_id)
    else:
        text = texts.INVITE_ALREADY_CONNECTED_TEXT
    has_opponents = bool(db.list_opponents(user_id))
    await render(bot, message.chat.id, user_id, text, main_menu_keyboard(has_opponents), force_new=force_new)


async def notify_inviter_about_new_opponent(bot: Bot, inviter_id: int, invited_user_id: int) -> None:
    invited = db.get_user(invited_user_id)
    try:
        await render(
            bot,
            inviter_id,
            inviter_id,
            texts.invite_new_opponent_notification(texts.display_user_name(invited.first_name, invited.username)),
            main_menu_keyboard(True),
        )
    except TelegramAPIError:
        logging.exception("Failed to notify inviter about a new opponent")


async def render(
    bot: Bot,
    chat_id: int,
    user_id: int,
    text: str,
    reply_markup: InlineKeyboardMarkup,
    force_new: bool = False,
) -> None:
    user = db.get_user(user_id)
    if force_new and user.last_message_id is not None:
        try:
            await bot.delete_message(chat_id, user.last_message_id)
        except TelegramBadRequest:
            pass

    if not force_new and user.last_message_id is not None:
        try:
            message_id = await render_rich_message(bot, chat_id, text, reply_markup, user.last_message_id)
            db.set_last_message_id(user_id, message_id)
            return
        except Exception as error:
            logging.exception("Failed to render rich message")
            if "message is not modified" in str(error).lower():
                return
            try:
                await bot.delete_message(chat_id, user.last_message_id)
            except TelegramBadRequest:
                pass

    try:
        message_id = await render_rich_message(bot, chat_id, text, reply_markup, None)
        db.set_last_message_id(user_id, message_id)
        return
    except Exception:
        logging.exception("Failed to send rich message")

    sent = await bot.send_message(
        chat_id=chat_id,
        text=texts.rich_to_basic_html(text),
        reply_markup=reply_markup,
        parse_mode=ParseMode.HTML,
    )
    db.set_last_message_id(user_id, sent.message_id)


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
            if "message is not modified" in str(error).lower():
                return last_message_id

    sent = await bot.send_rich_message(
        chat_id=chat_id,
        rich_message=InputRichMessage(html=telegram_rich_html),
        reply_markup=reply_markup,
    )
    new_message_id = message_id_from_result(sent, None)

    if last_message_id is not None and new_message_id != last_message_id:
        try:
            await bot.delete_message(chat_id, last_message_id)
        except TelegramAPIError:
            pass

    return new_message_id


def message_id_from_result(result: Any, fallback: Optional[int]) -> int:
    message_id = getattr(result, "message_id", None)
    if isinstance(message_id, int):
        return message_id
    if fallback is not None:
        return fallback
    raise RuntimeError("Telegram API did not return message_id.")


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
