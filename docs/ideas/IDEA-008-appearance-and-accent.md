# IDEA-008 — Appearance and accent customization

Status: partly-implemented

## Product intent

Let the user choose system, light or dark appearance and a safe main accent color without weakening contrast or status semantics.

## Implementation hypotheses

- Resolve `system | light | dark` through a platform-aware appearance boundary.
- Override existing semantic theme and accent token groups rather than introducing a second token system.
- Keep destructive/status colors independent from user accent.
- Add user-level persistence only when cross-client sync is an approved requirement.

## Why

Personalization can make the product feel owned while the same semantic component system supports Telegram and future iOS.

## Relevant when

- token or component audit;
- Telegram theme integration;
- settings/profile;
- future cross-client preferences.

## Done when

All modes meet contrast/readability requirements; disabled/destructive states remain clear; system changes resolve correctly; persistence behavior is explicit; Mini App and future clients can share the preference model.

## Evidence

Partly implemented on 2026-08-11: `web/src/tokens.css` separates theme, accent and status groups, while `web/src/lib/tma.ts` reads Telegram appearance. The product is still forced to `color-scheme: light`; there is no user choice or persisted preference.
