# Tennis / Ping Tablet

Tennis is a Telegram-first product for recording table-tennis matches, tracking opponents, statistics and Elo rating. It currently has two user surfaces: the original Telegram text bot and a Telegram Mini App.

## Core scenarios

- open the product and see profile, opponents and recent matches;
- choose an opponent and submit or undo a score;
- inspect total, daily and per-game statistics;
- adjust totals, reset statistics or delete an opponent;
- link registered players through an invite code;
- manage profile name, avatar and rating.

## Current phase

Phase 3 refactoring is implemented in the current branch: retry-safe score writes, owner-local linked reset/delete semantics, versioned migrations, bounded history reads, incremental Elo on score, API safety checks, frontend API boundaries, scoped async feedback and reproducible CI/Railway entrypoints. This does not add tournaments or other product functionality.

## Direction

The next major product capability is tournament creation and operation. After tournaments, a native iOS client is a possible direction. Telegram remains an important client, but Telegram-specific identity and APIs must not become the permanent boundary of the product core.

See [ARCHITECTURE.md](ARCHITECTURE.md) for current facts versus planned direction and [ideas/INDEX.md](ideas/INDEX.md) for concepts that are not approved scope.
