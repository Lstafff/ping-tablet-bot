import type { Opponent, Stats } from "../api/types";

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

export function gamesCount(stats: Stats): number {
  return stats.wins + stats.losses;
}

export function winRate(stats: Stats): number {
  const games = gamesCount(stats);
  return games ? Math.round((stats.wins / games) * 100) : 0;
}
