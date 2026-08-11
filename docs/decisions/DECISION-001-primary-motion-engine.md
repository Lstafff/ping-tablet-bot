# DECISION-001 — Use Motion as the primary React animation engine

Status: accepted
Date: 2026-08-11

## Context

The active Mini App already uses `motion/react` for layout continuity, enter/exit transitions, springs and reduced-motion branching. CSS handles simple press/color transitions.

## Decision

Keep Motion as the single primary React animation engine. Prefer CSS for simple deterministic transitions; use Motion for layout, gesture, spring and interruptible enter/exit behavior. Do not add `framer-motion` as a second package or introduce another engine without a proven capability gap.

## Consequences

- Existing motion code and skill guidance share one API.
- Motion does not become mandatory for every transition.
- Every motion change must pass `$review-animations` and reduced-motion validation.
