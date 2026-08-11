# IDEA-007 — Pong easter egg

Status: open

## Product intent

Offer a hidden Pong-like mini-game as an optional playful easter egg.

## Implementation hypotheses

- Separate lazy-loaded feature/module.
- Touch-first loop with complete stop and resource cleanup on exit/inactivity.
- Retro styling is optional, not a requirement.

## Why

It may add a memorable hidden layer without changing the core match workflow.

## Relevant when

- rare delight roadmap;
- performance budget and code splitting;
- about/author discovery.

## Done when

The game is outside the critical initial bundle, stops when inactive, cleans resources, supports touch and low-power fallback, and has no backend dependency unless a separate social/persistence need is approved.

## Evidence

Not implemented.
