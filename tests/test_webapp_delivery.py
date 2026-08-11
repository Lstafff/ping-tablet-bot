from __future__ import annotations

import unittest
from unittest.mock import AsyncMock

try:
    from fastapi import HTTPException

    from app.api import RatingRequestGuard, opponent_response
    from app.bot import configure_webapp_menu
    from app.domain import Opponent
    from app.keyboards import main_menu_keyboard

    API_DEPENDENCIES_AVAILABLE = True
except ImportError:
    API_DEPENDENCIES_AVAILABLE = False


@unittest.skipUnless(API_DEPENDENCIES_AVAILABLE, "Нужны зависимости backend из requirements.txt.")
class WebAppDeliveryTest(unittest.IsolatedAsyncioTestCase):
    def test_main_menu_does_not_include_webapp_button(self) -> None:
        keyboard = main_menu_keyboard(True)

        self.assertFalse(any(button.web_app for row in keyboard.inline_keyboard for button in row))

    async def test_configures_app_menu_button_next_to_message_field(self) -> None:
        bot = AsyncMock()

        await configure_webapp_menu(bot, "https://app.example.com")

        menu_button = bot.set_chat_menu_button.await_args.kwargs["menu_button"]
        self.assertEqual(menu_button.text, "App")
        self.assertEqual(menu_button.web_app.url, "https://app.example.com")

    async def test_does_not_configure_menu_without_webapp_url(self) -> None:
        bot = AsyncMock()

        await configure_webapp_menu(bot, "")

        bot.set_chat_menu_button.assert_not_awaited()

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
