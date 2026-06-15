import re
from dataclasses import dataclass
from typing import Optional


class ScoreError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedScore:
    own_score: int
    opponent_score: int
    regular_own: int
    regular_opponent: int
    overtime_own: int
    overtime_opponent: int

    @property
    def own_won(self) -> bool:
        return self.own_score > self.opponent_score


def parse_score(raw_text: str) -> ParsedScore:
    numbers = [int(value) for value in re.findall(r"\d+", raw_text)]
    if len(numbers) != 2:
        raise ScoreError("Напишите два числа: сначала ваш счет, потом счет соперника. Например: 11-7.")

    own_score, opponent_score = numbers
    _validate_finished_game(own_score, opponent_score)

    if max(own_score, opponent_score) > 11:
        return ParsedScore(
            own_score=own_score,
            opponent_score=opponent_score,
            regular_own=10,
            regular_opponent=10,
            overtime_own=own_score - 10,
            overtime_opponent=opponent_score - 10,
        )

    return ParsedScore(
        own_score=own_score,
        opponent_score=opponent_score,
        regular_own=own_score,
        regular_opponent=opponent_score,
        overtime_own=0,
        overtime_opponent=0,
    )


def parse_pair(raw_text: str, label: Optional[str] = None) -> tuple[int, int]:
    numbers = [int(value) for value in re.findall(r"\d+", raw_text)]
    if len(numbers) != 2:
        example = label or "значения"
        raise ScoreError(f"Напишите два числа через пробел, дефис или двоеточие: {example}.")

    first, second = numbers
    if first < 0 or second < 0:
        raise ScoreError("Значения не могут быть отрицательными.")
    return first, second


def _validate_finished_game(own_score: int, opponent_score: int) -> None:
    if own_score == opponent_score:
        raise ScoreError("В завершенной партии не может быть ничьей.")

    winner = max(own_score, opponent_score)
    loser = min(own_score, opponent_score)

    if winner < 11:
        raise ScoreError("Партия должна закончиться минимум на 11 очках у победителя.")

    if winner == 11 and loser > 9:
        raise ScoreError("При счете 10:10 партия должна продолжаться до разницы в 2 очка.")

    if winner > 11 and loser < 10:
        raise ScoreError("Счет больше 11 возможен только после 10:10.")

    if winner - loser < 2:
        raise ScoreError("Победа в партии должна быть с разницей минимум в 2 очка.")
