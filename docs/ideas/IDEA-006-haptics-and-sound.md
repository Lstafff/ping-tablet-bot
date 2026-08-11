# IDEA-006 — Haptics and sound

Status: partly-implemented

## Product intent

Use physical and audio feedback only where it makes important actions clearer or rare moments more expressive.

## Implementation hypotheses

- Semantic feedback intents: selection, light impact, significant impact, success, warning and error.
- Telegram implementation now, future iOS implementation later, unsupported platforms as no-op.
- Sound only for selected completion/celebration moments, with an off preference if it becomes noticeable.

## Why

Good feedback can make fast score entry confident without adding visual delay.

## Relevant when

- score input and completion;
- destructive actions;
- celebration or success;
- platform capability work.

## Done when

Feedback semantics are intentional and consistent; unsupported platforms degrade safely; sound use passes `$sound`; user control exists if sound is persistent or noticeable.

## Evidence

Partly implemented on 2026-08-11: `web/src/lib/tma.ts` isolates Telegram haptic methods and `web/src/main.tsx` uses selection/impact/notification feedback. No sound capability or preference exists.
