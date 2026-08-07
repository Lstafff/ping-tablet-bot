from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass
from typing import Any, Optional

from aiogram import Bot
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.config import Config, load_config, parse_csv_env
from app.domain import Opponent, Stats, player_level
from app.notifications import notify_inviter_about_new_opponent
from app.scoring import ScoreError
from app.services import INVITE_ACCEPTED, RATING_UPDATED, TennisService
from app.storage import Database
from app.webapp_auth import WebAppAuthError, WebAppUser, validate_init_data


class ScoreInput(BaseModel):
    score: str = Field(min_length=1, max_length=32)


class ValueInput(BaseModel):
    value: str = Field(min_length=1, max_length=2048)


class InviteCodeInput(BaseModel):
    code: str = Field(min_length=1, max_length=64)


class ProfileNameInput(BaseModel):
    value: str = Field(min_length=1, max_length=64)


class ProfileAvatarInput(BaseModel):
    value: str = Field(min_length=1, max_length=200_000)


class RatingRequestGuard:
    def __init__(self, max_requests: int = 3, window_seconds: int = 60, max_concurrency: int = 4) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.timestamps: dict[int, deque[float]] = defaultdict(deque)
        self.semaphore = asyncio.Semaphore(max_concurrency)

    async def acquire(self, user_id: int) -> None:
        now = time.monotonic()
        timestamps = self.timestamps[user_id]
        while timestamps and now - timestamps[0] >= self.window_seconds:
            timestamps.popleft()
        if len(timestamps) >= self.max_requests:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Попробуйте обновить рейтинг через минуту.")
        timestamps.append(now)
        await self.semaphore.acquire()

    def release(self) -> None:
        self.semaphore.release()


@dataclass(frozen=True)
class AppState:
    config: Config
    database: Database
    service: TennisService
    rating_guard: RatingRequestGuard


@asynccontextmanager
async def lifespan(app: FastAPI):
    config = load_config()
    database = Database(config.database_url)
    app.state.app_state = AppState(
        config=config,
        database=database,
        service=TennisService(database, seed_test_opponent=config.seed_test_opponent),
        rating_guard=RatingRequestGuard(),
    )
    try:
        yield
    finally:
        database.close()


def get_app_state(request: Request) -> AppState:
    return request.app.state.app_state


def get_service(request: Request) -> TennisService:
    return get_app_state(request).service


def get_rating_guard(request: Request) -> RatingRequestGuard:
    return get_app_state(request).rating_guard


def extract_init_data(authorization: Optional[str], x_telegram_init_data: Optional[str]) -> str:
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "tma" and value:
            return value.strip()
    return (x_telegram_init_data or "").strip()


def require_webapp_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_telegram_init_data: Optional[str] = Header(default=None),
) -> WebAppUser:
    init_data = extract_init_data(authorization, x_telegram_init_data)
    if not init_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Нужны данные Telegram Mini App.")

    config = get_app_state(request).config
    try:
        return validate_init_data(
            init_data,
            config.bot_token,
            max_age_seconds=config.webapp_init_data_max_age_seconds,
        )
    except WebAppAuthError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error


app = FastAPI(title="Ping Tablet Bot API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(parse_csv_env("WEBAPP_ALLOWED_ORIGINS", ("http://localhost:5173",))),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Telegram-Init-Data"],
)


@app.exception_handler(LookupError)
async def not_found_handler(_: Request, __: LookupError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Ничего не найдено."})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/me")
def me(current_user: WebAppUser = Depends(require_webapp_user)) -> dict[str, Any]:
    return {"user": asdict(current_user)}


@app.get("/api/profile")
def profile(
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    return profile_response(service, current_user.id)


@app.put("/api/profile/name")
def update_profile_name(
    payload: ProfileNameInput,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    try:
        service.update_display_name(current_user.id, payload.value)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return profile_response(service, current_user.id)


@app.put("/api/profile/avatar")
def update_profile_avatar(
    payload: ProfileAvatarInput,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    try:
        service.update_avatar(current_user.id, payload.value)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return profile_response(service, current_user.id)


@app.get("/api/opponents")
def opponents(
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    return {
        "opponents": [
            opponent_response(opponent, service.get_opponent_stats(current_user.id, opponent.id))
            for opponent in service.list_opponents(current_user.id)
        ]
    }


@app.get("/api/games")
def game_history(
    request: Request,
    page: int = 1,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    view = service.get_game_history(current_user.id, page)
    return {
        "games": [asdict(game) for game in view.games],
        "page": view.page,
        "total_pages": view.total_pages,
    }


@app.get("/api/opponents/{opponent_id}/stats")
def opponent_stats(
    opponent_id: int,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    return opponent_stats_response(service, current_user.id, opponent_id)


@app.get("/api/opponents/{opponent_id}/daily")
def opponent_daily_stats(
    opponent_id: int,
    request: Request,
    page: int = 1,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    view = service.get_opponent_daily_stats(current_user.id, opponent_id, page)
    return {
        "opponent_name": view.opponent_name,
        "daily_stats": [asdict(item) for item in view.daily_stats],
        "user_name": view.user_name,
        "page": view.page,
        "total_pages": view.total_pages,
    }


@app.get("/api/opponents/{opponent_id}/games")
def opponent_games(
    opponent_id: int,
    request: Request,
    page: int = 1,
    limit: int = 10,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    page_size = min(max(limit, 1), 100)
    view = service.get_opponent_games_stats(current_user.id, opponent_id, page, page_size=page_size)
    return {
        "opponent_name": view.opponent_name,
        "games": [asdict(game) for game in view.games],
        "page": view.page,
        "total_pages": view.total_pages,
    }


@app.post("/api/opponents/{opponent_id}/scores", status_code=status.HTTP_201_CREATED)
def add_score(
    opponent_id: int,
    payload: ScoreInput,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    result = service.submit_score(current_user.id, opponent_id, payload.score)
    if result.error is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(result.error))
    if result.score is None or result.game_id is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось сохранить счёт.")
    return {
        "game_id": result.game_id,
        "opponent_id": result.opponent_id,
        "opponent_name": result.opponent_name,
        "score": asdict(result.score),
        "recent_games": [asdict(game) for game in result.recent_games],
    }


@app.delete("/api/opponents/{opponent_id}/scores/{game_id}")
def undo_score(
    opponent_id: int,
    game_id: int,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    result = service.undo_score(current_user.id, opponent_id, game_id)
    if not result.deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Этот счёт уже отменён.")
    return {
        "opponent_name": result.opponent_name,
        "recent_games": [asdict(game) for game in result.recent_games],
    }


@app.put("/api/opponents/{opponent_id}/totals/games")
def update_games_total(
    opponent_id: int,
    payload: ValueInput,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    try:
        service.set_games_total_from_input(current_user.id, opponent_id, payload.value)
    except ScoreError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return opponent_stats_response(service, current_user.id, opponent_id)


@app.put("/api/opponents/{opponent_id}/totals/points")
def update_points_total(
    opponent_id: int,
    payload: ValueInput,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    try:
        service.set_points_total_from_input(current_user.id, opponent_id, payload.value)
    except ScoreError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    return opponent_stats_response(service, current_user.id, opponent_id)


@app.post("/api/opponents/{opponent_id}/reset")
def reset_opponent_stats(
    opponent_id: int,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    result = service.reset_opponent_stats(current_user.id, opponent_id)
    return {"opponent_name": result.opponent_name}


@app.delete("/api/opponents/{opponent_id}")
def delete_opponent(
    opponent_id: int,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    result = service.delete_opponent(current_user.id, opponent_id)
    return {"opponent_name": result.opponent_name, "has_opponents": result.has_opponents}


@app.post("/api/rating")
async def update_rating(
    payload: ValueInput,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    guard = get_rating_guard(request)
    await guard.acquire(current_user.id)
    try:
        result = await service.submit_rating_input(current_user.id, payload.value)
    finally:
        guard.release()
    if result.status != RATING_UPDATED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось распознать рейтинг.")
    return profile_response(service, current_user.id)


@app.delete("/api/rating")
def clear_rating(
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    service.clear_rating(current_user.id)
    return profile_response(service, current_user.id)


@app.post("/api/invites")
def create_invite(
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    invite_code = service.create_invite_code(current_user.id)
    config = get_app_state(request).config
    invite_link = None
    if config.bot_username:
        invite_link = f"https://t.me/{config.bot_username}?start=invite_{invite_code}"
    return {"code": invite_code, "invite_link": invite_link}


@app.post("/api/invites/accept")
async def accept_invite(
    payload: InviteCodeInput,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = prepare_service(request, current_user)
    result = service.accept_invite(payload.code, current_user.id)
    if result.status == INVITE_ACCEPTED and result.inviter_id is not None:
        config = get_app_state(request).config
        bot = Bot(config.bot_token)
        try:
            await notify_inviter_about_new_opponent(
                bot,
                get_app_state(request).database,
                result.inviter_id,
                current_user.id,
                config.webapp_url,
            )
        finally:
            await bot.session.close()
    return {
        "status": result.status,
        "accepted": result.status == INVITE_ACCEPTED,
        "has_opponents": result.has_opponents,
    }


def prepare_service(request: Request, current_user: WebAppUser) -> TennisService:
    service = get_service(request)
    service.ensure_user(current_user.id, current_user.first_name, current_user.username)
    return service


def profile_response(service: TennisService, user_id: int) -> dict[str, Any]:
    view = service.get_profile(user_id)
    return {
        "user": asdict(view.user),
        "stats": asdict(view.stats),
        "extended_stats": asdict(view.extended_stats),
        "player_level": player_level(view.user.elo_rating, view.user.rating_is_fnt),
    }


def opponent_stats_response(service: TennisService, user_id: int, opponent_id: int) -> dict[str, Any]:
    view = service.get_opponent_total_stats(user_id, opponent_id)
    return {
        "opponent_name": view.opponent_name,
        "stats": asdict(view.stats),
        "extended_stats": asdict(view.extended_stats),
        "user_name": view.user_name,
    }


def opponent_response(opponent: Opponent, stats: Optional[Stats] = None) -> dict[str, Any]:
    response = {
        "id": opponent.id,
        "name": opponent.name,
        "first_name": opponent.first_name,
        "username": opponent.username,
    }
    if stats is not None:
        response["stats"] = asdict(stats)
    return response
