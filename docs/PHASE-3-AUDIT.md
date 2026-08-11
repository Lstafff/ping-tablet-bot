# Phase 3 Audit

Date: 2026-08-11
Scope: current working tree on `codex/mini-app-feature`
Method: repository evidence, read-only specialist reviews, backend tests, frontend build and repository generators/checkers.

## 1. Executive Summary

Проект готов к постепенной Phase 3, но не к безопасному расширению tournaments «как есть». Общая application-граница через `TennisService`, server-side ownership, scoring/Elo rules и текущая UI/motion-основа уже полезны и не требуют rewrite. Главный bottleneck — неясный production-контур Mini App вместе с runtime-миграциями, отсутствием API/CI safety net и дорогими critical paths. Рекомендуемый порядок: сначала надёжность score/API и схема миграций, затем bounded reads и локальная async-feedback модель, после этого — frontend boundaries и только затем новые product capabilities.

## 2. Current Architecture

```text
Telegram Bot (aiogram polling) ------\
                                      > TennisService -> Database -> Postgres
Telegram Mini App -> FastAPI API ----/
```

- Railway запускает только `python -m app.bot`; production entrypoint/hosting для FastAPI и Vite-клиента в repository не определены.
- Bot handlers и API routes используют общий `TennisService`; domain/scoring/Elo helpers не зависят от React.
- `Database` одновременно владеет SQL repositories, transactions, schema bootstrap, additive DDL/backfill и Elo rebuild.
- Mini App — React 18 + TypeScript + Vite + `motion/react`. Активный продукт находится в `web/src`; из copied `web/mini-app` используются только Telegram adapter helpers и Glass component, `web/primitives` не входит в active import graph.
- `users.telegram_id` одновременно platform identity и primary product key. `opponents` уже различает локального соперника и linked registered user.

Подробная карта current versus planned architecture находится в [ARCHITECTURE.md](ARCHITECTURE.md).

## 3. What Is Already Good

- **KEEP — application seam.** Оба клиента проходят через `TennisService`; это достаточно сильная граница для постепенного развития.
- **KEEP — domain rules.** Scoring, overtime, Elo chronology/calibration и двусторонняя статистика вынесены из UI и покрыты тестами.
- **KEEP — auth/ownership direction.** API получает acting user только из проверенного Telegram `initData`; owner-scoped storage lookup предшествует чтению и mutation соперника.
- **KEEP — linked-opponent model.** Local/linked distinction уже поддерживает социальные сценарии без немедленного redesign таблицы opponents.
- **KEEP / ADAPT — UI tokens.** `tokens.css` уже разделяет semantic theme, accent, status, material и motion groups; значения contrast/theme mapping требуют корректировки, сама структура — нет.
- **KEEP — motion language.** Основные duration 120/180/240 ms, intentional easing, spatial continuity, `MotionConfig` и `useReducedMotion` соответствуют продукту; нового animation engine не нужно.
- **KEEP — validation base.** 86 backend tests проходят, TypeScript strict включён, npm lockfile есть, build и четыре token/generated checks проходят.

## 4. Critical Risks

Каждый finding ниже основан на текущем source/config, а не на списке best practices.

| Problem | Evidence | User / product impact | Risk | Recommendation | Priority | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| Mini App production topology не определена | `railway.json:4` запускает только bot; API живёт в `app/api.py:130`; client требует `VITE_API_URL` в `web/src/main.tsx:156`; hosting/proxy config отсутствует | Локальная сборка не доказывает, что `/api`, CORS, health и static app работают вместе в production | Deploy может оставить Web без API или с неверным origin | Выбрать и задокументировать bot worker + API service + static web topology, start/build/health commands и env ownership | P1 | M |
| Schema changes выполняются из runtime | `Database()` вызывает `_migrate()` (`app/storage.py:91-99`); оба entrypoint создают Database; DDL/backfill/Elo reconcile находятся в `app/storage.py:99-352` | Startup становится непредсказуемым; bot/API могут одновременно менять схему | Нет version ledger, N-1 upgrade test и rollback procedure | Ввести versioned migration runner с одним deploy owner; сначала зафиксировать production topology | P1 | M-L |
| Score submission не retry-safe | `web/src/main.tsx:731-752` POST-ит score без operation key; `app/api.py:268-282` и service/storage создают новую game для каждого вызова | Повторный tap/retry может добавить дубль в статистику и Elo | Главный пользовательский command не идемпотентен | Добавить client operation id, server-side uniqueness, replay-safe response и API/service/storage tests | P1 | M |
| Critical reads and Elo work не bounded | History загружается/сортируется до pagination в `app/services.py:417-438`; linked score вызывает global Elo rebuild через `app/storage.py:268-315`; API не задаёт rate/quotas | По мере роста истории score и statistics замедляются для всех | Один valid user с linked account может многократно запускать работу, растущую с общей историей | SQL pagination/aggregation, incremental/local Elo update, request quotas и measurements | P1 | M-L |
| Linked history deletion policy не определена для второй стороны | `app/storage.py:1165-1194` удаляет все pair games и оба adjustments; `tests/test_storage_postgres.py:106-124` закрепляет обнуление обоих игроков; UI подтверждает действие только инициатору | Один linked player может стереть общую историю и Elo-следствия для второго | Возможно намеренное shared behavior, но consent/notification/recovery contract отсутствует | Явно выбрать creator-owned или shared-delete policy; для shared destructive action определить peer notification/consent и recovery | P1 | M |
| Action errors and pending states скрыты | `error` рендерится только при отсутствии profile (`web/src/main.tsx:1090-1098`), хотя mutations пишут его позднее; один global `submitting` обслуживает разные действия | Пользователь не понимает, сохранился ли score/profile, скопирован ли invite, почему действие не завершилось | Повторные действия, потеря введённого состояния, недоверие к статистике | Локальные action states, visible retry/success, retained input, `aria-busy`/live feedback | P2 | M |
| Score flow делает POST + 7 GET | `web/src/main.tsx:693-752`; opponent load также делает четыре GET, включая games с limits 10 и 100 | Главный сценарий зависит от восьми запросов и сети | Медленный Telegram WebView даёт долгую блокировку и лишнюю нагрузку API | Возвращать достаточный mutation payload, локально обновлять UI и revalidate в фоне | P2 | M |
| Нет API/frontend/CI safety net | Нет `.github`; `web/package.json` содержит только dev/build/preview; Postgres suite skip без `TEST_DATABASE_URL`; route/component/e2e tests отсутствуют | Малые refactors границ несут высокий regression risk | Agents и deploy не имеют единого зелёного gate | Сначала FastAPI contract/ownership tests и CI для существующих checks, потом узкий component/e2e happy path | P1 | M |
| Dialog/sheet accessibility неполна | `aria-modal` есть, но inert/focus trap/return focus отсутствуют; avatar picker не закрывается Escape (`web/src/main.tsx:676-691,2183-2203`) | Keyboard/VoiceOver могут уйти под модалку | Telegram WebView становится частично неуправляемым | Один accessible dialog/sheet primitive с inert, focus lifecycle, Escape/backdrop | P2 | M |
| Muted semantic colors слишком светлые | `web/src/tokens.css:43-49` задаёт `#a0a0a0`, `#c2c4c5`, `#a8abad` на белом | Вторичный текст и значимые иконки трудно читать | Контраст ниже целевых 4.5:1/3:1 | Изменить semantic values и проверить focus ring; не перестраивать token system | P2 | S |
| Runtime/dependency/license evidence неполны | Python ranges без lock/version; Node version не закреплена при Vite engine requirement; лицензия SB Sans binaries в repo не найдена | Clean build и право распространять font assets не воспроизводимы из repository | Случайная runtime-зависимость и distribution risk | Pin runtimes/constraints; подтвердить SB Sans source/license либо заменить assets | P1 | S-M |

## 5. UI / Existing Design System

| Area | Classification | Evidence | Action |
| --- | --- | --- | --- |
| Typography scale | KEEP | Семантическая rem-шкала в `web/src/tokens.css` | Сохранить; отдельно проверить лицензирование font files |
| Semantic colors | ADAPT | Theme/accent/status разделены, но muted contrast и Telegram theme mapping неполны | Исправить значения и host mapping |
| Spacing/radius | CONSOLIDATE | Часть tokens есть, много локальных literals | Объединять только при работе с конкретным component family |
| Cards/lists/tables | KEEP | Простые button/article/list patterns и empty states | Не вводить parallel component library |
| Buttons/press states | CONSOLIDATE | Несколько вариантов и scale 0.90-0.97 | Выделять primitive после подтверждённого повторения behavior |
| Forms | ADAPT | Labels/disabled есть, общей action feedback model нет | Добавить local pending/error/success contract |
| Dialogs/sheets | ADAPT | Визуально связны, accessibility lifecycle неполон | Общий accessible primitive |
| Loading/error/feedback | REPLACE | Initial state есть, action-level state machine фактически отсутствует | Локальная, доступная feedback model |
| `web/primitives` | KEEP AS SOURCE, NOT ACTIVE SYSTEM | Active imports отсутствуют | Не копировать wholesale и не считать production design system |

## 6. Motion / Interaction

Read-only motion audit не нашёл необходимости менять engine или общий характер интерфейса.

- **KEEP:** короткие durations, отсутствие `ease-in`/`transition: all`, spatially continuous add/navigation surfaces, transform-based motion и interruptible Motion transitions.
- **ADAPT:** reduced-motion media rules не нейтрализуют все press scales; reduced-transparency/high-contrast hook для CSS Module Glass component не срабатывает.
- **REPLACE selectively:** общий посимвольный `MorphingHeading` создаёт Motion/AnimatePresence на каждый символ почти каждого title; оставить его только для реальной continuity/accent роли.
- **ADAPT:** opponent edit sheet входит из вычисленной вручную geometry и исчезает без exit; нужен либо реальный source geometry, либо обычный reversible drawer.
- **CONSOLIDATE:** typed TS motion constants вместо десятков копий двух easing arrays; CSS tokens остаются источником CSS transitions.

Browser/device feel, focus/VoiceOver, dark Telegram WebView и reduced transparency остаются обязательной ручной проверкой перед motion implementation.

## 7. Backend / API

- Routes достаточно тонкие и переиспользуют service layer — **KEEP**.
- Response bodies и TypeScript contracts handwritten — **ADAPT** через явные Pydantic response models и contract tests до iOS; codegen пока не обязателен.
- Body-bearing endpoints не имеют repository-level early request-size limit; input field constraints применяются после JSON parsing. Добавить bounded ASGI/proxy limit после security validation.
- `get_game_history` и stats paths делают полные reads/materialization — переносить pagination/aggregation в SQL после baseline measurements.
- Destructive commands и score submission требуют route-level auth/ownership/replay tests до значимого refactor.

## 8. Database / Migrations

- Текущий schema bootstrap работоспособен для одной ранней runtime, но не является migration history.
- Сначала определить один production migration owner, затем создать baseline revision из текущей схемы и N-1 -> N integration test.
- DDL, data backfill и Elo reconciliation должны иметь разные operational contracts; тяжёлый reconcile не должен неожиданно происходить при каждом startup.
- Не выполнять destructive identity migration, table rewrite или data cleanup без backup, verification и rollback plan.

## 9. Identity / Auth

- Telegram initData HMAC, обязательный `auth_date`, stale и future rejection реализованы и покрыты unit tests — **KEEP**.
- API не принимает acting user id из body/query; storage ownership начинается с `(owner_id, opponent_id)` — **KEEP**.
- `telegram_id` как product primary key — meaningful blocker для независимого iOS auth/account linking, но не blocker для текущей Mini App и не причина немедленной миграции.
- Следующий безопасный шаг для identity — coupling inventory и ADR target model (`users.id` + provider identities), не изменение production schema.

## 10. Security

Стандартный evidence-based scan `470a9241-7fc6-4e76-a6e5-a0f69e5ccba1` проверил auth, ownership, external inputs, logs/secrets, SQL construction и resource limits. Не подтверждены auth bypass, unrelated-object IDOR, SQL injection, SSRF, XSS или secret leakage; повторная отправка score классифицирована как product correctness, а не отдельная vulnerability.

Подтверждены три medium-severity finding:

1. **High confidence:** valid linked user может многократно запускать global Elo rebuild, растущий вместе со всей linked-game history. Это availability risk с valid-account/link prerequisites, не unauthenticated compromise.
2. **High confidence:** history/profile/daily statistics materialize user-controlled full histories до pagination/aggregation; риск ниже, потому что work owner-scoped и требует накопленной истории.
3. **Medium confidence:** JSON routes не имеют repository-owned early body-size limit; FastAPI buffers/decodes body до auth dependency, но production exploitability зависит от неизвестного ingress cap.

Предложение считать linked bulk reset/delete отдельным CWE-862 finding отклонено после parent validation: integration test явно закрепляет shared reset для обоих игроков, поэтому без противоположной product policy обход авторизации не доказан. Consent/notification/recovery остаются отдельным P1 data-policy решением.

## 11. Performance

Critical journeys и фактические hotspots:

| Journey | Current evidence | Recommended baseline |
| --- | --- | --- |
| Open app | 3 parallel GET | Latency, payload, query count |
| Open opponent | 4 GET, games запрашиваются с limits 10 и 100 | Request count, stale-response behavior |
| Submit score | POST + 7 GET before navigation | End-to-visible-success latency, duplicate safety |
| View history/stats | Full reads/sort/materialization before slice | Rows read, DB time, memory, response size |
| Linked score | Global Elo event delete/rebuild | Games scanned, transaction time, lock duration |
| Avatar picker | 3,953 emojis imported, first 320 buttons rendered | Initial bundle delta, open/render time |

Current local production-mode build: JS 406.17 kB / 121.65 kB gzip; CSS 50.63 kB / 9.35 kB gzip. Это локальный baseline, не performance budget. Сначала измерять network/query paths, затем оптимизировать; не вводить cache/offline-first по предположению.

## 12. Testing / CI

Уже защищены scoring/overtime, Elo math/chronology, auth signature/expiry, config guards, bot formatting и часть service/storage behavior. Полный локальный backend run: 86 tests, 7 Postgres tests skipped без `TEST_DATABASE_URL`; frontend build включает strict TypeScript.

Gaps, которые мешают автономным refactors:

1. FastAPI route contracts, auth/ownership and idempotency.
2. Versioned migration upgrade test на отдельном Postgres.
3. Frontend component tests для async feedback/dialog behavior.
4. Один real API + Telegram initData e2e happy path после deploy topology.
5. CI, запускающий существующие backend/build/token/generated checks; lint/type/coverage расширять отдельными решениями.

## 13. Pre-Tournament Product Readiness

| Idea | Readiness | Architectural reason |
| --- | --- | --- |
| Statistics redesign | small adaptation needed | Stats data уже есть; нужны bounded queries, explicit contracts и UI module boundary |
| Shareable statistics | small adaptation needed | Нужен share/export capability и stable presentation payload; identity redesign не обязателен |
| QR opponent linking | small adaptation + product decision | Linked-opponent/invite model уже есть; нужно решить consent, expiration, replay and scanner fallback |
| Appearance/themes | small adaptation needed | Semantic theme/accent groups существуют; Telegram mapping, persistence и user-vs-host precedence не решены |
| Haptics/sound | partly supported | TMA adapter уже даёт haptics; sound policy/opt-out/fallback отсутствуют |
| 3D visualization | isolated feature possible | Core stats можно передать отдельному lazy surface; не добавлять engine до prototype/performance budget |
| Easter eggs | isolated feature possible | Не требуют core rewrite, но нужны lazy loading, reduced motion/transparency and dismissal rules |

## 14. Tournament Readiness

Tournament state/progression можно строить поверх domain/application seam, но пока есть четыре blocker-а:

1. Stable user identity/account-linking rules для non-Telegram future.
2. Versioned migrations и один deploy owner.
3. Explicit API contracts, ownership tests and retry-safe commands.
4. Bounded queries/transactions и измеримый production topology.

Tournament logic не должен жить в React или aiogram handlers. Phase 3 должна подготовить boundaries, а не начинать tournament UI/state machine.

## 15. iOS Readiness

Domain calculations и `TennisService` дают полезную основу, но текущий API всё ещё Telegram-auth-only, handwritten и identity-coupled. До iOS нужны product-owned identity, provider link/recovery semantics, stable versioned API contracts и platform capability boundary. Cross-platform framework, shared UI library и немедленный API codegen сейчас не обоснованы.

## 16. Product Memory / Documentation

Добавлен минимальный durable control plane без изменения product behavior:

- root `AGENTS.md` — invariants, context/Skill routing, validation and Git safety;
- `.agents/SOURCES.md` — exact upstream revisions, install/update method and license caveats;
- `PROJECT.md` / `ARCHITECTURE.md` — product facts and current/planned split;
- `BACKLOG.md` — accepted Phase 3 work only;
- `docs/ideas/` — concepts with Product intent separated from implementation hypotheses;
- `docs/decisions/` — accepted architectural decisions;
- `CHANGELOG.md` — meaningful completed changes and reasons.

Это не даёт идеям право автоматически расширять scope и не подменяет код source of truth.

## 17. Recommended Phase 3 Sequence

1. **API safety envelope:** route-level auth/ownership/response tests and a pre-parse request-body limit.
2. **Reliability boundary:** retry-safe score command + retained input + service/storage replay tests.
3. **Operational schema:** production topology decision, baseline versioned migration and single migration owner.
4. **Bounded critical paths:** measure and move history/stats pagination/aggregation to SQL; replace global per-score Elo rebuild.
5. **Async UX:** local pending/success/error for score, profile, copy/invite, delete/reset and opponent loading; stale request protection.
6. **Frontend boundaries:** extract API contracts/client, Telegram platform adapter usage and cohesive screen/flow state in small behavior-preserving slices.
7. **Accessibility/theme/motion adaptation:** dialog primitive, contrast, Telegram theme mapping, reduced motion/transparency, selective heading/sheet fixes.
8. **Autonomy gates:** CI for proven checks, then narrow frontend/e2e coverage and performance budgets.
9. **Future architecture:** identity ADR and tournament domain model only after the above boundaries are stable.

## First Implementation Slice

**P3-001 — API boundary safety net** is the first implementation slice: add FastAPI route tests for auth freshness, unrelated opponent IDs and representative response shapes, then add an ASGI-level byte cap that rejects oversized JSON with 413 before parsing. Give avatar upload a deliberate larger cap and ordinary commands a small cap. This is high-value and low-risk because it hardens an existing boundary without changing scoring, statistics, UI structure or schema, and it creates the test harness needed by the retry-safe score slice.

## Validation Performed

```text
PYTHONPYCACHEPREFIX=/private/tmp/tennis-bot-phase3-pyc python3 -m unittest discover -s tests
  Ran 86 tests; OK; skipped=7 (Postgres integration requires TEST_DATABASE_URL)

cd web && npm run build
  TypeScript/Vite build passed
  JS 406.17 kB (121.65 kB gzip); CSS 50.63 kB (9.35 kB gzip)

node web/primitives/scripts/check-color-tokens.mjs
node web/primitives/scripts/check-typography-tokens.mjs
node web/primitives/scripts/generate-layout-tokens.mjs --check
node web/primitives/scripts/generate-react-icons.mjs --check
  All passed
```

## Not Validated / Remaining Risks

- Postgres integration suite was not run because no dedicated `TEST_DATABASE_URL` was supplied.
- No browser/device/Telegram WebView visual, focus, VoiceOver, dark-theme or motion-feel validation was performed.
- Production Railway/API/static-web topology and live health were not tested.
- SB Sans distribution rights are not provable from repository files.
- Upstream vendored Skills without repository-level license evidence must not be published until clarified.

## Git Safety

The branch already contained a large uncommitted Mini App continuation before this audit. Product source changes were preserved; bootstrap/audit files are additive and must be reviewed or staged by explicit path only. No commit, push, PR or deploy was performed.

## Implementation Resolution — 2026-08-11

The accepted Phase 3 sequence was implemented without adding tournament or other product functionality:

- FastAPI now has an injectable app factory, route-level auth/ownership/body-limit tests and bounded JSON bodies.
- Score submission uses a stable client operation id and a database uniqueness boundary; the response carries enough current state to avoid seven follow-up GETs.
- Linked reset/delete follows DECISION-002: owner-local cutoff/hide, peer retention, restore on next game and zero restart only after both sides clear data.
- Ordinary linked scoring locks two player rows and appends two Elo events incrementally; global rebuild remains only for rare destructive corrections.
- Global game history now uses database count/limit/offset instead of materializing all opponent histories in the service.
- Versioned migrations and `schema_migrations` replace startup DDL; the Railway API pre-deploy is the single migration owner.
- API transport/types are extracted from the main React module; pending states are action-scoped, stale opponent responses are ignored, and mutation errors are rendered in the active layer.
- Docker, pinned runtime majors, CI and separate Railway bot/API configs establish a reproducible delivery boundary.

## Implementation Validation — 2026-08-11

```text
Python 3.12 environment with requirements-dev.lock
  Ran 96 tests; OK; skipped=9 (Postgres integration requires TEST_DATABASE_URL)

cd web && npm run build
  TypeScript/Vite build passed
  JS 409.25 kB (122.76 kB gzip); CSS 51.31 kB (9.48 kB gzip)

Token/generated checks, pip check and delivery-manifest parsing
  All passed
```

The local Postgres integration run remains blocked by Docker Desktop configuration: an obsolete shared directory (`/System/Volumes/Data/Users/g.plaxienko/work/timepad`) is missing, so the daemon cannot start. CI now owns the mandatory Postgres 16 migration/upgrade and storage suite.

Still requiring external validation rather than more repository refactoring: a dedicated live Railway deployment, Telegram WebView/device checks, production latency/query measurements, SB Sans distribution evidence, and a future decision on frontend test/lint/e2e tooling.
