# DECISION-004 — Separate product identity from Telegram in a later additive migration

Status: planned direction
Date: 2026-08-11

## Current coupling

`users.telegram_id` is both Telegram identity and product primary key. It is referenced by opponents, games, Elo events, sessions, invites, bot callbacks, Mini App auth and `TennisService` method signatures. This is acceptable for the current Telegram-only clients but cannot represent an independent iOS login or account recovery.

## Target

Introduce a product-owned `users.id` and an `auth_identities(provider, external_id, user_id)` table. Telegram becomes one provider; product/domain code receives `user_id`, while Telegram adapters resolve `telegram_id` at the boundary.

## Staged migration constraint

1. Add and backfill product IDs and identity rows without changing current keys.
2. Add shadow product-ID foreign keys and verification queries.
3. Dual-write at the repository boundary and compare results.
4. Switch services and API contracts only after account-linking, collision and recovery rules are accepted.
5. Keep Telegram columns during a rollback window; remove old constraints only in a later reviewed migration with a verified backup.

## Not decided

The login provider, account-linking proof, recovery flow and iOS delivery cost are product decisions. No identity schema rewrite or cross-platform framework is authorized by Phase 3.
