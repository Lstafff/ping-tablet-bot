from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from app.storage import Opponent
from app import texts


def main_menu_keyboard(has_opponents: bool) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    if has_opponents:
        builder.button(text=texts.BUTTON_OPPONENTS, callback_data="opponents")
    else:
        builder.button(text=texts.BUTTON_INVITE_OPPONENT, callback_data="invite")
    builder.button(text=texts.BUTTON_TOTAL_STATS, callback_data="stats_all")
    builder.adjust(1)
    return builder.as_markup()


def opponents_keyboard(opponents: list[Opponent]) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for opponent in opponents:
        builder.button(text=opponent.name, callback_data=f"opponent:{opponent.id}")
    builder.button(text=texts.BUTTON_INVITE_OPPONENT, callback_data="invite")
    builder.button(text=texts.BUTTON_MAIN_MENU, callback_data="main")
    builder.adjust(1)
    return builder.as_markup()


def opponent_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_ADD_SCORE, callback_data=f"score_add:{opponent_id}")
    builder.button(text=texts.BUTTON_EDIT, callback_data=f"edit:{opponent_id}")
    builder.button(text=texts.BUTTON_BACK, callback_data="opponents")
    builder.adjust(1)
    return builder.as_markup()


def back_to_opponent_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_BACK, callback_data=f"opponent:{opponent_id}")
    builder.adjust(1)
    return builder.as_markup()


def edit_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_EDIT_GAMES, callback_data=f"edit_games:{opponent_id}")
    builder.button(text=texts.BUTTON_EDIT_POINTS, callback_data=f"edit_points:{opponent_id}")
    builder.button(text=texts.BUTTON_BACK, callback_data=f"opponent:{opponent_id}")
    builder.adjust(1)
    return builder.as_markup()


def invite_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text=texts.BUTTON_MAIN_MENU, callback_data="main")
    builder.adjust(1)
    return builder.as_markup()
