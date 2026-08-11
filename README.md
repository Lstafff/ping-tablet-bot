# Ping Tablet / Tennis

Telegram-first продукт для ведения статистики матчей в настольный теннис. Сейчас в repository есть два клиента: текстовый Telegram-бот и Telegram Mini App (`web/`), которая обращается к FastAPI (`app.api`). Общие product rules проходят через `TennisService`.

Текущее устройство проекта и Phase 3 ограничения зафиксированы в [docs/PROJECT.md](docs/PROJECT.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) и [docs/PHASE-3-AUDIT.md](docs/PHASE-3-AUDIT.md).

## Переменные окружения

- `BOT_TOKEN` — токен Telegram-бота из BotFather.
- `DATABASE_URL` — приватная строка подключения к Postgres. В Railway используй переменную `DATABASE_URL`, а не `DATABASE_PUBLIC_URL`.
- `SEED_TEST_OPPONENT` — добавлять тестового соперника новым пользователям. Для продакшена лучше поставить `false`.
- `WEBAPP_INIT_DATA_MAX_AGE_SECONDS` — максимальный возраст Telegram `initData`, по умолчанию 86 400 секунд.
- `BOT_USERNAME` — username бота без `@`, нужен для invite links.
- `WEBAPP_ALLOWED_ORIGINS` — CORS origins Mini App через запятую; wildcard запрещён.
- `WEBAPP_URL` — публичный HTTPS URL Mini App, который бот открывает из Telegram.

Frontend читает `VITE_API_URL` во время Vite build. Для локальной связки обычно используется `http://localhost:8000`. В Railway API и собранный `web/dist` отдаются одним FastAPI-сервисом, поэтому production build использует same-origin `/api` и не требует `VITE_API_URL`.

## База данных

Приложение работает только с Postgres. Схема управляется versioned runner-ом; bot и API проверяют версию, но не выполняют DDL на старте.

Применить миграции:

```bash
DATABASE_URL=postgresql://... python -m app.migrations
```

Миграции аддитивны. Перед production-изменением нужен Railway backup/snapshot; rollback приложения выполняется на совместимую версию, а rollback данных — восстановлением проверенного backup. Автоматических destructive down-migrations нет.

Основные таблицы:

- `users` — пользователи, инвайт-коды, рейтинг и последний экран бота.
- `opponents` — связи пользователя с соперниками.
- `games` — реальные сыгранные партии.
- `aggregate_adjustments` — ручные правки общей статистики.
- `sessions` — текущий режим ввода пользователя.
- `invite_uses` — кто присоединился по чьему коду.

## Railway

1. Добавь PostgreSQL и два сервиса из одного repository: `ping-tablet-api` и `ping-tablet-bot`.
2. Для API укажи custom config path `/railway.api.json`. Он собирает Docker image, запускает `python -m app.migrations` как единственный pre-deploy migration owner, затем стартует FastAPI на `$PORT` и проверяет `/health`.
3. Для bot укажи custom config path `/railway.json`. Он запускает только aiogram polling worker и не получает публичный domain.
4. В оба сервиса передай приватный `DATABASE_URL`, `BOT_TOKEN`, `SEED_TEST_OPPONENT=false`, `BOT_USERNAME` и `WEBAPP_URL`. Для API задай `WEBAPP_ALLOWED_ORIGINS` равным его публичному HTTPS origin.
5. Первый раз разверни API и проверь `/health`, затем укажи его public domain в `WEBAPP_URL` обоих сервисов и разверни bot.

Config-as-code не создаёт Railway-сервисы и не переключает BotFather menu button автоматически. Эти внешние действия выполняются отдельно после review и push.

## Бэкапы

Минимальный безопасный вариант:

- включить Backups у PostgreSQL-сервиса в Railway;
- перед крупными изменениями делать ручной backup/snapshot;
- не удалять старый деплой до проверки нового.

Для внешнего переезда достаточно иметь свежий дамп Postgres и актуальные переменные `BOT_TOKEN`/`DATABASE_URL` на новом сервере.

## Локальный запуск Mini App

API требует реальные `BOT_TOKEN` и `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://... python -m app.migrations
uvicorn app.api:app --reload --port 8000
```

Frontend запускается отдельно:

```bash
cd web
VITE_API_URL=http://localhost:8000 npm run dev
```

В обычном браузере frontend использует локальный preview adapter; Telegram auth и реальную API-связку нужно проверять отдельно.

## Локальная проверка

```bash
./scripts/verify.sh
```

Postgres integration tests запускаются этой же unittest-командой только при наличии `TEST_DATABASE_URL`, указывающего на отдельную test database.

`requirements.txt` и `requirements-dev.txt` задают разрешённые диапазоны для осознанного обновления. Docker и CI устанавливают воспроизводимые `requirements.lock` и `requirements-dev.lock`; после изменения диапазонов lock-файлы нужно регенерировать и повторно прогнать проверки.
