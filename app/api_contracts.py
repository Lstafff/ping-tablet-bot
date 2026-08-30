from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str


class HealthResponse(BaseModel):
    status: str


class WebAppUserResponse(BaseModel):
    id: int
    first_name: Optional[str]
    username: Optional[str]


class MeResponse(BaseModel):
    user: WebAppUserResponse


class UserResponse(BaseModel):
    telegram_id: int
    first_name: str
    username: Optional[str]
    last_message_id: Optional[int]
    created_at: str
    rating: Optional[str]
    rating_is_fnt: bool
    display_name: Optional[str]
    avatar_value: Optional[str]
    elo_rating: int
    elo_games: int


class StatsResponse(BaseModel):
    wins: int
    losses: int
    points_for: int
    points_against: int


class ExtendedStatsResponse(BaseModel):
    games: int
    overtime_wins: int
    overtime_losses: int
    longest_own_score: Optional[int]
    longest_opponent_score: Optional[int]
    longest_points: int
    win_streak: int
    large_margin_games: int
    close_margin_games: int
    most_common_score: Optional[str]
    most_common_score_count: int


class ProfileResponse(BaseModel):
    user: UserResponse
    stats: StatsResponse
    extended_stats: ExtendedStatsResponse
    player_level: str


class OpponentResponse(BaseModel):
    id: int
    name: str
    first_name: Optional[str]
    username: Optional[str]
    display_name: Optional[str]
    avatar_value: Optional[str]
    elo_rating: Optional[int]
    stats: StatsResponse


class OpponentsResponse(BaseModel):
    opponents: list[OpponentResponse]


class RecentGameResponse(BaseModel):
    played_at: str
    own_score: int
    opponent_score: int
    game_id: Optional[int]
    elo_change: Optional[int]


class HistoryGameResponse(RecentGameResponse):
    opponent_id: int
    opponent_name: str


class HistoryResponse(BaseModel):
    games: list[HistoryGameResponse]
    page: int
    total_pages: int


class OpponentStatsResponse(BaseModel):
    opponent_name: str
    stats: StatsResponse
    extended_stats: ExtendedStatsResponse
    user_name: str


class DailyStatResponse(BaseModel):
    played_on: str
    wins: int
    losses: int


class DailyViewResponse(BaseModel):
    opponent_name: str
    daily_stats: list[DailyStatResponse]
    user_name: str
    page: int
    total_pages: int


class GamesViewResponse(BaseModel):
    opponent_name: str
    games: list[RecentGameResponse]
    page: int
    total_pages: int
    total_items: int


class ParsedScoreResponse(BaseModel):
    own_score: int
    opponent_score: int
    regular_own: int
    regular_opponent: int
    overtime_own: int
    overtime_opponent: int


class ScoreResponse(BaseModel):
    game_id: int
    opponent_id: int
    opponent_name: str
    score: ParsedScoreResponse
    recent_games: list[RecentGameResponse]
    elo_rating: Optional[int]
    elo_change: Optional[int]
    opponent_elo_rating: Optional[int]
    profile: ProfileResponse
    opponent_stats: OpponentStatsResponse


class UndoScoreResponse(BaseModel):
    opponent_name: str
    recent_games: list[RecentGameResponse]


class OpponentNameResponse(BaseModel):
    opponent_name: str


class DeleteOpponentResponse(OpponentNameResponse):
    has_opponents: bool


class InviteResponse(BaseModel):
    code: str
    invite_link: Optional[str]


class InviteAcceptResponse(BaseModel):
    status: str
    accepted: bool
    has_opponents: bool
