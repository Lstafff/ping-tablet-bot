from __future__ import annotations

import html
import random
from datetime import datetime
from typing import Optional, Protocol
from urllib.parse import urlencode


# Здесь собраны тексты, которые видит пользователь.
# Можно менять фразы справа от знака =, не меняя названия переменных и функций.

DEFAULT_USER_NAME = "Игрок"
TEST_OPPONENT_NAME = "Тестовый соперник"
TEST_OPPONENT_USERNAME = "test"

BUTTON_OPPONENTS = "🏓 Соперники"
BUTTON_INVITE_OPPONENT = "👊 Бросить вызов"
BUTTON_SEND_INVITE = "💌 Отправить"
BUTTON_SHARE_PROFILE = "💌 Поделиться"
BUTTON_HAVE_INVITE_CODE = "✋ У меня есть код"
BUTTON_TOTAL_STATS = "🥷 Профиль"
BUTTON_RATING = "🏆 Рейтинг"
BUTTON_LEVELS = "🎯 Уровни"
BUTTON_CLEAR_RATING = "🧹 Очистить"
BUTTON_UNDO_SCORE = "↩️ Отменить"
BUTTON_EDIT = "✏️ Изменить"
BUTTON_OPPONENT_DAILY_STATS = "📊 Статистика"
BUTTON_STATS_GENERAL_ACTIVE = "✅ Общая"
BUTTON_STATS_GENERAL = "Общая"
BUTTON_STATS_DAILY_ACTIVE = "✅ По дням"
BUTTON_STATS_DAILY = "По дням"
BUTTON_STATS_GAMES_ACTIVE = "✅ По играм"
BUTTON_STATS_GAMES = "По играм"
BUTTON_RESET_STATS = "🔄 Сбросить статистику"
BUTTON_DELETE_OPPONENT = "❌ Удалить соперника"
BUTTON_CONFIRM_RESET_STATS = "✅ Да, сбросить"
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


class ExtendedStatsLike(Protocol):
    games: int
    overtime_wins: int
    overtime_losses: int
    overtime_games: int
    longest_own_score: Optional[int]
    longest_opponent_score: Optional[int]
    longest_points: int
    win_streak: int
    large_margin_games: int
    close_margin_games: int
    most_common_score: Optional[str]
    most_common_score_count: int


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


class RecentGameLike(Protocol):
    played_at: str
    own_score: int
    opponent_score: int


class UserLike(Protocol):
    first_name: str
    username: Optional[str]
    created_at: str
    rating: Optional[str]
    rating_is_fnt: bool


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


# Экран профиля с общей статистикой.
def profile(user: UserLike, stats: StatsLike, extended_stats: Optional[ExtendedStatsLike] = None) -> str:
    user_name = display_user_name(user.first_name, user.username)
    level = format_player_level(stats.games, user.rating_is_fnt)
    return (
        f"<h2>🥷 Профиль {html.escape(user_name)}</h2>"
        f"\n<b>･ Играет с </b>{format_day(user.created_at[:10])}\n"
        f"<b>･ Уровень: </b>{level}\n"
        f"<b>･ Рейтинг: </b>{format_rating(user.rating, user.rating_is_fnt)}\n"
        "<h2>📊 Общая статистика</h2>"
        "<hr/>"
        f"{format_stats(stats, user_name=user_name, opponent_name='Оппоненты', extended_stats=extended_stats)}"
    )


# Безопасное имя пользователя для rich-таблиц.
def format_rich_user_name(user_name: str) -> str:
    return html.escape(user_name.strip() or DEFAULT_USER_NAME)


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


# Экран ввода рейтинга в профиле.
def rating_prompt() -> str:
    return (
        "<h2>🏆 Какой у тебя рейтинг?</h2>"
        "\nВставь ссылку на свой профиль в рейтинге ФНТР или RTTF\n"
        "<blockquote>"
        "😔 Если ты профик с рейтингом, участвовать в любительских турнирах не получится"
        "</blockquote>"
    )


# Экран с правилами уровней игроков в профиле.
def levels_info() -> str:
    return (
        "<h2>🎯 Уровни игроков</h2>"
        "<hr/>"
        "<table bordered striped>"
        "<tr><th align=\"center\">Уровень</th><th align=\"center\">Всего матчей</th></tr>"
        "<tr><td align=\"center\">новичок 👶</td><td align=\"center\">меньше 50</td></tr>"
        "<tr><td align=\"center\">любитель 🏓</td><td align=\"center\">50-149</td></tr>"
        "<tr><td align=\"center\">бывалый 🤘😎</td><td align=\"center\">150-299</td></tr>"
        "<tr><td align=\"center\">робот 🦾</td><td align=\"center\">300-499</td></tr>"
        "<tr><td align=\"center\">профик 💀</td><td align=\"center\">500+</td></tr>"
        "</table>"
        "<blockquote>❗️ Если у тебя рейтинг ФНТР, ты профик независимо от количества сыгранных партий</blockquote>"
    )


# Ошибка, если пользователь ввёл не число и не ссылку ФНТР.
def rating_input_error() -> str:
    return (
        f"{rating_prompt()}"
        "\n\nНе получилось найти рейтинг. Введи число или ссылку на профиль ФНТР."
    )


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
        "<hr/>"
        "<h4>Правила</h4>"
        "Партия заканчивается после 11 очков у победителя. При счёте 10-10 начинаются овертаймы (по одной подаче) до разницы в 2 очка."
        "<hr/>"
        "<blockquote>"
        "Напиши два числа в одном сообщении: сначала свой счёт, потом счёт соперника. Например: <code>11-7</code> или <code>15 13</code>."
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


# Подтверждение сброса статистики с соперником.
def reset_stats_confirm(opponent_name: str) -> str:
    return (
        f"<h2>🔄 Сбросить статистику с {html.escape(opponent_name)}?</h2>"
        "\nСоперник останется в списке, но ваши партии и мячи сбросятся."
    )


# Сообщение после сброса статистики с соперником.
def reset_stats_done(opponent_name: str) -> str:
    return (
        "<h2>🔄 Статистика сброшена</h2>"
        f"\nИстория матчей с {html.escape(opponent_name)} очищена."
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
        f"{next_score_hint_without_separator()}"
    )


# Сообщение после сохранения результата партии.
def score_saved(
    opponent_name: str,
    score: ScoreLike,
    recent_games: list[RecentGameLike],
    user_name: str = DEFAULT_USER_NAME,
) -> str:
    overtime = ""
    if score.overtime_own or score.overtime_opponent:
        overtime = (
            f"\n(<code>{score.regular_own}-{score.regular_opponent}</code> в основное время, "
            f"<code>{score.overtime_own}-{score.overtime_opponent}</code> в овертайме)"
        )

    return (
        f"<h2>🏓 Матч с {html.escape(opponent_name)}</h2>"
        f"\n✅ Добавлен счёт: <code>{score.own_score}-{score.opponent_score}</code>{overtime}\n"
        "<h2>📊 Последние 5 игр</h2>"
        "<hr/>"
        f"{format_recent_games(recent_games, user_name=user_name, opponent_name=opponent_name)}"
        f"{next_score_hint()}"
    )


# Сообщение после отмены только что добавленного результата партии.
def score_undone(
    opponent_name: str,
    recent_games: list[RecentGameLike],
    user_name: str = DEFAULT_USER_NAME,
) -> str:
    return (
        f"<h2>🏓 Матч с {html.escape(opponent_name)}</h2>"
        "\n↩️ Последний счёт отменён.\n"
        "<h2>📊 Последние 5 игр</h2>"
        "<hr/>"
        f"{format_recent_games(recent_games, user_name=user_name, opponent_name=opponent_name)}"
        f"{next_score_hint()}"
    )


def next_score_hint() -> str:
    return "<hr/><blockquote>⬇️ Напиши следующий счёт в чат!</blockquote>"


def next_score_hint_without_separator() -> str:
    return "<blockquote>⬇️ Напиши следующий счёт в чат!</blockquote>"


# Карточка статистики с одним соперником.
def opponent_stats(
    opponent_name: str,
    stats: StatsLike,
    user_name: str = DEFAULT_USER_NAME,
    extended_stats: Optional[ExtendedStatsLike] = None,
) -> str:
    return (
        f"<h2>📊 Статистика с {html.escape(opponent_name)}</h2>"
        "<hr/>"
        f"{format_stats(stats, user_name=user_name, opponent_name=opponent_name, extended_stats=extended_stats)}"
    )


# Таблица статистики с конкретным соперником по дням.
def opponent_daily_stats(opponent_name: str, daily_stats: list[DailyStatsLike], user_name: str = DEFAULT_USER_NAME) -> str:
    safe_user_name = format_rich_user_name(user_name)
    safe_opponent_name = format_rich_user_name(opponent_name)
    rows = "".join(
        (
            f"<tr><td align=\"left\">{format_day(daily_stat.played_on)}</td>"
            f"<td align=\"left\">{daily_stat.wins}</td>"
            f"<td align=\"left\">{daily_stat.losses}</td></tr>"
        )
        for daily_stat in daily_stats
    )
    if not rows:
        rows = "<tr><td colspan=\"3\" align=\"left\">Пока нет сыгранных матчей.</td></tr>"

    return (
        f"<h2>📊 Статистика с {html.escape(opponent_name)}</h2>"
        "<hr/>"
        "<table bordered striped>"
        f"<tr><th align=\"left\">День</th><th align=\"left\">🥷 {safe_user_name}</th>"
        f"<th align=\"left\">🏓 {safe_opponent_name}</th></tr>"
        f"{rows}"
        "</table>"
    )


# Таблица статистики с конкретным соперником по всем сыгранным играм.
def opponent_games_stats(opponent_name: str, games: list[RecentGameLike], user_name: str = DEFAULT_USER_NAME) -> str:
    return (
        f"<h2>📊 Статистика с {html.escape(opponent_name)}</h2>"
        "<hr/>"
        f"{format_recent_games(games, user_name=user_name, opponent_name=opponent_name)}"
    )


# Простая ошибка без отдельного экрана, например при ручной правке счёта.
def plain_error(error: Exception) -> str:
    return html.escape(str(error))


# Ошибка парсинга пары чисел для ручных правок.
def pair_needs_two_numbers(example: str) -> str:
    return f"Напишите два числа через пробел, дефис или двоеточие: {example}."


# Общая таблица статистики для экранов со счётом.
def format_stats(
    stats: StatsLike,
    user_name: str = DEFAULT_USER_NAME,
    opponent_name: str = "Соперники",
    extended_stats: Optional[ExtendedStatsLike] = None,
) -> str:
    safe_user_name = format_rich_user_name(user_name)
    safe_opponent_name = format_rich_user_name(opponent_name)
    games_difference = format_signed_difference(stats.wins - stats.losses)
    points_difference = format_signed_difference(stats.points_for - stats.points_against)
    extended_rows = format_extended_stats_rows(extended_stats)
    fact = format_stats_fact(extended_stats)
    fact_block = f"<hr/><blockquote>{fact}</blockquote>" if fact else ""

    return (
        "<table bordered striped>"
        f"<tr><th align=\"left\">Показатель</th><th align=\"left\">🥷 {safe_user_name}</th>"
        f"<th align=\"left\">🏓 {safe_opponent_name}</th></tr>"
        f"<tr><td align=\"left\">Победы</td><td align=\"left\">{stats.wins} ({games_difference})</td>"
        f"<td align=\"left\">{stats.losses}</td></tr>"
        f"<tr><td align=\"left\">Всего игр</td><td colspan=\"2\" align=\"center\">{stats.games}</td></tr>"
        f"<tr><td align=\"left\">Мячи</td><td align=\"left\">{stats.points_for} ({points_difference})</td>"
        f"<td align=\"left\">{stats.points_against}</td></tr>"
        f"<tr><td align=\"left\">Всего мячей</td><td colspan=\"2\" align=\"center\">"
        f"{stats.points_for + stats.points_against}</td></tr>"
        f"{extended_rows}"
        "</table>"
        f"{fact_block}"
    )


def format_extended_stats_rows(extended_stats: Optional[ExtendedStatsLike]) -> str:
    if extended_stats is None:
        return ""

    longest_own_score = "—" if extended_stats.longest_own_score is None else str(extended_stats.longest_own_score)
    longest_opponent_score = (
        "—" if extended_stats.longest_opponent_score is None else str(extended_stats.longest_opponent_score)
    )
    return (
        f"<tr><td align=\"left\">Овертаймы</td><td align=\"left\">{extended_stats.overtime_wins}</td>"
        f"<td align=\"left\">{extended_stats.overtime_losses}</td></tr>"
        f"<tr><td align=\"left\">Всего овертаймов</td><td colspan=\"2\" align=\"center\">"
        f"{extended_stats.overtime_games}</td></tr>"
        f"<tr><td align=\"left\">Самая долгая игра</td><td align=\"left\">{longest_own_score}</td>"
        f"<td align=\"left\">{longest_opponent_score}</td></tr>"
    )


def format_stats_fact(extended_stats: Optional[ExtendedStatsLike]) -> str:
    facts = stats_fact_candidates(extended_stats)
    if not facts:
        return ""
    return random.choice(facts)


def stats_fact_candidates(extended_stats: Optional[ExtendedStatsLike]) -> list[str]:
    if extended_stats is None or extended_stats.games == 0:
        return []

    facts: list[str] = []
    if extended_stats.overtime_games:
        overtime_win_percent = round(extended_stats.overtime_wins / extended_stats.overtime_games * 100)
        if overtime_win_percent > 50:
            facts.append(
                "🥶🥶🥶<br/>"
                f"С тобой лучше не доводить до ничьей! Ты выигрываешь {overtime_win_percent}% овертаймов"
            )
        elif overtime_win_percent < 50:
            facts.append(
                "💀💀💀<br/>"
                "Бро, тебе надо тренироваться... "
                f"Большинство овертаймов уходят сопернику: {extended_stats.overtime_wins}-{extended_stats.overtime_losses}"
            )

    if (
        extended_stats.longest_points > 25
        and extended_stats.longest_own_score is not None
        and extended_stats.longest_opponent_score is not None
    ):
        facts.append(
            "👶🏻🏁👵🏻<br/>"
            "Все состарились, пока смотрели на твою самую долгую партию: "
            f"{extended_stats.longest_own_score}-{extended_stats.longest_opponent_score}. "
            f"Это целых {extended_stats.longest_points} мячей..."
        )

    if extended_stats.win_streak > 3:
        facts.append(
            "🔥🏓<br/>"
            f"Уже {extended_stats.win_streak} побед подряд! Оставь хоть какие-то шансы..."
        )

    if is_frequent_stat(extended_stats.large_margin_games, extended_stats.games):
        facts.append(
            "🫢🫢🫢<br/>"
            "Да ты уже профик! Может пора найти соперников посильнее?"
        )

    if is_frequent_stat(extended_stats.close_margin_games, extended_stats.games):
        facts.append(
            "🥵🥵🥵<br/>"
            "Каждый раз так близко... У тебя серьёзный соперник!"
        )

    if extended_stats.most_common_score is not None and extended_stats.most_common_score_count > 1:
        most_common_percent = round(extended_stats.most_common_score_count / extended_stats.games * 100)
        facts.append(
            "😪😪😪<br/>"
            f"В следующем матче счёт будет: {extended_stats.most_common_score}. "
            f"Кстати, так заканчиваются {most_common_percent}% твоих матчей!"
        )

    return facts


def is_frequent_stat(count: int, total: int) -> bool:
    return total >= 3 and count / total > 0.5


# Таблица последних игр на экране после добавления счёта.
def format_recent_games(
    recent_games: list[RecentGameLike],
    user_name: str = DEFAULT_USER_NAME,
    opponent_name: str = "Соперник",
) -> str:
    safe_user_name = format_rich_user_name(user_name)
    safe_opponent_name = format_rich_user_name(opponent_name)
    rows = "".join(
        (
            f"<tr><td align=\"left\">{format_game_time(game.played_at)}</td>"
            f"<td align=\"left\">{game.own_score}</td>"
            f"<td align=\"left\">{game.opponent_score}</td></tr>"
        )
        for game in recent_games
    )
    if not rows:
        rows = "<tr><td colspan=\"3\" align=\"left\">Пока нет сыгранных матчей.</td></tr>"

    return (
        "<table bordered striped>"
        f"<tr><th align=\"left\">Дата</th><th align=\"left\">{safe_user_name}</th>"
        f"<th align=\"left\">{safe_opponent_name}</th></tr>"
        f"{rows}"
        "</table>"
    )


def format_day(played_on: str) -> str:
    day = datetime.strptime(played_on, "%Y-%m-%d")
    return f"{day.day} {MONTHS_RU[day.month]} '{day.year % 100:02d}"


def format_game_time(played_at: str) -> str:
    day = datetime.fromisoformat(played_at)
    return f"{day.day} {MONTHS_RU[day.month]}, {day:%H:%M}"


def format_signed_difference(value: int) -> str:
    if value > 0:
        return f"+{value}"
    return str(value)


def format_player_level(games: int, rating_is_fnt: bool) -> str:
    if rating_is_fnt or games >= 500:
        return "💀 профик"
    if games >= 300:
        return "🦾 робот"
    if games >= 150:
        return "🤘 бывалый"
    if games >= 50:
        return "🏓 любитель"
    return "👶 новичок"


def format_rating(rating: Optional[str], rating_is_fnt: bool) -> str:
    if not rating:
        return "пока нет"
    if rating_is_fnt:
        return f"{html.escape(rating)} (✅ ФНТР)"
    return html.escape(rating)


def is_fnt_rating_input(raw_text: str) -> bool:
    normalized = raw_text.lower()
    return normalized.startswith(("http://", "https://")) and (
        "фнтр" in normalized
        or "fntr" in normalized
        or "fnt" in normalized
        or "ttfr" in normalized
        or "rttf" in normalized
    )
