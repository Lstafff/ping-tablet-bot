# IDEA-002 — Shareable statistics story card

Status: open

## Product intent

Let a player assemble a clear vertical visual of their statistics and share it to stories or another platform.

## Implementation hypotheses

- Build a dedicated share representation from the same statistics model as the product UI.
- Render client-side, server-side or hybrid after comparing privacy, visual quality, deployment and platform requirements.
- Use a platform share capability rather than Telegram-only business logic.

These are hypotheses, not requirements. A screenshot of the current Stats screen is not the assumed architecture.

## Why

Sharing can make progress visible and create organic discovery without coupling statistics to one screen.

## Relevant when

- statistics model or redesign;
- image/media rendering;
- platform share boundary;
- iOS planning.

## Done when

The shared card uses consistent statistics, protects private data, has an export/share fallback and is validated on target platforms.

## Evidence

Not implemented. Current sharing in `web/src/main.tsx` is for opponent invite text, not statistics media.
