# Architecture

This document describes the current working tree. `Current` is evidence from the repository; `Direction / Planned` is not implemented unless explicitly stated.

## Current

### Runtime surfaces

```text
Telegram chat update                         Telegram Mini App
        |                                           |
    app.bot                                  web/src/main.tsx
        |                                           |
        |                                      HTTP /api/*
        |                                           |
        +------------> TennisService <--------- app.api
                              |
                           Database
                              |
                           Postgres
```

- `app.bot` is an aiogram polling entrypoint and Railway worker (`railway.json`).
- `app.api` is a FastAPI entrypoint that also serves the built `web/dist`; Railway uses `/railway.api.json`, `$PORT` and `/health`.
- `web/src/main.tsx` is the active React/Vite Mini App. It calls the API with signed Telegram `initData` through `web/src/api/client.ts`; request/response types live in `web/src/api/types.ts`.
- `web/src/lib/tma.ts` is a useful Telegram capability adapter for init data, viewport/safe-area updates, links, haptics and back-button behavior.

### Domain and application boundaries

- `app.scoring`, `app.elo`, `app.rating` and pure helpers in `app.domain` hold focused rules/calculations.
- `app.services.TennisService` is the shared application layer used by both bot handlers and FastAPI routes.
- `app.storage.Database` owns repository queries and transactions. `app.migrations` is the only schema owner; runtime constructors only verify `schema_migrations`.
- FastAPI endpoints remain thin in control flow; Pydantic models in `app/api_contracts.py` define their successful response shapes and documented stable errors through `response_model`/OpenAPI.
- TypeScript API shapes in `web/src/api/types.ts` are a deliberate manual mirror of OpenAPI. `docs/API_CONTRACTS.md` defines the atomic synchronization checklist; code generation remains deferred while there is only one TypeScript client.

### Data model and identity

- Postgres tables include `users`, `opponents`, `games`, `aggregate_adjustments`, `elo_events`, `sessions` and `invite_uses`.
- `users.telegram_id` is the primary key and is also used as the product user identifier throughout domain/service/storage APIs.
- `opponents` supports both local opponents (`opponent_user_id IS NULL`) and links to registered users. `history_start_game_id` and `is_hidden` make reset/delete owner-local without duplicating shared game rows.
- Linked games are shared records between two registered players; ownership checks start from an owner-scoped opponent lookup. Reset/delete affects only the initiating owner's view. A later linked game restores mirrored statistics from the peer that retained them; if neither side retained data, the pair starts from zero.

### Authentication and authorization

- Mini App auth validates the Telegram HMAC, requires `auth_date`, rejects future data and expires old data using a configurable maximum age.
- API routes derive the current user only from validated `initData`; client-supplied product user IDs are not trusted.
- Storage lookups such as `get_opponent(owner_id, opponent_id)` scope objects to the current owner before reads or mutations.
- Telegram callbacks derive the acting user from `callback.from_user.id` and reuse the same service/storage ownership boundary.

### Schema evolution

- `app.migrations` owns an advisory-locked `schema_migrations` ledger and standalone `python -m app.migrations` command.
- Railway API pre-deploy is the single migration owner. Bot/API startup fail clearly on a missing or stale schema instead of racing DDL.
- Migrations are additive; operational rollback uses a compatible application revision or a verified Postgres backup for data rollback.

### Frontend system

- `web/src/main.tsx` remains the orchestration boundary for data, mutations and navigation. Presentation is split by feature under `web/src/features/`, while reusable controls and motion identities live under `web/src/components/` and `web/src/lib/`; feature CSS stays with its owner and root styles cover the shell/shared rules.
- `web/src/tokens.css` already separates semantic theme, accent, status, material and motion tokens. This is a strong base to keep.
- Motion uses `motion/react`, shared easing/duration tokens and multiple `useReducedMotion` branches.
- Every conditional element with an explicit enter animation must define the matching exit behavior on the same motion boundary. Continuous feedback such as press states, skeleton pulse and value interpolation is not an enter/exit lifecycle; it still must stop when its owner unmounts.
- The copied `web/mini-app` and `web/primitives` trees are source libraries, not the active design system wholesale. Active code imports only Telegram runtime helpers from them; the main navigation glass material is the isolated `@samasante/liquid-glass` package, while geometry, tokens, controls and motion remain project-owned.
- Initial home load waits only for profile and opponents; history loads on first visit. Opponent identity renders immediately, total stats unblock the full screen, and table/chart requests finish in the background with stale-response protection.
- Linked opponents read `display_name` and `avatar_value` live from the connected user row, so profile changes are visible to the other player without rewriting the relationship record.
- Score mutation returns the updated profile/opponent state and updates the local history immediately instead of waiting for seven follow-up GETs.
- Pending state is scoped by action family; errors have a rendered live surface and modal flows render feedback inside the active layer.

### Validation and delivery

- Backend uses `unittest`; Postgres integration tests run only when `TEST_DATABASE_URL` is supplied.
- Frontend gates include ESLint, focused Vitest component tests, a mobile Playwright Mini App smoke path and the TypeScript/Vite production build.
- `scripts/verify.sh` and `.github/workflows/ci.yml` run migrations/backend coverage where applicable plus the frontend lint, unit, build and e2e gates. The browser smoke path complements rather than replaces final Telegram WebView checks on real devices.
- Docker and separate Railway config files define bot worker plus API/static-web topology. Live Railway behavior remains unverified until an approved deploy.

## Direction / Planned

### Product core and clients

```text
Telegram Bot ----\
Mini App ---------> stable API -> application/domain services -> repositories -> Postgres
iOS (later) ------/
```

- Preserve `TennisService` as the current shared seam, then split only responsibilities proven to change independently.
- Define stable request/response contracts before adding a second non-Telegram client; code generation is optional, not a Phase 3 requirement.
- Tournament state and progression belong in domain/application code, never React components.

### Identity

Target a product-owned user key with separate platform identities, for example `users.id` plus `auth_identities(provider, external_id, user_id)`. Phase 3 should first inventory coupling and create a reversible migration plan. Do not perform a destructive identity migration without backup, verification, rollback and a product decision about account linking.

### Migrations

Keep the current lightweight versioned runner while migrations remain small and additive. Adopt a framework only when dependency ordering, downgrade metadata or migration volume creates a proven gap; do not mix framework adoption with schema redesign.

### Platform capabilities

Evolve the existing `tma` adapter only when a real second implementation appears. Product code should request semantic capabilities such as share, haptic success or scanner input; Telegram, web fallback and future iOS can implement them differently.
