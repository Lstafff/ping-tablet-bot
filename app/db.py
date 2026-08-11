from __future__ import annotations

from typing import Any


CURRENT_SCHEMA_VERSION = 2


class PostgresConnection:
    def __init__(self, database_url: str) -> None:
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as error:
            raise RuntimeError(
                "Для подключения к Postgres нужно установить зависимость psycopg[binary]."
            ) from error

        self._connection = psycopg.connect(database_url, row_factory=dict_row, connect_timeout=10)

    def execute(self, query: str, parameters: tuple[Any, ...] = ()) -> Any:
        return self._connection.execute(self._prepare_query(query), parameters)

    def executescript(self, script: str) -> None:
        for statement in script.split(";"):
            statement = statement.strip()
            if statement:
                self.execute(statement)

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()

    def __enter__(self) -> PostgresConnection:
        return self

    def __exit__(self, exc_type: object, exc_value: object, traceback: object) -> None:
        if exc_type is None:
            self.commit()
        else:
            self.rollback()

    @staticmethod
    def _prepare_query(query: str) -> str:
        return query.replace("?", "%s")
