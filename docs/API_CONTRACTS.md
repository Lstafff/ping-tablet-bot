# API response contracts

## Source of truth

Successful HTTP response shapes are defined by Pydantic models in `app/api_contracts.py` and attached to FastAPI routes through `response_model`. FastAPI's `/openapi.json` is therefore the machine-readable contract for the current API.

Error bodies that belong to stable route semantics use `ErrorResponse` (`{"detail": string}`) in the route's documented `responses`. FastAPI's validation response for malformed request payloads remains the framework-standard `422` contract.

## TypeScript synchronization strategy

`web/src/api/types.ts` is a deliberate manual mirror of the OpenAPI response models. This is the current choice because there is one TypeScript client and the contract surface is still small; generated clients would add a build artifact and generator lifecycle without yet removing meaningful maintenance cost.

Every response-contract change must update one slice atomically:

1. Change the Pydantic response model and the route's `response_model`.
2. Add or update the representative API shape/error test in `tests/test_api.py`.
3. Mirror the affected fields in `web/src/api/types.ts` and its local-preview fixture.
4. Run `./scripts/verify.sh`; CI repeats the same checks with Postgres.

Reconsider OpenAPI code generation when a second non-Telegram client exists or repeated contract drift demonstrates that the manual mirror is no longer economical.

## Current stable model pairs

| API model | TypeScript type |
| --- | --- |
| `ProfileResponse` | `Profile` |
| `OpponentsResponse` | `OpponentsResponse` |
| `HistoryResponse` | `HistoryView` |
| `OpponentStatsResponse` | `OpponentStats` |
| `DailyViewResponse` | `DailyView` |
| `GamesViewResponse` | `GamesView` |
| `ScoreResponse` | `ScoreResponse` |
| `InviteResponse` | `InviteResponse` |
| `InviteAcceptResponse` | `InviteAcceptResponse` |
