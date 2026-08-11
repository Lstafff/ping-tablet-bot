# Phase 3 Backlog

Ideas are tracked separately in `docs/ideas/`. An idea appears here only after it becomes agreed work.

## COMPLETED IN PHASE 3

### P3-001 — Add the API boundary safety net

- Status: done
- Goal: protect the current auth, ownership, request-size and response contracts before changing shared behavior.
- Acceptance: FastAPI route tests cover missing/valid/stale/future initData, unrelated opponent IDs and representative response shapes; an ASGI-level byte limit returns 413 before JSON parsing/auth work; avatar and ordinary JSON routes have explicit caps.
- Evidence: `tests/test_api.py`, `BodySizeLimitMiddleware`, existing signed-initData unit suite; ordinary JSON is capped at 16 KiB and avatar JSON at 220 KiB.

### P3-002 — Make score submission retry-safe

- Status: done
- Goal: a network retry or repeated tap must not create a duplicate game.
- Acceptance: one client operation maps to at most one game; entered score remains available until success; pending/success/error are visible at the score action; API/service/storage tests cover replay and ownership.
- Evidence: `games.operation_id`, unique creator/operation index, client-stable operation id retained through errors, service/API/Postgres tests.

### P3-003 — Define linked-history destructive policy

- Status: done — owner-local policy accepted
- Goal: decide whether linked match history is creator-owned or jointly owned before changing reset/delete behavior.
- Acceptance: score undo, bulk reset and opponent deletion use one explicit policy; the second participant's consent/notification and recovery behavior are specified; API/storage tests cover both creators.
- Evidence: DECISION-002 and Postgres tests cover one-sided reset/delete, peer restore and zero restart after both sides clear data.

### P3-004 — Establish versioned database migrations

- Status: done
- Goal: make schema changes reproducible and owned by one deploy step rather than both runtime entrypoints.
- Acceptance: current schema has a baseline revision; migrations have apply/verify/rollback instructions; bot and API startup do not race ad hoc DDL; a dedicated Postgres test validates upgrade from the baseline.
- Evidence: `app/migrations.py`, schema ledger/advisory lock, runtime version assertion, Docker/Railway configs and CI Postgres migration step.

### P3-005 — Make async feedback local and complete

- Status: done
- Goal: users understand loading, success and failure without losing input or relying on a hidden global error.
- Acceptance: save, copy, invite, delete/reset, rating and avatar flows have local pending/success/error behavior; offline/retry behavior is explicit; unrelated controls are not blocked by one global flag; accessible live regions are used where appropriate.
- Evidence: action-scoped pending state, retained score draft/operation id, live error surfaces, invite copy success, stale opponent request protection.

### P3-006 — Bound critical read and score paths

- Status: done for implementation; production measurement remains operational follow-up
- Goal: avoid loading and sorting complete history for paginated home/statistics screens.
- Evidence: global history uses SQL count/limit/offset; ordinary linked score updates two locked Elo rows/events instead of rebuilding all Elo; score UI no longer waits for seven follow-up GETs.

### P3-007 — Clarify frontend module boundaries

- Status: done for the Phase 3 slice
- Goal: reduce change risk in the 2,500-line application component without a visual rewrite.
- Evidence: `web/src/api/client.ts` and `web/src/api/types.ts` isolate transport/contracts; existing `tma`, tokens and components are reused; no UI library was added.

### P3-009 — Add proportional CI gates

- Status: done for current toolchain
- Goal: make agent autonomy depend on repeatable checks.
- Evidence: `.github/workflows/ci.yml` runs Postgres migrations/integration tests and the strict Vite build. Frontend unit/e2e/lint stay explicit future tool decisions.

## LATER

### P3-008 — Implement product identity separation

- Status: planned; target and migration constraints documented in DECISION-004
- Goal: make Telegram one auth provider instead of the permanent product-user primary key.
- Acceptance: coupling inventory, target schema, account-linking rules, staged migration, rollback and cost are documented; no destructive migration is executed in this task.
