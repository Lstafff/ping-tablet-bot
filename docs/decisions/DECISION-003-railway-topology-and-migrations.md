# DECISION-003 — Deploy bot worker plus API/static service with one migration owner

Status: accepted
Date: 2026-08-11

## Context

The repository contains aiogram polling, FastAPI and a Vite Mini App. One Railway process cannot safely represent both long-lived polling and the public HTTP lifecycle, and runtime DDL from both entrypoints creates a race.

## Decision

- Build one reproducible Docker image with Python 3.12, Node 22 and `web/dist`.
- Run two Railway services from the same repository: bot worker via `/railway.json`, public API/static web via `/railway.api.json`.
- The API service is the only pre-deploy migration owner and runs `python -m app.migrations` under a Postgres advisory lock.
- Both application entrypoints only verify the schema ledger and fail clearly when it is absent or stale.
- FastAPI serves `/api/*`, `/health` and same-origin static Mini App assets; the bot worker has no public domain.

## Consequences

The first Railway rollout must deploy and verify API/migrations before relying on the bot retry policy. Config files prepare the deployment but do not create services, set secrets, publish a domain or change BotFather settings. Schema rollback is backup-based; automatic destructive down-migrations are intentionally absent.
