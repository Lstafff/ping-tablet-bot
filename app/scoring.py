import re
from dataclasses import dataclass
from typing import Optional

from app import texts


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
        raise ScoreError(texts.ERROR_SCORE_NEEDS_TWO_NUMBERS)

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
        example = label or texts.PAIR_DEFAULT_EXAMPLE
        raise ScoreError(texts.pair_needs_two_numbers(example))

    first, second = numbers
    if first < 0 or second < 0:
        raise ScoreError(texts.ERROR_VALUES_CANNOT_BE_NEGATIVE)
    return first, second


def _validate_finished_game(own_score: int, opponent_score: int) -> None:
    if own_score == opponent_score:
        raise ScoreError(texts.ERROR_GAME_CANNOT_BE_DRAW)

    winner = max(own_score, opponent_score)
    loser = min(own_score, opponent_score)

    if winner < 11:
        raise ScoreError(texts.ERROR_WINNER_MINIMUM_SCORE)

    if winner == 11 and loser > 9:
        raise ScoreError(texts.ERROR_DEUCE_NEEDS_TWO_POINT_LEAD)

    if winner > 11 and loser < 10:
        raise ScoreError(texts.ERROR_OVERTIME_ONLY_AFTER_DEUCE)

    if winner - loser < 2:
        raise ScoreError(texts.ERROR_WIN_REQUIRES_TWO_POINT_LEAD)
