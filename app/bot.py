import asyncio
import logging
from typing import Optional

from aiogram import Bot, Dispatcher, F, Router
from aiogram.exceptions import TelegramAPIError
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, Message, User as TelegramUser

from app import texts
from app.callbacks import (
    parse_callback_id,
    parse_score_undo_callback,
    parse_stats_days_callback,
    parse_stats_games_callback,
)
from app.config import load_config
from app.keyboards import (
    back_to_opponent_keyboard,
    back_to_main_keyboard,
    back_to_profile_keyboard,
    delete_opponent_keyboard,
    edit_keyboard,
    invite_keyboard,
    main_menu_keyboard,
    opponent_daily_stats_keyboard,
    opponent_games_stats_keyboard,
    opponent_keyboard,
    opponent_total_stats_keyboard,
    opponents_keyboard,
    profile_keyboard,
    rating_keyboard,
    reset_stats_keyboard,
    score_saved_keyboard,
)
from app.rendering import RichRenderer, delete_message
from app.scoring import ScoreError
from app.services import (
    INVITE_ACCEPTED,
    INVITE_INVALID,
    INVITE_SELF,
    RATING_EMPTY,
    RATING_INVALID,
    TennisService,
)
from app.states import (
    SESSION_EDIT_GAMES,
    SESSION_EDIT_POINTS,
    SESSION_INVITE_CODE,
    SESSION_RATING,
    SESSION_SCORE,
)
from app.storage import Database


router = Router()
db: Optional[Database] = None
renderer: Optional[RichRenderer] = None
service: Optional[TennisService] = None


@router.message(CommandStart())
async def start(message: Message, bot: Bot) -> None:
    if message.from_user is None:
        return
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
    if message.from_user is None:
        return
    user_id = message.from_user.id
    ensure_user(message.from_user)
    await delete_message(bot, message)
    await show_main_menu(bot, message.chat.id, user_id, force_new=True)


@router.callback_query(F.data == "main")
async def main_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    user_id = callback.from_user.id
    get_service().clear_session(user_id)
    await show_main_menu(bot, callback.message.chat.id, user_id)


@router.callback_query(F.data == "profile")
async def profile_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    get_service().clear_session(callback.from_user.id)
    await show_profile(bot, callback.message.chat.id, callback.from_user.id)


@router.callback_query(F.data == "noop")
async def noop_callback(callback: CallbackQuery) -> None:
    await callback.answer()


@router.callback_query(F.data == "invite")
async def invite_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    bot_info = await bot.get_me()
    invite = get_service().create_invite(callback.from_user.id, bot_info.username or "")
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.invite(invite.link, invite.code),
        invite_keyboard(invite.link),
    )


@router.callback_query(F.data == "invite_code")
async def invite_code_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    get_service().start_invite_code_input(callback.from_user.id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.invite_code_prompt(),
        back_to_main_keyboard(),
    )


@router.callback_query(F.data == "rating")
async def rating_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    view = get_service().start_rating_input(callback.from_user.id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.rating_prompt(),
        rating_keyboard(view.has_rating),
    )


@router.callback_query(F.data == "levels")
async def levels_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    get_service().clear_session(callback.from_user.id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.levels_info(),
        back_to_profile_keyboard(),
    )


@router.callback_query(F.data == "rating_clear")
async def rating_clear_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    get_service().clear_rating(callback.from_user.id)
    await show_profile(bot, callback.message.chat.id, callback.from_user.id)


@router.callback_query(F.data == "opponents")
async def opponents_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    await show_opponents(bot, callback.message.chat.id, callback.from_user.id)


@router.callback_query(F.data.startswith("opponent:"))
async def opponent_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = parse_callback_id(callback.data, "opponent:")
    if opponent_id is None:
        return
    get_service().clear_session(callback.from_user.id)
    await show_opponent(bot, callback.message.chat.id, callback.from_user.id, opponent_id)


@router.callback_query(F.data.startswith("score_undo:"))
async def score_undo_callback(callback: CallbackQuery, bot: Bot) -> None:
    ensure_user(callback.from_user)
    parsed_callback = parse_score_undo_callback(callback.data)
    if parsed_callback is None:
        await callback.answer("Кнопка устарела.")
        return
    opponent_id, game_id = parsed_callback
    result = get_service().undo_score(callback.from_user.id, opponent_id, game_id)
    if not result.deleted:
        await callback.answer("Этот счёт уже отменён.")
        return

    await callback.answer()
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.score_undone(
            result.opponent_name,
            result.recent_games,
            result.user_name,
        ),
        opponent_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("edit:"))
async def edit_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = parse_callback_id(callback.data, "edit:")
    if opponent_id is None:
        return
    view = get_service().get_edit_menu(callback.from_user.id, opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.edit_menu(
            view.opponent_name,
            view.stats,
            view.user_name,
        ),
        edit_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("stats_total:"))
async def stats_total_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = parse_callback_id(callback.data, "stats_total:")
    if opponent_id is None:
        return
    get_service().clear_session(callback.from_user.id)
    await show_opponent_total_stats(bot, callback.message.chat.id, callback.from_user.id, opponent_id)


@router.callback_query(F.data.startswith("stats_days:"))
async def stats_days_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    parsed_callback = parse_stats_days_callback(callback.data)
    if parsed_callback is None:
        return
    opponent_id, page = parsed_callback
    get_service().clear_session(callback.from_user.id)
    await show_opponent_daily_stats(bot, callback.message.chat.id, callback.from_user.id, opponent_id, page)


@router.callback_query(F.data.startswith("stats_games:"))
async def stats_games_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    parsed_callback = parse_stats_games_callback(callback.data)
    if parsed_callback is None:
        return
    opponent_id, page = parsed_callback
    get_service().clear_session(callback.from_user.id)
    await show_opponent_games_stats(bot, callback.message.chat.id, callback.from_user.id, opponent_id, page)


@router.callback_query(F.data.startswith("edit_games:"))
async def edit_games_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = parse_callback_id(callback.data, "edit_games:")
    if opponent_id is None:
        return
    view = get_service().start_edit_games_input(callback.from_user.id, opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.edit_games_prompt(view.opponent_name),
        back_to_opponent_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("edit_points:"))
async def edit_points_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = parse_callback_id(callback.data, "edit_points:")
    if opponent_id is None:
        return
    view = get_service().start_edit_points_input(callback.from_user.id, opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.edit_points_prompt(view.opponent_name),
        back_to_opponent_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("delete:"))
async def delete_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = parse_callback_id(callback.data, "delete:")
    if opponent_id is None:
        return
    view = get_service().get_opponent_view(callback.from_user.id, opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.delete_opponent_confirm(view.opponent_name),
        delete_opponent_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("reset:"))
async def reset_stats_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = parse_callback_id(callback.data, "reset:")
    if opponent_id is None:
        return
    view = get_service().get_opponent_view(callback.from_user.id, opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.reset_stats_confirm(view.opponent_name),
        reset_stats_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("reset_confirm:"))
async def reset_stats_confirm_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = parse_callback_id(callback.data, "reset_confirm:")
    if opponent_id is None:
        return
    result = get_service().reset_opponent_stats(callback.from_user.id, opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.reset_stats_done(result.opponent_name),
        opponent_keyboard(opponent_id),
    )


@router.callback_query(F.data.startswith("delete_confirm:"))
async def delete_confirm_callback(callback: CallbackQuery, bot: Bot) -> None:
    await callback.answer()
    ensure_user(callback.from_user)
    opponent_id = parse_callback_id(callback.data, "delete_confirm:")
    if opponent_id is None:
        return
    result = get_service().delete_opponent(callback.from_user.id, opponent_id)
    await render(
        bot,
        callback.message.chat.id,
        callback.from_user.id,
        texts.delete_opponent_done(result.opponent_name),
        main_menu_keyboard(result.has_opponents),
    )


@router.message()
async def text_message(message: Message, bot: Bot) -> None:
    if message.from_user is None:
        return
    user_id = message.from_user.id
    ensure_user(message.from_user)
    await delete_message(bot, message)

    session = get_service().get_session(user_id)
    if session is None:
        return

    if session.mode == SESSION_INVITE_CODE:
        await handle_invite_code_input(message, bot, user_id)
        return

    if session.mode == SESSION_RATING:
        await handle_rating_input(message, bot, user_id)
        return

    if session.opponent_id is None:
        return

    if session.mode == SESSION_SCORE:
        await handle_score_input(message, bot, user_id, session.opponent_id)
        return

    if session.mode == SESSION_EDIT_GAMES:
        await handle_edit_games_input(message, bot, user_id, session.opponent_id)
        return

    if session.mode == SESSION_EDIT_POINTS:
        await handle_edit_points_input(message, bot, user_id, session.opponent_id)
        return

    get_service().clear_session(user_id)


async def handle_invite_code_input(message: Message, bot: Bot, user_id: int) -> None:
    result = get_service().accept_invite(message.text or "", user_id)
    if result.status == INVITE_INVALID:
        await render(bot, message.chat.id, user_id, texts.INVITE_CODE_INVALID_TEXT, back_to_main_keyboard())
        return

    get_service().clear_session(user_id)
    if result.status == INVITE_SELF:
        text = texts.INVITE_SELF_TEXT
    elif result.status == INVITE_ACCEPTED:
        text = texts.INVITE_ACCEPTED_TEXT
        if result.inviter_id is not None:
            await notify_inviter_about_new_opponent(bot, result.inviter_id, user_id)
    else:
        text = texts.INVITE_ALREADY_CONNECTED_TEXT

    await render(bot, message.chat.id, user_id, text, main_menu_keyboard(result.has_opponents))


async def handle_rating_input(message: Message, bot: Bot, user_id: int) -> None:
    result = await get_service().submit_rating_input(user_id, message.text or "")
    if result.status == RATING_EMPTY:
        await render(bot, message.chat.id, user_id, texts.rating_prompt(), rating_keyboard(result.has_rating))
        return

    if result.status == RATING_INVALID:
        await render(bot, message.chat.id, user_id, texts.rating_input_error(), rating_keyboard(result.has_rating))
        return

    await show_profile(bot, message.chat.id, user_id)


async def handle_score_input(message: Message, bot: Bot, user_id: int, opponent_id: int) -> None:
    result = get_service().submit_score(user_id, opponent_id, message.text or "")
    if result.error is not None:
        await render(
            bot,
            message.chat.id,
            user_id,
            texts.score_input_error(result.opponent_name, result.error),
            opponent_keyboard(opponent_id),
        )
        return

    if result.score is None or result.game_id is None:
        raise RuntimeError("Score service returned an incomplete successful result.")

    await render(
        bot,
        message.chat.id,
        user_id,
        texts.score_saved(
            result.opponent_name,
            result.score,
            result.recent_games,
            result.user_name,
        ),
        score_saved_keyboard(opponent_id, result.game_id),
    )


async def handle_edit_games_input(message: Message, bot: Bot, user_id: int, opponent_id: int) -> None:
    try:
        get_service().set_games_total_from_input(user_id, opponent_id, message.text or "")
    except ScoreError as error:
        await render(bot, message.chat.id, user_id, texts.plain_error(error), back_to_opponent_keyboard(opponent_id))
        return

    await show_opponent(bot, message.chat.id, user_id, opponent_id)


async def handle_edit_points_input(message: Message, bot: Bot, user_id: int, opponent_id: int) -> None:
    try:
        get_service().set_points_total_from_input(user_id, opponent_id, message.text or "")
    except ScoreError as error:
        await render(bot, message.chat.id, user_id, texts.plain_error(error), back_to_opponent_keyboard(opponent_id))
        return

    await show_opponent(bot, message.chat.id, user_id, opponent_id)


async def show_main_menu(bot: Bot, chat_id: int, user_id: int, force_new: bool = False) -> None:
    view = get_service().get_main_menu(user_id)
    await render(bot, chat_id, user_id, texts.MAIN_MENU_TEXT, main_menu_keyboard(view.has_opponents), force_new=force_new)


async def show_opponents(bot: Bot, chat_id: int, user_id: int) -> None:
    opponents = get_service().list_opponents(user_id)
    if not opponents:
        await show_main_menu(bot, chat_id, user_id)
        return
    await render(bot, chat_id, user_id, texts.OPPONENTS_MENU_TEXT, opponents_keyboard(opponents))


async def show_opponent(bot: Bot, chat_id: int, user_id: int, opponent_id: int) -> None:
    view = get_service().start_score_input(user_id, opponent_id)
    await render(
        bot,
        chat_id,
        user_id,
        texts.score_prompt(view.opponent_name),
        opponent_keyboard(opponent_id),
    )


async def show_opponent_total_stats(bot: Bot, chat_id: int, user_id: int, opponent_id: int) -> None:
    view = get_service().get_opponent_total_stats(user_id, opponent_id)
    await render(
        bot,
        chat_id,
        user_id,
        texts.opponent_stats(
            view.opponent_name,
            view.stats,
            view.user_name,
            view.extended_stats,
        ),
        opponent_total_stats_keyboard(opponent_id),
    )


async def show_opponent_daily_stats(bot: Bot, chat_id: int, user_id: int, opponent_id: int, page: int = 1) -> None:
    view = get_service().get_opponent_daily_stats(user_id, opponent_id, page)
    await render(
        bot,
        chat_id,
        user_id,
        texts.opponent_daily_stats(
            view.opponent_name,
            view.daily_stats,
            view.user_name,
        ),
        opponent_daily_stats_keyboard(opponent_id, view.page, view.total_pages),
    )


async def show_opponent_games_stats(bot: Bot, chat_id: int, user_id: int, opponent_id: int, page: int = 1) -> None:
    view = get_service().get_opponent_games_stats(user_id, opponent_id, page)
    await render(
        bot,
        chat_id,
        user_id,
        texts.opponent_games_stats(
            view.opponent_name,
            view.games,
            view.user_name,
        ),
        opponent_games_stats_keyboard(opponent_id, view.page, view.total_pages),
    )


async def show_profile(bot: Bot, chat_id: int, user_id: int) -> None:
    view = get_service().get_profile(user_id)
    await render(
        bot,
        chat_id,
        user_id,
        texts.profile(view.user, view.stats, view.extended_stats),
        profile_keyboard(),
    )


async def accept_invite_flow(message: Message, token: str, bot: Bot, force_new: bool = False) -> None:
    user_id = message.from_user.id
    result = get_service().accept_invite(token, user_id)
    if result.status == INVITE_INVALID:
        text = texts.INVITE_INVALID_TEXT
    elif result.status == INVITE_SELF:
        text = texts.INVITE_SELF_TEXT
    elif result.status == INVITE_ACCEPTED:
        text = texts.INVITE_ACCEPTED_TEXT
        if result.inviter_id is not None:
            await notify_inviter_about_new_opponent(bot, result.inviter_id, user_id)
    else:
        text = texts.INVITE_ALREADY_CONNECTED_TEXT
    await render(bot, message.chat.id, user_id, text, main_menu_keyboard(result.has_opponents), force_new=force_new)


async def notify_inviter_about_new_opponent(bot: Bot, inviter_id: int, invited_user_id: int) -> None:
    invited_name = get_service().get_invited_user_name(invited_user_id)
    try:
        await render(
            bot,
            inviter_id,
            inviter_id,
            texts.invite_new_opponent_notification(invited_name),
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
    if renderer is None:
        raise RuntimeError("Renderer is not initialized.")
    await renderer.render(bot, chat_id, user_id, text, reply_markup, force_new=force_new)


def get_service() -> TennisService:
    if service is None:
        raise RuntimeError("Service is not initialized.")
    return service


def ensure_user(user: Optional[TelegramUser]) -> None:
    if user is None:
        return
    get_service().ensure_user(user.id, user.first_name, user.username)


def parse_start_payload(text: str) -> str:
    parts = text.split(maxsplit=1)
    if len(parts) < 2:
        return ""
    return parts[1].strip()


async def main() -> None:
    global db, renderer, service
    logging.basicConfig(level=logging.INFO)
    config = load_config()
    db = Database(config.database_url)
    service = TennisService(db, seed_test_opponent=config.seed_test_opponent)
    renderer = RichRenderer(db)

    bot = Bot(token=config.bot_token)
    dispatcher = Dispatcher()
    dispatcher.include_router(router)
    try:
        await dispatcher.start_polling(bot)
    finally:
        await bot.session.close()
        if db is not None:
            db.close()


if __name__ == "__main__":
    asyncio.run(main())
