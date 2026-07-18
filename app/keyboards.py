from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from app.domain import Opponent
from app import texts


def main_menu_keyboard(has_opponents: bool) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    if has_opponents:
        builder.button(text=texts.BUTTON_OPPONENTS, callback_data="opponents")
    builder.button(text=texts.BUTTON_INVITE_OPPONENT, callback_data="invite")
    builder.button(text=texts.BUTTON_TOTAL_STATS, callback_data="profile")
    builder.adjust(1)
    return builder.as_markup()


def profile_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_LEVELS, callback_data="levels", style="primary")
    builder.button(text=texts.BUTTON_RATING, callback_data="rating", style="primary")
    builder.button(text=texts.BUTTON_BACK, callback_data="main")
    builder.adjust(2, 1)
    return builder.as_markup()


def rating_keyboard(has_rating: bool) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    if has_rating:
        builder.button(text=texts.BUTTON_CLEAR_RATING, callback_data="rating_clear")
    builder.button(text=texts.BUTTON_BACK, callback_data="profile")
    builder.adjust(1)
    return builder.as_markup()


def opponents_keyboard(opponents: list[Opponent]) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for opponent in opponents:
        builder.button(text=texts.opponent_title(opponent), callback_data=f"opponent:{opponent.id}", style="primary")
    builder.button(text=texts.BUTTON_MAIN_MENU, callback_data="main")
    builder.adjust(1)
    return builder.as_markup()


def back_to_main_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_BACK, callback_data="main")
    builder.adjust(1)
    return builder.as_markup()


def back_to_profile_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_BACK, callback_data="profile")
    builder.adjust(1)
    return builder.as_markup()


def opponent_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_OPPONENT_DAILY_STATS, callback_data=f"stats_total:{opponent_id}", style="primary")
    builder.button(text=texts.BUTTON_BACK, callback_data="opponents")
    builder.adjust(1)
    return builder.as_markup()


def opponent_total_stats_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_STATS_GENERAL_ACTIVE, callback_data="noop", style="success")
    builder.button(text=texts.BUTTON_STATS_DAILY, callback_data=f"stats_days:{opponent_id}")
    builder.button(text=texts.BUTTON_STATS_GAMES, callback_data=f"stats_games:{opponent_id}")
    builder.button(text=texts.BUTTON_EDIT, callback_data=f"edit:{opponent_id}", style="primary")
    builder.button(text=texts.BUTTON_BACK, callback_data=f"opponent:{opponent_id}")
    builder.adjust(3, 1, 1)
    return builder.as_markup()


def opponent_daily_stats_keyboard(opponent_id: int, page: int, total_pages: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_STATS_GENERAL, callback_data=f"stats_total:{opponent_id}")
    builder.button(text=texts.BUTTON_STATS_DAILY_ACTIVE, callback_data="noop", style="success")
    builder.button(text=texts.BUTTON_STATS_GAMES, callback_data=f"stats_games:{opponent_id}")
    if total_pages > 1:
        has_previous_page = page > 1
        has_next_page = page < total_pages
        previous_callback = f"stats_days:{opponent_id}:{page - 1}" if has_previous_page else "noop"
        next_callback = f"stats_days:{opponent_id}:{page + 1}" if has_next_page else "noop"
        builder.button(text="⬅️", callback_data=previous_callback, style="primary" if has_previous_page else None)
        builder.button(text=f"{page} / {total_pages}", callback_data="noop")
        builder.button(text="➡️", callback_data=next_callback, style="primary" if has_next_page else None)
    builder.button(text=texts.BUTTON_BACK, callback_data=f"opponent:{opponent_id}")
    if total_pages > 1:
        builder.adjust(3, 3, 1)
    else:
        builder.adjust(3, 1)
    return builder.as_markup()


def opponent_games_stats_keyboard(opponent_id: int, page: int, total_pages: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_STATS_GENERAL, callback_data=f"stats_total:{opponent_id}")
    builder.button(text=texts.BUTTON_STATS_DAILY, callback_data=f"stats_days:{opponent_id}")
    builder.button(text=texts.BUTTON_STATS_GAMES_ACTIVE, callback_data="noop", style="success")
    if total_pages > 1:
        has_previous_page = page > 1
        has_next_page = page < total_pages
        previous_callback = f"stats_games:{opponent_id}:{page - 1}" if has_previous_page else "noop"
        next_callback = f"stats_games:{opponent_id}:{page + 1}" if has_next_page else "noop"
        builder.button(text="⬅️", callback_data=previous_callback, style="primary" if has_previous_page else None)
        builder.button(text=f"{page} / {total_pages}", callback_data="noop")
        builder.button(text="➡️", callback_data=next_callback, style="primary" if has_next_page else None)
    builder.button(text=texts.BUTTON_BACK, callback_data=f"opponent:{opponent_id}")
    if total_pages > 1:
        builder.adjust(3, 3, 1)
    else:
        builder.adjust(3, 1)
    return builder.as_markup()


def delete_opponent_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_CONFIRM_DELETE_OPPONENT, callback_data=f"delete_confirm:{opponent_id}", style="danger")
    builder.button(text=texts.BUTTON_CANCEL, callback_data=f"edit:{opponent_id}")
    builder.adjust(1)
    return builder.as_markup()


def reset_stats_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_CONFIRM_RESET_STATS, callback_data=f"reset_confirm:{opponent_id}", style="danger")
    builder.button(text=texts.BUTTON_CANCEL, callback_data=f"edit:{opponent_id}")
    builder.adjust(1)
    return builder.as_markup()


def back_to_opponent_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_BACK, callback_data=f"edit:{opponent_id}")
    builder.adjust(1)
    return builder.as_markup()


def score_saved_keyboard(opponent_id: int, game_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_UNDO_SCORE, callback_data=f"score_undo:{opponent_id}:{game_id}", style="danger")
    builder.button(text=texts.BUTTON_OPPONENT_DAILY_STATS, callback_data=f"stats_total:{opponent_id}")
    builder.button(text=texts.BUTTON_BACK, callback_data=f"opponent:{opponent_id}")
    builder.adjust(1)
    return builder.as_markup()


def edit_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_EDIT_GAMES, callback_data=f"edit_games:{opponent_id}", style="primary")
    builder.button(text=texts.BUTTON_EDIT_POINTS, callback_data=f"edit_points:{opponent_id}", style="primary")
    builder.button(text=texts.BUTTON_RESET_STATS, callback_data=f"reset:{opponent_id}", style="danger")
    builder.button(text=texts.BUTTON_DELETE_OPPONENT, callback_data=f"delete:{opponent_id}", style="danger")
    builder.button(text=texts.BUTTON_BACK, callback_data=f"opponent:{opponent_id}")
    builder.adjust(2, 2, 1)
    return builder.as_markup()


def invite_keyboard(invite_link: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_SEND_INVITE, url=texts.invite_share_url(invite_link), style="primary")
    builder.button(text=texts.BUTTON_HAVE_INVITE_CODE, callback_data="invite_code", style="primary")
    builder.button(text=texts.BUTTON_MAIN_MENU, callback_data="main")
    builder.adjust(1)
    return builder.as_markup()
