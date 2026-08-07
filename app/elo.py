from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass


INITIAL_ELO_RATING = 500
RATING_DIFFERENCE_CAP = 400
PROVISIONAL_GAMES = 10
CALIBRATION_GAMES = 30


@dataclass(frozen=True)
class EloGame:
    game_id: int
    player_a_id: int
    player_b_id: int
    player_a_score: int
    player_b_score: int
    played_at: str


@dataclass(frozen=True)
class EloEvent:
    game_id: int
    player_id: int
    opponent_id: int
    rating_before: int
    rating_change: int
    rating_after: int
    played_at: str


def rebuild_elo_ratings(games: list[EloGame]) -> tuple[dict[int, int], dict[int, int], list[EloEvent]]:
    """Rebuild rating state from linked games in their recorded order."""
    ratings: dict[int, int] = defaultdict(lambda: INITIAL_ELO_RATING)
    games_played: dict[int, int] = defaultdict(int)
    events: list[EloEvent] = []

    for game in games:
        player_a_rating = ratings[game.player_a_id]
        player_b_rating = ratings[game.player_b_id]
        rating_change = calculate_rating_change(
            player_a_rating,
            player_b_rating,
            games_played[game.player_a_id],
            games_played[game.player_b_id],
            player_a_won=game.player_a_score > game.player_b_score,
        )
        player_a_after = player_a_rating + rating_change
        player_b_after = player_b_rating - rating_change

        events.extend(
            (
                EloEvent(
                    game_id=game.game_id,
                    player_id=game.player_a_id,
                    opponent_id=game.player_b_id,
                    rating_before=player_a_rating,
                    rating_change=rating_change,
                    rating_after=player_a_after,
                    played_at=game.played_at,
                ),
                EloEvent(
                    game_id=game.game_id,
                    player_id=game.player_b_id,
                    opponent_id=game.player_a_id,
                    rating_before=player_b_rating,
                    rating_change=-rating_change,
                    rating_after=player_b_after,
                    played_at=game.played_at,
                ),
            )
        )
        ratings[game.player_a_id] = player_a_after
        ratings[game.player_b_id] = player_b_after
        games_played[game.player_a_id] += 1
        games_played[game.player_b_id] += 1

    return dict(ratings), dict(games_played), events


def calculate_rating_change(
    player_a_rating: int,
    player_b_rating: int,
    player_a_games: int,
    player_b_games: int,
    *,
    player_a_won: bool,
) -> int:
    """Return player A's zero-sum rating change for one game."""
    expected_score = expected_score_for(player_a_rating, player_b_rating)
    actual_score = 1.0 if player_a_won else 0.0
    return round_half_away_from_zero(rating_k_factor(player_a_games, player_b_games) * (actual_score - expected_score))


def expected_score_for(player_rating: int, opponent_rating: int) -> float:
    rating_difference = max(
        -RATING_DIFFERENCE_CAP,
        min(RATING_DIFFERENCE_CAP, player_rating - opponent_rating),
    )
    return 1.0 / (1.0 + math.pow(10, -rating_difference / 400))


def rating_k_factor(player_games: int, opponent_games: int) -> int:
    least_experienced_games = min(player_games, opponent_games)
    if least_experienced_games < PROVISIONAL_GAMES:
        return 40
    if least_experienced_games < CALIBRATION_GAMES:
        return 32
    return 24


def round_half_away_from_zero(value: float) -> int:
    return math.floor(value + 0.5) if value >= 0 else math.ceil(value - 0.5)
