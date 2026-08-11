# IDEA-005 — QR opponent linking

Status: open

## Product intent

Let a player add or link an opponent by scanning a QR code created inside the product.

## Implementation hypotheses

- Encode an opaque invite/link token, not a raw database or Telegram ID.
- Redeem on the server with authorization, validation and idempotency.
- Keep scanning behind a platform capability so Telegram/web and future iOS can use different camera implementations.

Expiration, revocation and one-time semantics depend on the product flow and are not requirements yet.

## Why

QR can make in-person opponent linking faster and can support future social/tournament flows.

## Relevant when

- invites and opponent linking;
- identity separation;
- camera/scanner capability;
- tournaments.

## Done when

The product model distinguishes local opponent from registered user; token contains no trusted raw identity; redemption is server-validated and idempotent; repeat scans have defined behavior.

## Evidence

Not implemented. Current `opponents.opponent_user_id` already allows an optional registered-user link, and current invite codes are opaque server-resolved identifiers.
