import { requestApi } from "../api/client";
import type { GamesView, HistoryGame, Opponent, OpponentStats, Profile, RecentGame } from "../api/types";
import { levelIndexFor, playerLevels } from "../features/profile/playerLevels";
import { gamesCount, opponentName } from "./player";
import { tma } from "./tma";

function isPreviewFntRating(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && ["ttfr.ru", "www.ttfr.ru", "rttf.ru", "www.rttf.ru"].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function calculatePreviewEloChange(playerRating: number, opponentRating: number, games: number, won: boolean): number {
  const ratingDifference = Math.max(-400, Math.min(400, playerRating - opponentRating));
  const expectedScore = 1 / (1 + 10 ** (-ratingDifference / 400));
  const kFactor = games < 10 ? 40 : games < 30 ? 32 : 24;
  const value = kFactor * ((won ? 1 : 0) - expectedScore);
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

const BROWSER_PREVIEW = !tma.isTelegram();

const previewProfile: Profile = {
  user: {
    telegram_id: 1,
    first_name: "Алексей",
    username: "alexey",
    last_message_id: null,
    created_at: "2025-02-14T12:00:00+03:00",
    rating: "412",
    rating_is_fnt: false,
    display_name: null,
    avatar_value: null,
    elo_rating: 720,
    elo_games: 95,
  },
  stats: { wins: 58, losses: 37, points_for: 1018, points_against: 936 },
  extended_stats: {
    games: 95,
    overtime_wins: 8,
    overtime_losses: 5,
    longest_own_score: 14,
    longest_opponent_score: 12,
    longest_points: 26,
    win_streak: 6,
    large_margin_games: 12,
    close_margin_games: 17,
    most_common_score: "11:8",
    most_common_score_count: 14,
  },
  player_level: "Любитель",
};

const previewOpponents: Opponent[] = [
  { id: 1, name: "Мария", first_name: "Мария", username: "maria", display_name: null, avatar_value: "🏓", elo_rating: 680, stats: { wins: 24, losses: 13, points_for: 416, points_against: 359 } },
  { id: 2, name: "Иван", first_name: "Иван", username: "ivan", display_name: null, avatar_value: null, elo_rating: 750, stats: { wins: 18, losses: 17, points_for: 358, points_against: 349 } },
  { id: 3, name: "Даша", first_name: "Даша", username: null, display_name: null, avatar_value: null, elo_rating: null, stats: { wins: 16, losses: 7, points_for: 244, points_against: 228 } },
];

const previewOpponentStats: OpponentStats = {
  opponent_name: "@maria",
  user_name: "@alexey",
  stats: { wins: 24, losses: 13, points_for: 416, points_against: 359 },
  extended_stats: {
    games: 37,
    overtime_wins: 4,
    overtime_losses: 2,
    longest_own_score: 14,
    longest_opponent_score: 12,
    longest_points: 26,
    win_streak: 5,
    large_margin_games: 6,
    close_margin_games: 8,
    most_common_score: "11:9",
    most_common_score_count: 9,
  },
};

function previewStatsForOpponent(path: string): OpponentStats {
  const opponentId = Number(path.match(/\/opponents\/(\d+)/)?.[1] ?? 1);
  const opponent = previewOpponents.find((item) => item.id === opponentId) ?? previewOpponents[0];
  const stats = opponent.stats ?? previewOpponentStats.stats;
  return {
    ...structuredClone(previewOpponentStats),
    opponent_name: opponentName(opponent),
    stats: structuredClone(stats),
    extended_stats: {
      ...structuredClone(previewOpponentStats.extended_stats),
      games: gamesCount(stats),
    },
  };
}

const previewGames: GamesView = {
  opponent_name: "@maria",
  games: [
    { played_at: "2026-07-21T19:30:00+03:00", own_score: 11, opponent_score: 8, elo_change: 11 },
    { played_at: "2026-07-21T19:18:00+03:00", own_score: 9, opponent_score: 11, elo_change: -13 },
    { played_at: "2026-07-18T20:05:00+03:00", own_score: 12, opponent_score: 10, elo_change: 0 },
    { played_at: "2026-07-16T18:42:00+03:00", own_score: 8, opponent_score: 11 },
    { played_at: "2026-07-15T21:10:00+03:00", own_score: 11, opponent_score: 6 },
    { played_at: "2026-07-13T19:04:00+03:00", own_score: 11, opponent_score: 9 },
    { played_at: "2026-07-12T20:15:00+03:00", own_score: 7, opponent_score: 11 },
    { played_at: "2026-07-10T18:30:00+03:00", own_score: 13, opponent_score: 11 },
    { played_at: "2026-07-08T19:55:00+03:00", own_score: 11, opponent_score: 5 },
    { played_at: "2026-07-06T17:40:00+03:00", own_score: 9, opponent_score: 11 },
    { played_at: "2026-07-04T20:22:00+03:00", own_score: 11, opponent_score: 7 },
  ],
  page: 1,
  total_pages: 1,
};

const PREVIEW_PAGE_SIZE = 3;

const previewGamesByOpponent = new Map<number, RecentGame[]>(
  previewOpponents.map((opponent) => [opponent.id, structuredClone(previewGames.games)]),
);
let previewGameId = 999;
const previewSavedGames = new Map<number, { opponentId: number; game: RecentGame; historyGame: HistoryGame }>();

const previewDailyStats = [
  { played_on: "2026-07-21", wins: 1, losses: 1 },
  { played_on: "2026-07-18", wins: 2, losses: 0 },
  { played_on: "2026-07-12", wins: 1, losses: 2 },
  { played_on: "2026-07-08", wins: 2, losses: 1 },
  { played_on: "2026-07-04", wins: 1, losses: 0 },
  { played_on: "2026-06-29", wins: 0, losses: 2 },
  { played_on: "2026-06-22", wins: 3, losses: 1 },
];

function previewPlayedAt(daysAgo: number, hour: number, minute: number): string {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

let previewHistoryGames: HistoryGame[] = [
  { opponent_id: 1, opponent_name: "Мария", played_at: previewPlayedAt(0, 19, 30), own_score: 11, opponent_score: 8, elo_change: 11 },
  { opponent_id: 2, opponent_name: "Иван", played_at: previewPlayedAt(0, 18, 10), own_score: 9, opponent_score: 11, elo_change: -13 },
  { opponent_id: 3, opponent_name: "Даша", played_at: previewPlayedAt(3, 20, 5), own_score: 12, opponent_score: 10, elo_change: 0 },
  { opponent_id: 1, opponent_name: "Мария", played_at: previewPlayedAt(8, 17, 45), own_score: 11, opponent_score: 6, elo_change: 10 },
  { opponent_id: 2, opponent_name: "Иван", played_at: previewPlayedAt(14, 18, 25), own_score: 11, opponent_score: 9, elo_change: 9 },
  { opponent_id: 3, opponent_name: "Даша", played_at: previewPlayedAt(21, 19, 5), own_score: 8, opponent_score: 11, elo_change: -10 },
  { opponent_id: 1, opponent_name: "Мария", played_at: previewPlayedAt(28, 20, 15), own_score: 13, opponent_score: 11, elo_change: 12 },
  { opponent_id: 2, opponent_name: "Иван", played_at: previewPlayedAt(36, 16, 20), own_score: 7, opponent_score: 11, elo_change: -12 },
];

function requestedPage(path: string): number {
  return Math.max(1, Number(new URL(path, window.location.origin).searchParams.get("page") ?? 1));
}

function pagedPreview<T>(items: T[], page: number, pageSize = PREVIEW_PAGE_SIZE): { items: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize;
  return { items: structuredClone(items.slice(start, start + pageSize)), totalPages };
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (BROWSER_PREVIEW) {
    return previewApi<T>(path, options);
  }

  const initData = tma.initData();
  if (!initData) {
    throw new Error("Откройте мини-приложение внутри Telegram");
  }

  return requestApi<T>(path, initData, options);
}

async function previewApi<T>(path: string, options: RequestInit): Promise<T> {
  const method = options.method ?? "GET";
  const payload = options.body ? JSON.parse(options.body as string) as { value?: string; score?: string } : {};
  const opponentId = Number(path.match(/\/opponents\/(\d+)/)?.[1] ?? 0);

  if (path === "/api/profile") {
    return structuredClone(previewProfile) as T;
  }
  if (path === "/api/profile/name" && method === "PUT") {
    previewProfile.user.display_name = payload.value ?? null;
    return structuredClone(previewProfile) as T;
  }
  if (path === "/api/profile/avatar" && method === "PUT") {
    previewProfile.user.avatar_value = payload.value ?? null;
    return structuredClone(previewProfile) as T;
  }
  if (path === "/api/opponents") {
    return { opponents: structuredClone(previewOpponents) } as T;
  }
  if (path.startsWith("/api/games")) {
    const page = requestedPage(path);
    const result = pagedPreview(previewHistoryGames, page);
    const opponent = previewOpponents.find((item) => item.id === opponentId);
    return { opponent_name: opponent ? opponentName(opponent) : "Соперник", games: result.items, page, total_pages: result.totalPages } as T;
  }
  if (path.includes("/stats") || path.includes("/totals/")) {
    return previewStatsForOpponent(path) as T;
  }
  if (path.includes("/games")) {
    const opponentGames = previewGamesByOpponent.get(opponentId) ?? previewGames.games;
    const url = new URL(path, window.location.origin);
    const page = requestedPage(path);
    const limit = Math.max(1, Number(url.searchParams.get("limit") ?? PREVIEW_PAGE_SIZE));
    const result = pagedPreview(opponentGames, page, limit);
    return { games: result.items, page, total_pages: result.totalPages } as T;
  }
  if (path.includes("/daily")) {
    const page = requestedPage(path);
    const result = pagedPreview(previewDailyStats, page);
    const opponent = previewOpponents.find((item) => item.id === opponentId);
    return { opponent_name: opponent ? opponentName(opponent) : "Соперник", user_name: "@alexey", daily_stats: result.items, page, total_pages: result.totalPages } as T;
  }
  if (path.endsWith("/scores") && method === "POST") {
    const score = payload.score?.match(/^(\d+)[-:](\d+)$/);
    const opponent = previewOpponents.find((item) => item.id === opponentId);
    if (!score || !opponent?.stats) throw new Error("Не удалось сохранить демонстрационный матч");

    const gameId = previewGameId++;
    const game: RecentGame = {
      played_at: new Date().toISOString(),
      own_score: Number(score[1]),
      opponent_score: Number(score[2]),
      game_id: gameId,
    };
    const historyGame: HistoryGame = {
      ...game,
      opponent_id: opponent.id,
      opponent_name: opponentName(opponent),
    };
    const won = game.own_score > game.opponent_score;
    const eloChange = opponent.elo_rating === null
      ? 0
      : calculatePreviewEloChange(previewProfile.user.elo_rating, opponent.elo_rating, previewProfile.user.elo_games, won);
    game.elo_change = eloChange;
    historyGame.elo_change = eloChange;
    const opponentGames = previewGamesByOpponent.get(opponent.id) ?? [];
    opponentGames.unshift(game);
    previewGamesByOpponent.set(opponent.id, opponentGames);
    previewHistoryGames.unshift(historyGame);
    opponent.stats.wins += won ? 1 : 0;
    opponent.stats.losses += won ? 0 : 1;
    opponent.stats.points_for += game.own_score;
    opponent.stats.points_against += game.opponent_score;
    previewProfile.stats.wins += won ? 1 : 0;
    previewProfile.stats.losses += won ? 0 : 1;
    previewProfile.stats.points_for += game.own_score;
    previewProfile.stats.points_against += game.opponent_score;
    previewProfile.extended_stats.games = gamesCount(previewProfile.stats);
    previewProfile.user.elo_rating += eloChange;
    previewProfile.user.elo_games += opponent.elo_rating === null ? 0 : 1;
    if (opponent.elo_rating !== null) opponent.elo_rating -= eloChange;

    previewSavedGames.set(gameId, { opponentId: opponent.id, game, historyGame });
    return {
      game_id: gameId,
      opponent_id: opponent.id,
      opponent_name: opponentName(opponent),
      score: {
        own_score: game.own_score,
        opponent_score: game.opponent_score,
        regular_own: Math.max(game.own_score, game.opponent_score) > 11 ? 10 : game.own_score,
        regular_opponent: Math.max(game.own_score, game.opponent_score) > 11 ? 10 : game.opponent_score,
        overtime_own: Math.max(game.own_score, game.opponent_score) > 11 ? game.own_score - 10 : 0,
        overtime_opponent: Math.max(game.own_score, game.opponent_score) > 11 ? game.opponent_score - 10 : 0,
      },
      recent_games: structuredClone(opponentGames.slice(0, 5)),
      elo_rating: previewProfile.user.elo_rating,
      elo_change: eloChange,
      opponent_elo_rating: opponent.elo_rating,
      profile: structuredClone(previewProfile),
      opponent_stats: previewStatsForOpponent(path),
    } as T;
  }
  if (/\/scores\/\d+$/.test(path) && method === "DELETE") {
    const gameId = Number(path.match(/\/scores\/(\d+)$/)?.[1] ?? 0);
    const saved = previewSavedGames.get(gameId);
    const opponent = previewOpponents.find((item) => item.id === saved?.opponentId);
    if (saved && opponent?.stats) {
      const won = saved.game.own_score > saved.game.opponent_score;
      const opponentGames = previewGamesByOpponent.get(saved.opponentId) ?? [];
      previewGamesByOpponent.set(saved.opponentId, opponentGames.filter((game) => game !== saved.game));
      previewHistoryGames = previewHistoryGames.filter((game) => game !== saved.historyGame);
      opponent.stats.wins -= won ? 1 : 0;
      opponent.stats.losses -= won ? 0 : 1;
      opponent.stats.points_for -= saved.game.own_score;
      opponent.stats.points_against -= saved.game.opponent_score;
      previewProfile.stats.wins -= won ? 1 : 0;
      previewProfile.stats.losses -= won ? 0 : 1;
      previewProfile.stats.points_for -= saved.game.own_score;
      previewProfile.stats.points_against -= saved.game.opponent_score;
      previewProfile.extended_stats.games = gamesCount(previewProfile.stats);
      const eloChange = saved.game.elo_change ?? 0;
      previewProfile.user.elo_rating -= eloChange;
      previewProfile.user.elo_games -= opponent.elo_rating === null ? 0 : 1;
      if (opponent.elo_rating !== null) opponent.elo_rating += eloChange;
      previewSavedGames.delete(gameId);
    }
    return {} as T;
  }
  if (path === "/api/invites" && method === "POST") {
    return { code: "DEMO42", invite_link: null } as T;
  }
  if (path === "/api/invites/accept") {
    return { status: "already_connected", accepted: false } as T;
  }
  if (path === "/api/rating" && method === "POST") {
    const ratingIsFnt = isPreviewFntRating(payload.value ?? "");
    previewProfile.user.rating = ratingIsFnt ? "1409" : payload.value ?? null;
    previewProfile.user.rating_is_fnt = ratingIsFnt;
    previewProfile.player_level = ratingIsFnt ? "Профик" : playerLevels[levelIndexFor(previewProfile)].name;
    return structuredClone(previewProfile) as T;
  }
  if (path === "/api/rating" && method === "DELETE") {
    previewProfile.user.rating = null;
    previewProfile.user.rating_is_fnt = false;
    previewProfile.player_level = playerLevels[levelIndexFor(previewProfile)].name;
    return structuredClone(previewProfile) as T;
  }
  return {} as T;
}
