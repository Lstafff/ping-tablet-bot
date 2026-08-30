from __future__ import annotations

import unittest
import hashlib
import hmac
import json
import time
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlencode

try:
    from fastapi.testclient import TestClient

    from app.api import AppState, RatingRequestGuard, create_app, require_webapp_user
    from app.config import Config
    from app.domain import ExtendedStats, Opponent, RecentGame, Stats, User
    from app.scoring import parse_score
    from app.services import OpponentGamesView, OpponentStatsView, ProfileView, ScoreSubmission
    from app.webapp_auth import WebAppUser

    API_TEST_DEPENDENCIES_AVAILABLE = True
except ImportError:
    API_TEST_DEPENDENCIES_AVAILABLE = False


class FakeService:
    def __init__(self) -> None:
        self.operation_ids: list[str | None] = []

    def ensure_user(self, telegram_id: int, first_name: str | None, username: str | None) -> None:
        return None

    def get_opponent_total_stats(self, user_id: int, opponent_id: int):
        if opponent_id != 10:
            raise LookupError("Соперник не принадлежит пользователю.")
        return OpponentStatsView(
            opponent_name="Соперник",
            stats=Stats(wins=1, losses=0, points_for=11, points_against=7),
            extended_stats=self._extended_stats(),
            user_name="Игрок",
        )

    def list_opponents(self, user_id: int) -> list[Opponent]:
        return [
            Opponent(
                id=10,
                owner_id=user_id,
                name="Соперник",
                opponent_user_id=2,
                first_name="Мария",
                username="maria",
                display_name="Маша",
                avatar_value="🏓",
            )
        ]

    def get_opponent_stats(self, user_id: int, opponent_id: int) -> Stats:
        return Stats(wins=1, losses=0, points_for=11, points_against=7)

    def get_opponent_games_stats(
        self,
        user_id: int,
        opponent_id: int,
        page: int = 1,
        page_size: int = 10,
    ) -> OpponentGamesView:
        return OpponentGamesView(
            opponent_name="Соперник",
            games=[RecentGame(played_at="2026-08-28T12:00:00+03:00", own_score=11, opponent_score=7)],
            user_name="Игрок",
            page=page,
            total_pages=1,
            total_items=1,
        )

    def get_profile(self, user_id: int) -> ProfileView:
        return ProfileView(
            user=User(
                telegram_id=user_id,
                first_name="Игрок",
                username=None,
                last_message_id=None,
                created_at="2026-08-11T12:00:00+03:00",
                rating=None,
                rating_is_fnt=False,
            ),
            stats=Stats(wins=1, losses=0, points_for=11, points_against=7),
            extended_stats=self._extended_stats(),
        )

    @staticmethod
    def _extended_stats() -> ExtendedStats:
        return ExtendedStats(
            games=1,
            overtime_wins=0,
            overtime_losses=0,
            longest_own_score=11,
            longest_opponent_score=7,
            longest_points=18,
            win_streak=1,
            large_margin_games=0,
            close_margin_games=0,
            most_common_score="11-7",
            most_common_score_count=1,
        )

    def submit_score(
        self,
        user_id: int,
        opponent_id: int,
        raw_score: str,
        operation_id: str | None = None,
    ) -> ScoreSubmission:
        self.operation_ids.append(operation_id)
        if operation_id == "conflicting-operation":
            raise ValueError("Идентификатор операции уже использован для другого счёта.")
        score = parse_score(raw_score)
        return ScoreSubmission(
            opponent_id=opponent_id,
            opponent_name="Соперник",
            user_name="Игрок",
            score=score,
            game_id=42,
            recent_games=[],
            error=None,
        )


def signed_init_data(bot_token: str, auth_date: int) -> str:
    fields = {
        "auth_date": str(auth_date),
        "user": json.dumps({"id": 1, "first_name": "Игрок"}, separators=(",", ":")),
    }
    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    signature = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return urlencode({**fields, "hash": signature})


@unittest.skipUnless(API_TEST_DEPENDENCIES_AVAILABLE, "Нужны зависимости из requirements-dev.txt.")
class ApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.service = FakeService()
        config = Config(
            bot_token="123456:test",
            database_url="postgresql://unused/test",
            seed_test_opponent=False,
            webapp_init_data_max_age_seconds=3600,
            bot_username="ping_tablet_test_bot",
            webapp_allowed_origins=("http://localhost:5173",),
            webapp_url="https://example.test",
        )
        state = AppState(
            config=config,
            database=None,  # type: ignore[arg-type]
            service=self.service,  # type: ignore[arg-type]
            rating_guard=RatingRequestGuard(),
        )
        self.app = create_app(state)
        self.client = TestClient(self.app)

    def authorization(self, auth_date: int) -> dict[str, str]:
        return {"Authorization": f"tma {signed_init_data('123456:test', auth_date)}"}

    def test_protected_route_rejects_missing_init_data(self) -> None:
        response = self.client.get("/api/opponents/999/stats")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Нужны данные Telegram Mini App.")

    def test_unrelated_opponent_is_not_exposed(self) -> None:
        self.app.dependency_overrides[require_webapp_user] = lambda: WebAppUser(
            id=1,
            first_name="Игрок",
            username=None,
        )

        response = self.client.get("/api/opponents/999/stats")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Ничего не найдено."})

    def test_signed_init_data_returns_representative_stats_shape(self) -> None:
        response = self.client.get(
            "/api/opponents/10/stats",
            headers=self.authorization(int(time.time())),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["stats"]["wins"], 1)
        self.assertEqual(response.json()["opponent_name"], "Соперник")

    def test_opponent_games_response_exposes_total_items_for_client_side_page_derivation(self) -> None:
        response = self.client.get(
            "/api/opponents/10/games?limit=100",
            headers=self.authorization(int(time.time())),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total_items"], 1)
        self.assertEqual(response.json()["total_pages"], 1)

    def test_profile_response_matches_explicit_contract(self) -> None:
        response = self.client.get(
            "/api/profile",
            headers=self.authorization(int(time.time())),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.json()),
            {"user", "stats", "extended_stats", "player_level"},
        )
        self.assertEqual(
            set(response.json()["user"]),
            {
                "telegram_id",
                "first_name",
                "username",
                "last_message_id",
                "created_at",
                "rating",
                "rating_is_fnt",
                "display_name",
                "avatar_value",
                "elo_rating",
                "elo_games",
            },
        )

    def test_opponents_response_includes_live_profile_fields(self) -> None:
        response = self.client.get(
            "/api/opponents",
            headers=self.authorization(int(time.time())),
        )

        self.assertEqual(response.status_code, 200)
        opponent = response.json()["opponents"][0]
        self.assertEqual(opponent["display_name"], "Маша")
        self.assertEqual(opponent["avatar_value"], "🏓")

    def test_openapi_documents_success_and_error_contracts(self) -> None:
        schema = self.app.openapi()
        profile_responses = schema["paths"]["/api/profile"]["get"]["responses"]
        score_responses = schema["paths"]["/api/opponents/{opponent_id}/scores"]["post"]["responses"]

        self.assertEqual(
            profile_responses["200"]["content"]["application/json"]["schema"],
            {"$ref": "#/components/schemas/ProfileResponse"},
        )
        self.assertEqual(
            score_responses["201"]["content"]["application/json"]["schema"],
            {"$ref": "#/components/schemas/ScoreResponse"},
        )
        self.assertEqual(
            score_responses["409"]["content"]["application/json"]["schema"],
            {"$ref": "#/components/schemas/ErrorResponse"},
        )

    def test_stale_and_future_init_data_are_rejected(self) -> None:
        now = int(time.time())
        for auth_date in (now - 3601, now + 60):
            with self.subTest(auth_date=auth_date):
                response = self.client.get(
                    "/api/opponents/10/stats",
                    headers=self.authorization(auth_date),
                )
                self.assertEqual(response.status_code, 401)

    def test_score_operation_id_reaches_service(self) -> None:
        self.app.dependency_overrides[require_webapp_user] = lambda: WebAppUser(
            id=1,
            first_name="Игрок",
            username=None,
        )

        response = self.client.post(
            "/api/opponents/10/scores",
            json={"score": "11-7", "operation_id": "score-operation-42"},
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["game_id"], 42)
        self.assertEqual(self.service.operation_ids, ["score-operation-42"])

    def test_conflicting_score_operation_returns_409(self) -> None:
        self.app.dependency_overrides[require_webapp_user] = lambda: WebAppUser(
            id=1,
            first_name="Игрок",
            username=None,
        )

        response = self.client.post(
            "/api/opponents/10/scores",
            json={"score": "11-7", "operation_id": "conflicting-operation"},
        )

        self.assertEqual(response.status_code, 409)
        self.assertIn("уже использован", response.json()["detail"])

    def test_oversized_json_is_rejected_before_validation(self) -> None:
        response = self.client.post(
            "/api/invites/accept",
            content=b'{' + b'"code":"' + (b"A" * 17_000) + b'"}',
            headers={"Content-Type": "application/json"},
        )

        self.assertEqual(response.status_code, 413)
        self.assertIn("слишком большой", response.json()["detail"])

    def test_static_html_revalidates_and_hashed_assets_are_immutable(self) -> None:
        with TemporaryDirectory() as directory:
            frontend = Path(directory)
            assets = frontend / "assets"
            assets.mkdir()
            (frontend / "index.html").write_text("<main>Ping Tablet</main>", encoding="utf-8")
            (assets / "index-abc123.js").write_text("console.log('ping')", encoding="utf-8")
            app = create_app(self.app.state.app_state, static_directory=frontend)
            client = TestClient(app)

            html_response = client.get("/")
            asset_response = client.get("/assets/index-abc123.js")

        self.assertEqual(html_response.headers["Cache-Control"], "no-cache, max-age=0, must-revalidate")
        self.assertEqual(asset_response.headers["Cache-Control"], "public, max-age=31536000, immutable")


if __name__ == "__main__":
    unittest.main()
