import type { GamesView } from "../api/types";

export const opponentGamesPageSize = 10;

export function firstOpponentGamesPage(
  overview: GamesView,
  pageSize = opponentGamesPageSize,
): GamesView {
  return {
    ...overview,
    games: overview.games.slice(0, pageSize),
    page: 1,
    total_pages: Math.max(1, Math.ceil(overview.total_items / pageSize)),
  };
}
