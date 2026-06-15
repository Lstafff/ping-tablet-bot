import unittest

from app import texts
from app.storage import Opponent


class BotFormattingTest(unittest.TestCase):
    def test_linked_opponent_title_includes_username(self) -> None:
        opponent = Opponent(
            id=1,
            owner_id=1,
            name="@old",
            opponent_user_id=2,
            first_name="Тест",
            username="test",
        )

        self.assertEqual(texts.opponent_title(opponent), "@test")

    def test_test_opponent_title_includes_demo_username(self) -> None:
        opponent = Opponent(
            id=1,
            owner_id=1,
            name=texts.TEST_OPPONENT_NAME,
            opponent_user_id=None,
        )

        self.assertEqual(
            texts.opponent_title(opponent),
            f"@{texts.TEST_OPPONENT_USERNAME}",
        )

    def test_opponent_title_falls_back_to_name_without_username(self) -> None:
        opponent = Opponent(
            id=1,
            owner_id=1,
            name="Сохранённое имя",
            opponent_user_id=2,
            first_name="Тест",
            username=None,
        )

        self.assertEqual(texts.opponent_title(opponent), "Тест")

    def test_delete_opponent_texts_are_available(self) -> None:
        self.assertIn("@test", texts.delete_opponent_confirm("@test"))
        self.assertIn("@test", texts.delete_opponent_done("@test"))


if __name__ == "__main__":
    unittest.main()
