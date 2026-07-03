from __future__ import annotations

import hashlib
import hmac
import json
import unittest
from urllib.parse import urlencode

from app.webapp_auth import WebAppAuthError, validate_init_data


BOT_TOKEN = "123456:secret"


def signed_init_data(fields: dict[str, str]) -> str:
    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    fields_with_hash = {
        **fields,
        "hash": hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest(),
    }
    return urlencode(fields_with_hash)


class WebAppAuthTest(unittest.TestCase):
    def test_validate_init_data_accepts_signed_user(self) -> None:
        init_data = signed_init_data(
            {
                "auth_date": "1000",
                "query_id": "abc",
                "user": json.dumps({"id": 42, "first_name": "Test", "username": "tester"}, separators=(",", ":")),
            }
        )

        user = validate_init_data(init_data, BOT_TOKEN, now=1000)

        self.assertEqual(user.id, 42)
        self.assertEqual(user.first_name, "Test")
        self.assertEqual(user.username, "tester")

    def test_validate_init_data_rejects_tampered_payload(self) -> None:
        init_data = signed_init_data(
            {
                "auth_date": "1000",
                "user": json.dumps({"id": 42, "first_name": "Test"}, separators=(",", ":")),
            }
        ).replace("Test", "Evil")

        with self.assertRaisesRegex(WebAppAuthError, "подпись"):
            validate_init_data(init_data, BOT_TOKEN, now=1000)

    def test_validate_init_data_rejects_expired_payload(self) -> None:
        init_data = signed_init_data(
            {
                "auth_date": "1000",
                "user": json.dumps({"id": 42}, separators=(",", ":")),
            }
        )

        with self.assertRaisesRegex(WebAppAuthError, "устарела"):
            validate_init_data(init_data, BOT_TOKEN, max_age_seconds=60, now=1061)

    def test_validate_init_data_rejects_missing_user(self) -> None:
        init_data = signed_init_data({"auth_date": "1000"})

        with self.assertRaisesRegex(WebAppAuthError, "пользователя"):
            validate_init_data(init_data, BOT_TOKEN, now=1000)


if __name__ == "__main__":
    unittest.main()
