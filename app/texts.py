from __future__ import annotations

import html
from typing import Optional, Protocol


# Здесь собраны тексты, которые видит пользователь.
# Можно менять фразы справа от знака =, не меняя названия переменных и функций.

DEFAULT_USER_NAME = "Игрок"
TEST_OPPONENT_NAME = "Тестовый соперник"
TEST_OPPONENT_USERNAME = "test"

BUTTON_OPPONENTS = "🥷 Соперники"
BUTTON_INVITE_OPPONENT = "💌 Пригласить соперника"
BUTTON_TOTAL_STATS = "📊 Общая статистика"
BUTTON_ADD_SCORE = "⚔️ Добавить результат"
BUTTON_EDIT = "✏️ Редактировать"
BUTTON_BACK = "⬅️ Назад"
BUTTON_MAIN_MENU = "🏠 Главное меню"
BUTTON_EDIT_GAMES = "🔢 Счёт партий"
BUTTON_EDIT_POINTS = "🏏 Количество мячей"

MAIN_MENU_TEXT = "<b>🏠 Главное меню</b>"
OPPONENTS_MENU_TEXT = "<b>Соперники</b>\n\nВыберите соперника по имени."

INVITE_INVALID_TEXT = "<b>😔 Ссылка не работает...</b>\n\nКажется с ней что-то не так. Попроси новую ссылку у твоего соперника"
INVITE_SELF_TEXT = "<b>🔥 Сделали ссылку!</b>\n\nОтправь её другому игроку, чтобы начать вести статстику"
INVITE_ACCEPTED_TEXT = "<b>🥳 Готово!</b>\n\nТвой соперник добавлен. Теперь можно вести статистику партий"

ERROR_SCORE_NEEDS_TWO_NUMBERS = "👀 Напиши два числа в одном сообщении: сначала свой счёт, потом счёт соперника. Например: 11-7.\n\nПартия заканчиается после 11 очков у победителя. При счёте 10-10 начинаются овертаймы (по одной подаче) до разницы в 2 очка."
ERROR_VALUES_CANNOT_BE_NEGATIVE = "❌ Как вы ушли в минус? Очки не могут быть отрицательными."
ERROR_GAME_CANNOT_BE_DRAW = "❌ Точно всё? В завершенной партии не может быть ничьей."
ERROR_WINNER_MINIMUM_SCORE = "❌ Уже закончили? Партия закончивается минимум на 11 очках у победителя."
ERROR_DEUCE_NEEDS_TWO_POINT_LEAD = "❌ Ещё не всё! При счёте 10:10 партия должна продолжаться до разницы в 2 очка."
ERROR_OVERTIME_ONLY_AFTER_DEUCE = "❌ Ещё играем! Счёт больше 11 возможен только после 10:10."
ERROR_WIN_REQUIRES_TWO_POINT_LEAD = "❌ Кажется, что-то не так... Победа в партии должна быть с разницей минимум в 2 очка."
PAIR_DEFAULT_EXAMPLE = "11-7"


class StatsLike(Protocol):
    games: int
    wins: int
    losses: int
    points_for: int
    points_against: int


class ScoreLike(Protocol):
    own_score: int
    opponent_score: int
    regular_own: int
    regular_opponent: int
    overtime_own: int
    overtime_opponent: int


class OpponentLike(Protocol):
    name: str
    opponent_user_id: Optional[int]
    first_name: Optional[str]
    username: Optional[str]


def display_user_name(first_name: str, username: Optional[str]) -> str:
    if username:
        return username_label(username)
    return first_name or DEFAULT_USER_NAME


def opponent_title(opponent: OpponentLike) -> str:
    if opponent.username:
        username = username_label(opponent.username)
        name = opponent.first_name or opponent.name
        if name == username:
            return name
        return f"{name} {username}"

    if opponent.opponent_user_id is None and opponent.name == TEST_OPPONENT_NAME:
        return f"{opponent.name} {username_label(TEST_OPPONENT_USERNAME)}"

    return opponent.name


def username_label(username: str) -> str:
    if username.startswith("@"):
        return username
    return f"@{username}"


def total_stats(stats: StatsLike) -> str:
    return f"<b>📊 Статистика всех матчей</b>\n\n{format_stats(stats)}"


def invite(invite_link: str) -> str:
    return (
        "<b>🥷 Пригласи соперника</b>\n\n"
        "Отправь эту ссылку или перешли сообщение своему сопернику:\n"
        f"<code>{html.escape(invite_link)}</code>\n\n"
        "Когда он откроет ссылку и запустит бота, вы появитесь друг у друга в списке соперников."
    )


def score_prompt(opponent_name: str) -> str:
    return (
        f"<b>⚔️ Матч с {html.escape(opponent_name)}</b>\n\n"
        "👀 Напиши два числа в одном сообщении: сначала свой счёт, потом счёт соперника.\n"
        "Например: <code>11-7</code> или <code>15 13</code>.\n\n"
        "<blockquote>"
        "Партия заканчивается после 11 очков у победителя. При счёте 10-10 начинаются овертаймы (по одной подаче) до разницы в 2 очка."
        "</blockquote>"
    )


def edit_menu(opponent_name: str, stats: StatsLike) -> str:
    return (
        f"<b>Редактирование: {html.escape(opponent_name)}</b>\n\n"
        f"📊 Общая статистика: {stats.wins}-{stats.losses}\n"
        f"🎯 Всего мячей: {stats.points_for}-{stats.points_against}"
    )


def edit_games_prompt(opponent_name: str) -> str:
    return (
        f"<b>✏️ Редактирование: счёта партий с {html.escape(opponent_name)}</b>\n\n"
        "Напишите общий счет по партиям: сначала ваши победы, потом поражения.\n"
        "Например: <code>8-5</code>."
    )


def edit_points_prompt(opponent_name: str) -> str:
    return (
        f"<b>✏️ Редактирование: количества мячей с {html.escape(opponent_name)}</b>\n\n"
        "Напишите общий счет по мячам: сначала ваши мячи, потом мячи соперника.\n"
        "Например: <code>132-118</code>."
    )


def score_input_error(opponent_name: str, error: Exception) -> str:
    return (
        f"<b>{html.escape(opponent_name)}</b>\n\n"
        f"{html.escape(str(error))}\n\n"
        "Попробуйте ещё раз: сначала ваш счёт, потом счёт соперника."
    )


def score_saved(opponent_name: str, score: ScoreLike, stats: StatsLike) -> str:
    overtime = ""
    if score.overtime_own or score.overtime_opponent:
        overtime = (
            f"\n({score.regular_own}-{score.regular_opponent} в основное время, "
            f"{score.overtime_own}-{score.overtime_opponent} в овертайме.)"
        )

    return (
        f"<b>⚔️ Матч с {html.escape(opponent_name)}</b>\n\n"
        f"✅ Добавлен счёт: {score.own_score}-{score.opponent_score}.{overtime}\n\n"
        "<b>📊 Текущая статистика:</b>\n"
        f"{format_stats(stats)}\n\n"
        "Можно сразу написать результат следующего матча."
    )


def opponent_stats(opponent_name: str, stats: StatsLike) -> str:
    return f"<b>📊 Статистика матчей с {html.escape(opponent_name)}</b>\n\n{format_stats(stats)}"


def plain_error(error: Exception) -> str:
    return html.escape(str(error))


def pair_needs_two_numbers(example: str) -> str:
    return f"Напишите два числа через пробел, дефис или двоеточие: {example}."


def format_stats(stats: StatsLike) -> str:
    return (
        f"↳ Партии: {stats.games}\n"
        f"↳ Победы / Поражения: {stats.wins}-{stats.losses}\n"
        f"↳ Мячи: {stats.points_for}-{stats.points_against}\n"
        f"↳ Всего мячей: {stats.points_for + stats.points_against}"
    )
