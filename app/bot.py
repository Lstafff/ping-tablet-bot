import asyncio
import html
import logging
from typing import Optional

from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, Message, User as TelegramUser

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
from app.storage import Database, Stats


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
    text = (
        "<b>Общая статистика</b>\n\n"
        f"Партии: {stats.games}\n"
        f"Победы-поражения: {stats.wins}-{stats.losses}\n"
        f"Мячи: {stats.points_for}-{stats.points_against}\n"
        f"Всего мячей: {stats.points_for + stats.points_against}"
    )
    has_opponents = bool(db.list_opponents(callback.from_user.id))
    await render(bot, callback.message.chat.id, callback.from_user.id, text, main_menu_keyboard(has_opponents))


@router.callback_query(F.data == "invite")
async def invite_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    token = db.create_invite(callback.from_user.id)
    bot_info = await bot.get_me()
    invite_link = f"https://t.me/{bot_info.username}?start=invite_{token}"
    text = (
        "<b>Приглашение соперника</b>\n\n"
        "Отправьте эту ссылку человеку, с которым хотите вести статистику:\n"
        f"<code>{html.escape(invite_link)}</code>\n\n"
        "Когда он откроет ссылку и запустит бота, вы появитесь друг у друга в списке соперников."
    )
    await render(bot, callback.message.chat.id, callback.from_user.id, text, invite_keyboard())


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
    text = (
        f"<b>{html.escape(opponent.name)}</b>\n\n"
        "Напишите результат партии: сначала ваш счет, потом счет соперника.\n"
        "Например: <code>11-7</code> или <code>15 13</code>."
    )
    await render(bot, callback.message.chat.id, callback.from_user.id, text, back_to_opponent_keyboard(opponent_id))


@router.callback_query(F.data.startswith("edit:"))
async def edit_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = int(callback.data.split(":", 1)[1])
    opponent = db.get_opponent(callback.from_user.id, opponent_id)
    stats = db.get_opponent_stats(callback.from_user.id, opponent_id)
    text = (
        f"<b>Редактирование: {html.escape(opponent.name)}</b>\n\n"
        f"Сейчас партии: {stats.wins}-{stats.losses}\n"
        f"Сейчас мячи: {stats.points_for}-{stats.points_against}"
    )
    await render(bot, callback.message.chat.id, callback.from_user.id, text, edit_keyboard(opponent_id))


@router.callback_query(F.data.startswith("edit_games:"))
async def edit_games_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = int(callback.data.split(":", 1)[1])
    opponent = db.get_opponent(callback.from_user.id, opponent_id)
    db.set_session(callback.from_user.id, "await_edit_games", opponent_id)
    text = (
        f"<b>Счет партий: {html.escape(opponent.name)}</b>\n\n"
        "Напишите общий счет по партиям: сначала ваши победы, потом поражения.\n"
        "Например: <code>8-5</code>."
    )
    await render(bot, callback.message.chat.id, callback.from_user.id, text, back_to_opponent_keyboard(opponent_id))


@router.callback_query(F.data.startswith("edit_points:"))
async def edit_points_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = int(callback.data.split(":", 1)[1])
    opponent = db.get_opponent(callback.from_user.id, opponent_id)
    db.set_session(callback.from_user.id, "await_edit_points", opponent_id)
    text = (
        f"<b>Количество мячей: {html.escape(opponent.name)}</b>\n\n"
        "Напишите общий счет по мячам: сначала ваши мячи, потом мячи соперника.\n"
        "Например: <code>132-118</code>."
    )
    await render(bot, callback.message.chat.id, callback.from_user.id, text, back_to_opponent_keyboard(opponent_id))


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
        text = (
            f"<b>{html.escape(opponent.name)}</b>\n\n"
            f"{html.escape(str(error))}\n\n"
            "Попробуйте еще раз: сначала ваш счет, потом счет соперника."
        )
        await render(bot, message.chat.id, user_id, text, back_to_opponent_keyboard(opponent_id))
        return

    db.add_game(user_id, opponent_id, score)
    stats = db.get_opponent_stats(user_id, opponent_id)

    overtime = ""
    if score.overtime_own or score.overtime_opponent:
        overtime = (
            "\nРазбивка: "
            f"{score.regular_own}-{score.regular_opponent} в основное время, "
            f"{score.overtime_own}-{score.overtime_opponent} в овертайме."
        )

    text = (
        f"<b>{html.escape(opponent.name)}</b>\n\n"
        f"Сохранено: {score.own_score}-{score.opponent_score}.{overtime}\n\n"
        f"Текущая статистика: {format_stats(stats)}\n\n"
        "Можно сразу написать следующий результат."
    )
    await render(bot, message.chat.id, user_id, text, back_to_opponent_keyboard(opponent_id))


async def handle_edit_games_input(message: Message, bot: Bot, user_id: int, opponent_id: int) -> None:
    try:
        wins, losses = parse_pair(message.text or "", "8-5")
    except ScoreError as error:
        await render(bot, message.chat.id, user_id, html.escape(str(error)), back_to_opponent_keyboard(opponent_id))
        return

    db.set_games_total(user_id, opponent_id, wins, losses)
    db.clear_session(user_id)
    await show_opponent(bot, message.chat.id, user_id, opponent_id)


async def handle_edit_points_input(message: Message, bot: Bot, user_id: int, opponent_id: int) -> None:
    try:
        points_for, points_against = parse_pair(message.text or "", "132-118")
    except ScoreError as error:
        await render(bot, message.chat.id, user_id, html.escape(str(error)), back_to_opponent_keyboard(opponent_id))
        return

    db.set_points_total(user_id, opponent_id, points_for, points_against)
    db.clear_session(user_id)
    await show_opponent(bot, message.chat.id, user_id, opponent_id)


async def show_main_menu(bot: Bot, chat_id: int, user_id: int) -> None:
    opponents = db.list_opponents(user_id)
    text = "<b>Главное меню</b>"
    await render(bot, chat_id, user_id, text, main_menu_keyboard(bool(opponents)))


async def show_opponents(bot: Bot, chat_id: int, user_id: int) -> None:
    opponents = db.list_opponents(user_id)
    if not opponents:
        await show_main_menu(bot, chat_id, user_id)
        return
    text = "<b>Соперники</b>\n\nВыберите соперника по имени."
    await render(bot, chat_id, user_id, text, opponents_keyboard(opponents))


async def show_opponent(bot: Bot, chat_id: int, user_id: int, opponent_id: int) -> None:
    opponent = db.get_opponent(user_id, opponent_id)
    stats = db.get_opponent_stats(user_id, opponent_id)
    text = (
        f"<b>{html.escape(opponent.name)}</b>\n\n"
        f"{format_stats(stats)}"
    )
    await render(bot, chat_id, user_id, text, opponent_keyboard(opponent_id))


async def accept_invite_flow(message: Message, token: str, bot: Bot) -> None:
    user_id = message.from_user.id
    inviter_id = db.accept_invite(token, user_id)
    if inviter_id is None:
        text = "<b>Приглашение недействительно</b>\n\nСсылка уже использована или не найдена."
    elif inviter_id == user_id:
        text = "<b>Это ваше приглашение</b>\n\nОтправьте ссылку другому игроку."
    else:
        text = "<b>Готово</b>\n\nСоперник добавлен. Теперь можно вести статистику партий."
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
    db.ensure_user(user.id, user.first_name or "Игрок", user.username)
    if seed_test_opponent:
        db.ensure_test_opponent(user.id)


def parse_start_payload(text: str) -> str:
    parts = text.split(maxsplit=1)
    if len(parts) < 2:
        return ""
    return parts[1].strip()


def format_stats(stats: Stats) -> str:
    return (
        f"Партии: {stats.games}\n"
        f"Победы-поражения: {stats.wins}-{stats.losses}\n"
        f"Мячи: {stats.points_for}-{stats.points_against}\n"
        f"Всего мячей: {stats.points_for + stats.points_against}"
    )


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
