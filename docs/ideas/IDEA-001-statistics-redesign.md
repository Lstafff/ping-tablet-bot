# IDEA-001 — Statistics redesign

Status: open

## Product intent

Make statistics easier to understand, more useful and faster to scan. Start from the questions users want statistics to answer, not from a new chart layout.

## Implementation hypotheses

- Reorder hierarchy around a small set of meaningful metrics.
- Reuse one server-owned statistics model across profile, opponent and future share representations.
- Reduce repeated fetches and client-side recomputation where measurements show cost.

These are hypotheses, not requirements. Use `$ask-nodumb` before redesign.

## Why

The current screen exposes useful data, but its meaning, hierarchy and data pipeline have not been validated as a product model.

## Relevant when

- statistics screen or metric hierarchy;
- aggregation/API changes;
- tournament reporting;
- shareable statistics.

## Done when

User questions and primary metrics are explicit; accepted hierarchy is validated; all representations use consistent source data; loading/empty/error states are designed.

## Evidence

Not implemented. Existing stats live across `app/domain.py`, `app/storage.py`, `app/services.py`, `app/api.py` and `web/src/main.tsx`.
