from __future__ import annotations

import html
import re
from datetime import datetime
from typing import Optional, Protocol
from urllib.parse import urlencode


# Здесь собраны тексты, которые видит пользователь.
# Можно менять фразы справа от знака =, не меняя названия переменных и функций.

DEFAULT_USER_NAME = "Игрок"
TEST_OPPONENT_NAME = "Тестовый соперник"
TEST_OPPONENT_USERNAME = "test"

BUTTON_OPPONENTS = "🥷 Соперники"
BUTTON_INVITE_OPPONENT = "👊 Бросить вызов"
BUTTON_SEND_INVITE = "💌 Отправить"
BUTTON_HAVE_INVITE_CODE = "✋ У меня есть код"
BUTTON_TOTAL_STATS = "📊 Статистика"
BUTTON_ADD_SCORE = "🏓 Добавить счёт"
BUTTON_UNDO_SCORE = "↩️ Отменить"
BUTTON_EDIT = "✏️ Изменить"
BUTTON_OPPONENT_DAILY_STATS = "📊 Статистика"
BUTTON_DELETE_OPPONENT = "❌ Удалить соперника"
BUTTON_CONFIRM_DELETE_OPPONENT = "✅ Да, удалить"
BUTTON_CANCEL = "↩️ Отмена"
BUTTON_BACK = "⬅️ Назад"
BUTTON_MAIN_MENU = "🏠 Меню"
BUTTON_EDIT_GAMES = "🔢 Счёт партий"
BUTTON_EDIT_POINTS = "🎯 Количество мячей"

MAIN_MENU_TEXT = (
    "<h2>пинг 🏓 понг 🏓 каунтер</h2>"
    "\nЭто бот для ведения статистики матчей с друзьями.\n\n"
    "Если нашёл ошибку — пиши @lstaff"
)
OPPONENTS_MENU_TEXT = (
    "<h2>🥷 Соперники</h2>"
    "\nКто твой соперник сегодня?"
)

INVITE_INVALID_TEXT = (
    "<h2>😔 Ссылка не работает...</h2>"
    "\nКажется с ней что-то не так. Попроси новую ссылку у твоего соперника"
)
INVITE_CODE_INVALID_TEXT = (
    "<h2>😔 Код не работает...</h2>"
    "\nПроверь код или попроси соперника отправить его ещё раз."
)
INVITE_SELF_TEXT = (
    "<h2>🔥 Сделали ссылку!</h2>"
    "\nОтправь её другому игроку, чтобы начать вести статстику"
)
INVITE_ACCEPTED_TEXT = (
    "<h2>🥳 Готово!</h2>"
    "\nТвой соперник добавлен. Теперь можно вести статистику партий"
)
INVITE_ALREADY_CONNECTED_TEXT = (
    "<h2>👌 Уже знакомы</h2>"
    "\nЭтот соперник уже есть в твоём списке"
)

ERROR_SCORE_NEEDS_TWO_NUMBERS = "👀 Напиши два числа в одном сообщении: сначала свой счёт, потом счёт соперника. Например: 11-7.\n\nПартия заканчиается после 11 очков у победителя. При счёте 10-10 начинаются овертаймы (по одной подаче) до разницы в 2 очка."
ERROR_VALUES_CANNOT_BE_NEGATIVE = "❌ Как вы ушли в минус? Очки не могут быть отрицательными."
ERROR_GAME_CANNOT_BE_DRAW = "❌ Точно всё? В завершенной партии не может быть ничьей."
ERROR_WINNER_MINIMUM_SCORE = "❌ Уже закончили? Партия закончивается минимум на 11 очках у победителя."
ERROR_DEUCE_NEEDS_TWO_POINT_LEAD = "❌ Ещё не всё! При счёте 10:10 партия должна продолжаться до разницы в 2 очка."
ERROR_OVERTIME_ONLY_AFTER_DEUCE = "❌ Ещё играем! Счёт больше 11 возможен только после 10:10."
ERROR_WIN_REQUIRES_TWO_POINT_LEAD = "❌ Кажется, что-то не так... Победа в партии должна быть с разницей минимум в 2 очка."
PAIR_DEFAULT_EXAMPLE = "11-7"
MONTHS_RU = {
    1: "января",
    2: "февраля",
    3: "марта",
    4: "апреля",
    5: "мая",
    6: "июня",
    7: "июля",
    8: "августа",
    9: "сентября",
    10: "октября",
    11: "ноября",
    12: "декабря",
}


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


class DailyStatsLike(Protocol):
    played_on: str
    wins: int
    losses: int


# Имя игрока для таблиц и уведомлений: @username, если есть, иначе имя.
def display_user_name(first_name: str, username: Optional[str]) -> str:
    if username:
        return username_label(username)
    return first_name or DEFAULT_USER_NAME


# Название соперника в списке, карточке соперника и кнопках.
def opponent_title(opponent: OpponentLike) -> str:
    if opponent.username:
        return username_label(opponent.username)

    if opponent.opponent_user_id is None and opponent.name == TEST_OPPONENT_NAME:
        return username_label(TEST_OPPONENT_USERNAME)

    return opponent.first_name or opponent.name


# Приводит username к виду @name.
def username_label(username: str) -> str:
    if username.startswith("@"):
        return username
    return f"@{username}"


# Запасной обычный текст общей статистики, если rich-таблица не отправилась.
def total_stats(stats: StatsLike) -> str:
    return (
        "<h2>📊 Статистика всех матчей</h2>"
        f"{format_stats(stats)}"
    )


# Rich-таблица на экране общей статистики.
def total_stats_rich_html(stats: StatsLike, user_name: str) -> str:
    return (
        "<h2>📊 Статистика всех матчей</h2>"
        "<hr/>"
        f"{format_stats(stats, user_name=user_name, opponent_name='Оппоненты')}"
    )


# Безопасное имя пользователя для rich-таблиц.
def format_rich_user_name(user_name: str) -> str:
    return html.escape(user_name.strip() or DEFAULT_USER_NAME)


# Упрощает rich-разметку для запасной обычной отправки.
def rich_to_basic_html(rich_html: str) -> str:
    basic_html = re.sub(r"<h[1-6]>", "<b>", rich_html)
    basic_html = re.sub(r"</h[1-6]>", "</b>", basic_html)
    basic_html = re.sub(r"<cite>", "<i>", basic_html)
    basic_html = re.sub(r"</cite>", "</i>", basic_html)
    basic_html = re.sub(r"<tr>(.*?)</tr>", table_row_to_basic_html, basic_html)
    basic_html = re.sub(r"<table[^>]*>", "", basic_html)
    basic_html = re.sub(r"</table>", "", basic_html)
    basic_html = re.sub(r"<hr\s*/?>", "\n\n", basic_html)
    basic_html = re.sub(r"<br\s*/?>", "\n", basic_html)
    return basic_html


# Превращает строку rich-таблицы в простой текст для запасного режима.
def table_row_to_basic_html(match: re.Match[str]) -> str:
    row_html = match.group(1)
    cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row_html)
    cells = [re.sub(r"<[^>]+>", "", cell).strip() for cell in cells]

    if not cells:
        return ""

    if cells[0] in {"Показатель", "День"}:
        return ""

    if len(cells) == 3 and cells[0] == "Победы":
        return f"Победы / Поражения: {cells[1]}-{cells[2]}\n"

    if len(cells) == 3 and cells[0] == "Мячи":
        return f"Мячи: {cells[1]}-{cells[2]}\n"

    if len(cells) == 2 and cells[0] == "Всего сыграно":
        return f"Партии: {cells[1]}\n"

    if len(cells) == 2:
        return f"{cells[0]}: {cells[1]}\n"

    return f"{cells[0]}: {' / '.join(cells[1:])}\n"


# Экран приглашения: ссылка и код, которые можно переслать сопернику.
def invite(invite_link: str, invite_code: str) -> str:
    return (
        "<h2>🥷 Бросить вызов сопернику</h2>"
        f"\nОтправь эту ссылку или код <code>{html.escape(invite_code)}</code> своему сопернику:\n\n"
        f"<code>{html.escape(invite_link)}</code>\n\n"
        "Когда он откроет ссылку и запустит бота, вы появитесь друг у друга в списке соперников."
    )


# Ссылка для кнопки "Отправить" на экране приглашения.
def invite_share_url(invite_link: str) -> str:
    share_text = f"тебе бросили вызов\nв пинг 🏓 понг 🏓 каунтер\n\n{invite_link}"
    return f"https://t.me/share/url?{urlencode({'text': share_text})}"


# Экран ручного ввода кода приглашения.
def invite_code_prompt() -> str:
    return (
        "<h2>✋ Ввести код</h2>"
        "\nОтправь в чат код, который прислал твой соперник."
    )


# Уведомление автору ссылки, когда новый соперник принял приглашение.
def invite_new_opponent_notification(opponent_name: str) -> str:
    return (
        "<h2>💌 Новый соперник</h2>"
        f"\n{html.escape(opponent_name)} открыл твою ссылку, пора сыграть!"
    )


# Экран ввода результата партии с конкретным соперником.
def score_prompt(opponent_name: str) -> str:
    return (
        f"<h2>🏓 Матч с {html.escape(opponent_name)}</h2>"
        "\nНапиши два числа в одном сообщении: сначала свой счёт, потом счёт соперника. Например: <code>11-7</code> или <code>15 13</code>.\n"
        "<blockquote>"
        "<h4>Правила</h4>"
        "Партия заканчивается после 11 очков у победителя. При счёте 10-10 начинаются овертаймы (по одной подаче) до разницы в 2 очка."
        "</blockquote>"
    )


# Меню редактирования статистики с соперником.
def edit_menu(opponent_name: str, stats: StatsLike, user_name: str = DEFAULT_USER_NAME) -> str:
    return (
        f"<h2>✏️ Изменение статистики с {html.escape(opponent_name)}</h2>"
        "<hr/>"
        f"{format_stats(stats, user_name=user_name, opponent_name=opponent_name)}"
        "\n\nЧто хотите изменить?"
    )


# Подтверждение удаления соперника.
def delete_opponent_confirm(opponent_name: str) -> str:
    return (
        f"<h2>🗑️ Удалить соперника {html.escape(opponent_name)}?</h2>"
        "\nТы удалишь своего соперника и всю вашу статистику."
    )


# Сообщение после удаления соперника.
def delete_opponent_done(opponent_name: str) -> str:
    return (
        "<h2>😔 Соперника больше нет</h2>"
        f"\n{html.escape(opponent_name)} удалён вместе со всей вашей историей..."
    )


# Экран ручного изменения общего счёта партий.
def edit_games_prompt(opponent_name: str) -> str:
    return (
        f"<h2>✏️ Изменение счёта партий с {html.escape(opponent_name)}</h2>"
        "\nНапишите общий счет по партиям: сначала ваши победы, потом поражения. Например: <code>8-5</code>."
    )


# Экран ручного изменения общего счёта по мячам.
def edit_points_prompt(opponent_name: str) -> str:
    return (
        f"<h2>✏️ Изменение количества мячей с {html.escape(opponent_name)}</h2>"
        "\nНапишите общий счет по мячам: сначала ваши мячи, потом мячи соперника. Например: <code>132-118</code>."
    )


# Ошибка ввода результата партии, остаётся на экране матча.
def score_input_error(opponent_name: str, error: Exception) -> str:
    return (
        f"<h2>🏓 Матч с {html.escape(opponent_name)}</h2>"
        f"\n{html.escape(str(error))}\n\n"
        "Попробуйте ещё раз: сначала ваш счёт, потом счёт соперника."
    )


# Сообщение после сохранения результата партии.
def score_saved(opponent_name: str, score: ScoreLike, stats: StatsLike, user_name: str = DEFAULT_USER_NAME) -> str:
    overtime = ""
    if score.overtime_own or score.overtime_opponent:
        overtime = (
            f"\n({score.regular_own}-{score.regular_opponent} в основное время, "
            f"{score.overtime_own}-{score.overtime_opponent} в овертайме.)"
        )

    return (
        f"<h2>🏓 Матч с {html.escape(opponent_name)}</h2>"
        f"\n✅ Добавлен счёт: {score.own_score}-{score.opponent_score}.{overtime}\n"
        "<h2>📊 Текущая статистика:</h2>"
        "<hr/>"
        f"{format_stats(stats, user_name=user_name, opponent_name=opponent_name)}"
        "\nМожно сразу написать результат следующего матча."
    )


# Сообщение после отмены только что добавленного результата партии.
def score_undone(opponent_name: str, stats: StatsLike, user_name: str = DEFAULT_USER_NAME) -> str:
    return (
        f"<h2>🏓 Матч с {html.escape(opponent_name)}</h2>"
        "\n↩️ Последний счёт отменён.\n"
        "<h2>📊 Текущая статистика:</h2>"
        "<hr/>"
        f"{format_stats(stats, user_name=user_name, opponent_name=opponent_name)}"
        "\nМожно сразу написать новый результат."
    )


# Карточка статистики с одним соперником.
def opponent_stats(opponent_name: str, stats: StatsLike, user_name: str = DEFAULT_USER_NAME) -> str:
    return (
        f"<h2>🏓 Матчи с {html.escape(opponent_name)}</h2>"
        "<hr/>"
        f"{format_stats(stats, user_name=user_name, opponent_name=opponent_name)}"
    )


# Таблица статистики с конкретным соперником по дням.
def opponent_daily_stats(opponent_name: str, daily_stats: list[DailyStatsLike], user_name: str = DEFAULT_USER_NAME) -> str:
    safe_user_name = format_rich_user_name(user_name)
    safe_opponent_name = format_rich_user_name(opponent_name)
    rows = "".join(
        (
            f"<tr><td>{format_day(daily_stat.played_on)}</td>"
            f"<td align=\"right\">{daily_stat.wins}</td>"
            f"<td align=\"right\">{daily_stat.losses}</td></tr>"
        )
        for daily_stat in daily_stats
    )
    if not rows:
        rows = "<tr><td colspan=\"3\">Пока нет сыгранных матчей.</td></tr>"

    return (
        f"<h2>📊 Статистика по дням с {html.escape(opponent_name)}</h2>"
        "<hr/>"
        "<table bordered striped>"
        f"<tr><th>День</th><th>{safe_user_name}</th><th>{safe_opponent_name}</th></tr>"
        f"{rows}"
        "</table>"
    )


# Простая ошибка без отдельного экрана, например при ручной правке счёта.
def plain_error(error: Exception) -> str:
    return html.escape(str(error))


# Ошибка парсинга пары чисел для ручных правок.
def pair_needs_two_numbers(example: str) -> str:
    return f"Напишите два числа через пробел, дефис или двоеточие: {example}."


# Общая таблица статистики для экранов со счётом.
def format_stats(stats: StatsLike, user_name: str = DEFAULT_USER_NAME, opponent_name: str = "Соперники") -> str:
    safe_user_name = format_rich_user_name(user_name)
    safe_opponent_name = format_rich_user_name(opponent_name)

    return (
        "<table bordered striped>"
        f"<tr><th>Показатель</th><th>🥷 {safe_user_name}</th><th>🏓 {safe_opponent_name}</th></tr>"
        f"<tr><td>Победы</td><td align=\"right\">{stats.wins}</td><td align=\"right\">{stats.losses}</td></tr>"
        f"<tr><td>Всего сыграно</td><td colspan=\"2\" align=\"right\">{stats.games}</td></tr>"
        f"<tr><td>Мячи</td><td align=\"right\">{stats.points_for}</td><td align=\"right\">{stats.points_against}</td></tr>"
        f"<tr><td>Всего мячей</td><td colspan=\"2\" align=\"right\">{stats.points_for + stats.points_against}</td></tr>"
        "</table>"
    )


def format_day(played_on: str) -> str:
    day = datetime.strptime(played_on, "%Y-%m-%d")
    return f"{day.day} {MONTHS_RU[day.month]} '{day.year % 100:02d}"
