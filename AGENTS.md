# Tennis / Ping Tablet — правила для агентов

## Общение

- Отвечай по-русски, если пользователь не попросил другой язык.
- Начинай с продуктового результата, затем называй влияние, риски и только нужные технические детали.
- Отделяй подтверждённые факты от выводов, гипотез и неизвестного.
- Для изменений перечисляй: что работает, что проверено, что не проверено и какой риск остался.

## Архитектурные инварианты

- Текущий repository и working tree — source of truth. Сначала исследуй, затем меняй.
- Текстовый бот должен оставаться рабочим клиентом. Не связывай Mini App refactor с его обязательным rewrite.
- Общие правила продукта проходят через `TennisService`; Telegram handlers и FastAPI routes не должны дублировать domain rules.
- Клиент недоверенный. Auth, ownership и domain invariants проверяются на сервере.
- `telegram_id` сейчас одновременно platform identity и product user key. Это факт текущей модели, а не желательная конечная архитектура.
- Не вводи слои, библиотеки, кэширование, offline-first или cross-platform framework без подтверждённой причины.

## Existing system first

Перед новым component, hook, service, repository, token или helper ищи существующий вариант. Классифицируй область как `KEEP`, `ADAPT`, `CONSOLIDATE` или `REPLACE`. Объединяй только реализации с одной причиной меняться. Не создавай параллельную design system.

## Контекст и Product Memory

- Для существенной задачи сначала прочитай [docs/PROJECT.md](docs/PROJECT.md) и релевантный раздел [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), а не все документы подряд.
- Затем классифицируй product area и просмотри только [docs/ideas/INDEX.md](docs/ideas/INDEX.md). Полные idea files открывай только при прямом совпадении.
- `IDEA` — возможность, `BACKLOG` — принято делать, `DECISION` — выбран способ, `CHANGELOG` — уже изменено и почему.
- Идея не расширяет scope автоматически. После meaningful implementation сверяй её `Done when` и добавляй evidence.

## Skill routing

- Interaction craft и component behavior: `$emil-design-eng`.
- Новая animation: `$emil-design-eng` → `$animate` → implementation → `$review-animations`.
- Улучшение существующей animation: `$review-animations` → `$emil-design-eng` / `$animate` → implementation → `$review-animations`.
- Read-only motion audit: `$improve-animations`; поиск возможностей: `$find-animation-opportunities`.
- Длинный/multiline text reveal: `$serega-gentle`; редкая короткая accent phrase: `$serega-emotional`.
- Русский пользовательский текст: `$sasha`; не лечи текстом структурную проблему.
- Sound feedback: `$sound`, только для намеренных редких моментов.
- Новая product/UX развилка: `$ask-nodumb`; нетривиальный refactor или mass edit: `$nodumb`.
- Async/loading/error/offline/copy/save/delete flows: `$system-feedback`; если меняется copy, добавь `$sasha`.
- После code change обновляй `CHANGELOG.md` через `$changelog-discipline`.

Project-local Skills и pinned upstream revisions перечислены в [.agents/SOURCES.md](.agents/SOURCES.md). Не обновляй их во время feature work.

## Проверка

Реальные доступные команды:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/tennis-bot-pyc python3 -m unittest discover -s tests
cd web && npm run build
```

Postgres integration tests запускаются той же unittest-командой только с `TEST_DATABASE_URL`, указывающим на отдельную test database. Repository CI запускает Postgres suite и frontend build; frontend tests, lint и e2e пока отсутствуют — не выдавай build за их замену.

## Git и безопасность изменений

- Перед meaningful work проверь branch и `git status`.
- Рабочее дерево может содержать большой незавершённый Mini App diff. Не сбрасывай, не форматируй массово и не включай unrelated files.
- Стадируй только явные paths; не используй `git add -A`.
- Не коммить `.env`, tokens, database URLs, dumps или user data.
- Не force-push, не обходи hooks/checks, не merge в `main` автоматически.
- Push, PR, deploy, публикация, destructive migration и раскрытие secrets требуют явного подтверждения пользователя.
- Не устанавливай и не предлагай ngrok или другие traffic tunnels.
