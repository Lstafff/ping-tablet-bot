from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.config import Config, load_config
from app.scoring import ScoreError
from app.services import TennisService
from app.storage import Database
from app.webapp_auth import WebAppAuthError, WebAppUser, validate_init_data


class ScoreInput(BaseModel):
    score: str = Field(min_length=1, max_length=32)


@dataclass(frozen=True)
class AppState:
    config: Config
    database: Database
    service: TennisService


@asynccontextmanager
async def lifespan(app: FastAPI):
    config = load_config()
    database = Database(config.database_url)
    app.state.app_state = AppState(
        config=config,
        database=database,
        service=TennisService(database, seed_test_opponent=config.seed_test_opponent),
    )
    try:
        yield
    finally:
        database.close()


app = FastAPI(title="Ping Tablet Bot API", version="0.1.0", lifespan=lifespan)


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
    service = get_service(request)
    service.ensure_user(current_user.id, current_user.first_name, current_user.username)
    view = service.get_profile(current_user.id)
    return {
        "user": asdict(view.user),
        "stats": asdict(view.stats),
        "extended_stats": asdict(view.extended_stats),
    }


@app.get("/api/opponents")
def opponents(
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = get_service(request)
    service.ensure_user(current_user.id, current_user.first_name, current_user.username)
    return {"opponents": [asdict(opponent) for opponent in service.list_opponents(current_user.id)]}


@app.get("/api/opponents/{opponent_id}/stats")
def opponent_stats(
    opponent_id: int,
    request: Request,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = get_service(request)
    service.ensure_user(current_user.id, current_user.first_name, current_user.username)
    view = service.get_opponent_total_stats(current_user.id, opponent_id)
    return {
        "opponent_name": view.opponent_name,
        "stats": asdict(view.stats),
        "extended_stats": asdict(view.extended_stats),
        "user_name": view.user_name,
    }


@app.get("/api/opponents/{opponent_id}/games")
def opponent_games(
    opponent_id: int,
    request: Request,
    page: int = 1,
    current_user: WebAppUser = Depends(require_webapp_user),
) -> dict[str, Any]:
    service = get_service(request)
    service.ensure_user(current_user.id, current_user.first_name, current_user.username)
    view = service.get_opponent_games_stats(current_user.id, opponent_id, page)
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
    service = get_service(request)
    service.ensure_user(current_user.id, current_user.first_name, current_user.username)
    result = service.submit_score(current_user.id, opponent_id, payload.score)
    if result.error is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(result.error))
    if result.score is None or result.game_id is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Score was not saved.")
    return {
        "game_id": result.game_id,
        "opponent_id": result.opponent_id,
        "opponent_name": result.opponent_name,
        "score": asdict(result.score),
        "recent_games": [asdict(game) for game in result.recent_games],
    }


def get_service(request: Request) -> TennisService:
    return get_app_state(request).service


def get_app_state(request: Request) -> AppState:
    return request.app.state.app_state


def require_webapp_user(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_telegram_init_data: Optional[str] = Header(default=None),
) -> WebAppUser:
    init_data = extract_init_data(authorization, x_telegram_init_data)
    if not init_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Telegram initData is required.")

    config = get_app_state(request).config
    try:
        return validate_init_data(
            init_data,
            config.bot_token,
            max_age_seconds=config.webapp_init_data_max_age_seconds,
        )
    except WebAppAuthError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error


def extract_init_data(authorization: Optional[str], x_telegram_init_data: Optional[str]) -> str:
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "tma" and value:
            return value.strip()
    return (x_telegram_init_data or "").strip()
