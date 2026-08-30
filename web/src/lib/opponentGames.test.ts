import { describe, expect, it } from "vitest";

import type { GamesView, RecentGame } from "../api/types";
import { firstOpponentGamesPage } from "./opponentGames";

describe("firstOpponentGamesPage", () => {
  it("reuses one overview response for the heatmap and ten-row progressive page", () => {
    const games: RecentGame[] = Array.from({ length: 25 }, (_, index) => ({
      game_id: index + 1,
      played_at: `2026-08-${String(28 - index).padStart(2, "0")}T12:00:00Z`,
      own_score: 11,
      opponent_score: index % 2 ? 9 : 8,
    }));
    const overview: GamesView = {
      opponent_name: "Мария",
      games,
      page: 1,
      total_pages: 1,
      total_items: 25,
    };

    const page = firstOpponentGamesPage(overview);

    expect(page.games).toEqual(games.slice(0, 10));
    expect(page.total_pages).toBe(3);
    expect(page.total_items).toBe(25);
    expect(overview.games).toHaveLength(25);
  });
});
