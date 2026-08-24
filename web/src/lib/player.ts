import type { HistoryGame, Opponent, Stats, User } from "../api/types";

export function userName(user: User): string {
  if (user.display_name) return user.display_name;
  if (user.username) {
    return user.username.startsWith("@") ? user.username : `@${user.username}`;
  }
  return user.first_name || "Игрок";
}

export function opponentName(opponent: Opponent): string {
  if (opponent.display_name) {
    return opponent.display_name;
  }
  if (opponent.first_name) {
    return opponent.first_name;
  }
  if (opponent.username) {
    return opponent.username.startsWith("@") ? opponent.username : `@${opponent.username}`;
  }
  return opponent.first_name || opponent.name;
}

export function initials(value: string): string {
  const clean = value.replace(/^@/, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || "—";
}

export function historyGameKey(game: Pick<HistoryGame, "game_id" | "opponent_id" | "opponent_score" | "own_score" | "played_at">): string {
  return `${game.opponent_id}-${game.game_id ?? game.played_at}-${game.own_score}-${game.opponent_score}`;
}

export function gamesCount(stats: Stats): number {
  return stats.wins + stats.losses;
}

export function winRate(stats: Stats): number {
  const games = gamesCount(stats);
  return games ? Math.round((stats.wins / games) * 100) : 0;
}
