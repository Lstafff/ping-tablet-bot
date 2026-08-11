from __future__ import annotations

import unittest

try:
    from fastapi import HTTPException

    from app.api import RatingRequestGuard, opponent_response
    from app.domain import Opponent
    from app.keyboards import main_menu_keyboard

    API_DEPENDENCIES_AVAILABLE = True
except ImportError:
    API_DEPENDENCIES_AVAILABLE = False


@unittest.skipUnless(API_DEPENDENCIES_AVAILABLE, "Нужны зависимости backend из requirements.txt.")
class WebAppDeliveryTest(unittest.IsolatedAsyncioTestCase):
    def test_main_menu_adds_webapp_button_only_when_url_is_configured(self) -> None:
        without_webapp = main_menu_keyboard(True)
        with_webapp = main_menu_keyboard(True, "https://app.example.com")

        self.assertFalse(any(button.web_app for row in without_webapp.inline_keyboard for button in row))
        self.assertEqual(with_webapp.inline_keyboard[-1][0].web_app.url, "https://app.example.com")

    async def test_rating_request_guard_limits_user(self) -> None:
        guard = RatingRequestGuard(max_requests=1, window_seconds=60, max_concurrency=1)
        await guard.acquire(42)
        guard.release()

        with self.assertRaises(HTTPException) as context:
            await guard.acquire(42)

        self.assertEqual(context.exception.status_code, 429)

    def test_opponent_response_hides_internal_telegram_ids(self) -> None:
        response = opponent_response(
            Opponent(
                id=4,
                owner_id=10,
                name="Мария",
                opponent_user_id=20,
                first_name="Мария",
                username="maria",
            )
        )

        self.assertEqual(
            response,
            {
                "id": 4,
                "name": "Мария",
                "first_name": "Мария",
                "username": "maria",
                "elo_rating": None,
            },
        )


if __name__ == "__main__":
    unittest.main()
