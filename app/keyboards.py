from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from app.storage import Opponent


def main_menu_keyboard(has_opponents: bool) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    if has_opponents:
        builder.button(text="Соперники", callback_data="opponents")
    else:
        builder.button(text="Пригласить соперника", callback_data="invite")
    builder.button(text="Общая статистика", callback_data="stats_all")
    builder.adjust(1)
    return builder.as_markup()


def opponents_keyboard(opponents: list[Opponent]) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    for opponent in opponents:
        builder.button(text=opponent.name, callback_data=f"opponent:{opponent.id}")
    builder.button(text="Главное меню", callback_data="main")
    builder.adjust(1)
    return builder.as_markup()


def opponent_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="Добавить результат", callback_data=f"score_add:{opponent_id}")
    builder.button(text="Редактировать", callback_data=f"edit:{opponent_id}")
    builder.button(text="Назад", callback_data="opponents")
    builder.adjust(1)
    return builder.as_markup()


def back_to_opponent_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="Назад", callback_data=f"opponent:{opponent_id}")
    builder.adjust(1)
    return builder.as_markup()


def edit_keyboard(opponent_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="Счет партий", callback_data=f"edit_games:{opponent_id}")
    builder.button(text="Количество мячей", callback_data=f"edit_points:{opponent_id}")
    builder.button(text="Назад", callback_data=f"opponent:{opponent_id}")
    builder.adjust(1)
    return builder.as_markup()


def invite_keyboard() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="Главное меню", callback_data="main")
    builder.adjust(1)
    return builder.as_markup()
