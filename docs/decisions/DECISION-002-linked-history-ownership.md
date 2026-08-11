# DECISION-002 — Keep linked reset/delete owner-local and restore on play

Status: accepted
Date: 2026-08-11

## Context

A linked match is one shared game record visible from two owner-scoped opponent rows. Previously either player could reset or delete the pair's physical history, both adjustments and Elo consequences for the other player.

## Decision

- Reset clears statistics only for the initiating owner and keeps the opponent in that owner's list.
- Delete hides the opponent and clears statistics only for the initiating owner.
- The peer's opponent row, statistics and Elo remain unchanged; no peer consent or notification is required for an owner-local view action.
- When the pair records another game, a player with cleared/hidden history is restored from the peer's retained cutoff and mirrored adjustment before the new game is added.
- If neither player retains statistics, old pair games are purged and the next game starts the pair from zero.
- Undo is different: the creator retracts one shared game record, so the correction remains visible to both players and recalculates Elo.

## Consequences

`opponents.history_start_game_id` is a per-owner visibility cutoff and `is_hidden` is a per-owner list state. Shared `games` are retained while either side still references them. Confirmation copy must explain restoration and the zero-start case; it must not claim that one player deletes the peer's history.
