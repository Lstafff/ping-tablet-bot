import { AnimatePresence, LayoutGroup, MotionConfig, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { FormEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import ReactDOM from "react-dom/client";
import { Drawer } from "vaul";
import avatarEmojis from "./avatar-emojis.json";

import "@fontsource-variable/nunito/wght.css";

import { requestApi } from "./api/client";
import type {
  DailyView,
  GamesView,
  HistoryGame,
  HistoryView,
  InviteAcceptResponse,
  InviteResponse,
  Opponent,
  OpponentsResponse,
  OpponentStats,
  Profile,
  RecentGame,
  ScoreResponse,
  User,
} from "./api/types";
import { AppIcon } from "./components/AppIcon";
import { BottomNavigation, MainTab } from "./components/BottomNavigation";
import { NumericKeypad } from "./components/NumericKeypad";
import { ProfileAvatarContent, profileAvatarKind } from "./components/ProfileAvatar";
import { ProgressiveLoadTrigger } from "./components/ProgressiveLoadTrigger";
import { EloDeltaBadge, ScorePair } from "./components/ScoreDisplay";
import { SegmentedControl } from "./components/SegmentedControl";
import { Snackbar, type SnackbarTone } from "./components/Snackbar";
import { OpponentOpeningScreen, OpponentScreen, type StatsTab } from "./features/opponent/OpponentFlow";
import { easeDrawer, easeInOut, easeOut } from "./lib/motion";
import { gamesCount, initials, opponentName, winRate } from "./lib/player";
import { tma } from "./lib/tma";
import "./tokens.css";
import "./styles.css";

type Screen = "home" | "stats" | "profile" | "levels" | "opponent" | "score" | "edit" | "confirm";
type ConfirmAction = "reset" | "delete";
type InviteMode = "share" | "accept";
type ScoreSide = "own" | "opponent";
type ScoreReturnTarget = "home" | "opponent";
type ActionSheet = "actions" | "opponents" | "share" | "accept" | null;
type OpponentEditSheet = "actions" | "games" | "points" | "reset" | "delete" | null;
type PendingAction = "score" | "opponent" | "invite" | "rating" | "profile" | "avatar";
type PaginationRequest = { token: number; inFlight: boolean };
type SnackbarNotice = { id: number; tone: SnackbarTone; message: string } | null;
type ScreenMotion = { kind: "none" } | { kind: "tab"; direction: -1 | 1 } | { kind: "back" };

const mainTabPosition: Record<MainTab, number> = {
  stats: 0,
  matches: 1,
  profile: 2,
};

function isMainTabScreen(screen: Screen): boolean {
  return screen === "home" || screen === "stats" || screen === "profile";
}

function scoreValidationError(ownScore: number, opponentScore: number): string | null {
  if (ownScore === opponentScore) return "В завершённой партии не может быть ничьей";

  const winner = Math.max(ownScore, opponentScore);
  const loser = Math.min(ownScore, opponentScore);
  if (winner < 11) return "Победителю нужно минимум 11 очков";
  if (winner === 11 && loser > 9) return "После 10 : 10 нужна разница ровно в 2 очка";
  if (winner > 11 && loser < 10) return "Счёт выше 11 возможен только после 10 : 10";
  if (winner > 11 && winner - loser !== 2) return "После 10 : 10 нужна разница ровно в 2 очка";
  return null;
}

const playerLevels = [
  { name: "Новичок", detail: "До 649 elo", threshold: 0, emoji: "👶" },
  { name: "Любитель", detail: "От 650 elo", threshold: 650, emoji: "🏓" },
  { name: "Бывалый", detail: "От 850 elo", threshold: 850, emoji: "🤘" },
  { name: "Робот", detail: "От 1100 elo", threshold: 1100, emoji: "🦾" },
  { name: "Профик", detail: "От 1500 elo или рейтинг ФНТР", threshold: 1500, emoji: "💀" },
] as const;

function levelIndexFor(profile: Profile): number {
  if (profile.user.rating_is_fnt) return playerLevels.length - 1;
  return playerLevels.reduce(
    (index, level, levelIndex) => profile.user.elo_rating >= level.threshold ? levelIndex : index,
    0,
  );
}

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

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
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

function userName(user: User): string {
  if (user.display_name) {
    return user.display_name;
  }
  if (user.first_name) {
    return user.first_name;
  }
  if (user.username) {
    return user.username.startsWith("@") ? user.username : `@${user.username}`;
  }
  return user.first_name || "Игрок";
}

function formatProfileDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  const dayAndMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
  return `${dayAndMonth} ${date.getFullYear()}`;
}

function winRateTone(rate: number): "win-rate-low" | "win-rate-medium" | "win-rate-high" {
  if (rate < 50) return "win-rate-low";
  if (rate > 60) return "win-rate-high";
  return "win-rate-medium";
}

function RollingNumber({ value, className = "", animateOnMount = false }: { value: string | number; className?: string; animateOnMount?: boolean }) {
  const reduceMotion = useReducedMotion();
  const hasMounted = useRef(false);
  const characters = String(value).split("");
  const staggerInitialDigits = animateOnMount && !hasMounted.current && !reduceMotion;

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  return (
    <span className={`rolling-number ${className}`.trim()} aria-label={String(value)}>
      {characters.map((character, index) => {
        if (!/\d/.test(character)) {
          return <span className="rolling-separator" aria-hidden="true" key={`separator-${index}-${character}`}>{character}</span>;
        }
        return (
          <span className="rolling-digit" aria-hidden="true" key={`digit-${index}`}>
            <AnimatePresence initial={animateOnMount} mode="popLayout">
              <motion.span
                key={`${index}-${character}`}
                initial={{ opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(68%)" }}
                animate={{ opacity: 1, transform: "translateY(0)" }}
                exit={{ opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(-68%)" }}
                transition={{ duration: reduceMotion ? 0.12 : 0.18, delay: staggerInitialDigits ? index * 0.035 : 0, ease: easeOut }}
              >
                {character}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}

function historyGroup(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Ранее";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.floor((startToday.valueOf() - startDate.valueOf()) / 86400000);
  if (daysAgo === 0) return "Сегодня";

  const mondayOffset = (now.getDay() + 6) % 7;
  const startWeek = new Date(startToday);
  startWeek.setDate(startToday.getDate() - mondayOffset);
  if (startDate >= startWeek) return "На этой неделе";
  if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) return "В этом месяце";
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
}

function groupHistory(games: HistoryGame[]): Array<{ label: string; games: HistoryGame[] }> {
  const groups = new Map<string, HistoryGame[]>();
  for (const game of games) {
    const label = historyGroup(game.played_at);
    groups.set(label, [...(groups.get(label) ?? []), game]);
  }
  return [...groups].map(([label, groupedGames]) => ({ label, games: groupedGames }));
}

function createOperationId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `score-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function recentGameKey(game: RecentGame): string {
  return `${game.game_id ?? game.played_at}-${game.own_score}-${game.opponent_score}`;
}

function historyGameKey(game: HistoryGame): string {
  return `${game.opponent_id}-${recentGameKey(game)}`;
}

function appendUnique<T>(current: T[], next: T[], key: (item: T) => string): T[] {
  const seen = new Set(current.map(key));
  const appended: T[] = [];
  for (const item of next) {
    const itemKey = key(item);
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    appended.push(item);
  }
  return [...current, ...appended];
}

function addGameToDailyView(view: DailyView | null, game: RecentGame, opponentNameValue: string, userName: string): DailyView {
  const playedOn = game.played_at.slice(0, 10);
  const won = game.own_score > game.opponent_score;
  const current = view ?? { opponent_name: opponentNameValue, user_name: userName, daily_stats: [], page: 1, total_pages: 1 };
  const existing = current.daily_stats.find((item) => item.played_on === playedOn);
  const daily_stats = existing
    ? current.daily_stats.map((item) => item.played_on === playedOn ? {
      ...item,
      wins: item.wins + (won ? 1 : 0),
      losses: item.losses + (won ? 0 : 1),
    } : item)
    : [{ played_on: playedOn, wins: won ? 1 : 0, losses: won ? 0 : 1 }, ...current.daily_stats];
  return { ...current, daily_stats };
}

function App() {
  const reduceMotion = useReducedMotion();
  const [screen, setScreen] = useState<Screen>(() => {
    const saved = sessionStorage.getItem("ping-tablet:main-tab");
    return saved === "stats" || saved === "profile" ? saved : "home";
  });
  const [mainTabDirection, setMainTabDirection] = useState<-1 | 0 | 1>(0);
  const [screenTransition, setScreenTransition] = useState<"default" | "back">("default");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<Opponent | null>(null);
  const [opponentStats, setOpponentStats] = useState<OpponentStats | null>(null);
  const [daily, setDaily] = useState<DailyView | null>(null);
  const [games, setGames] = useState<GamesView | null>(null);
  const [chartGames, setChartGames] = useState<RecentGame[]>([]);
  const [history, setHistory] = useState<HistoryView | null>(null);
  const [historyNewestFirst, setHistoryNewestFirst] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState("");
  const [dailyLoadingMore, setDailyLoadingMore] = useState(false);
  const [dailyLoadError, setDailyLoadError] = useState("");
  const [gamesLoadingMore, setGamesLoadingMore] = useState(false);
  const [gamesLoadError, setGamesLoadError] = useState("");
  const [statsTab, setStatsTab] = useState<StatsTab>("summary");
  const [scoreSide, setScoreSide] = useState<ScoreSide>("own");
  const [scoreReturnTarget, setScoreReturnTarget] = useState<ScoreReturnTarget>("home");
  const [scoreDrawerOpen, setScoreDrawerOpen] = useState(false);
  const [actionSheet, setActionSheet] = useState<ActionSheet>(null);
  const [opponentEditSheet, setOpponentEditSheet] = useState<OpponentEditSheet>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [ratingInput, setRatingInput] = useState("");
  const [snackbar, setSnackbar] = useState<SnackbarNotice>(null);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileEditing, setProfileEditing] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [ownScore, setOwnScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [scoreValidationMessage, setScoreValidationMessage] = useState("");
  const [gamesTotal, setGamesTotal] = useState("");
  const [pointsTotal, setPointsTotal] = useState("");
  const [lastSavedGameId, setLastSavedGameId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState<ReadonlySet<PendingAction>>(() => new Set());
  const handledStartParam = useRef(false);
  const opponentTabScrollFrame = useRef<number | null>(null);
  const opponentReturnScreen = useRef<"home" | "stats">("home");
  const previousRenderedScreen = useRef<Screen>(screen);
  const opponentRequestId = useRef(0);
  const historyPageRequest = useRef<PaginationRequest>({ token: 0, inFlight: false });
  const dailyPageRequest = useRef<PaginationRequest>({ token: 0, inFlight: false });
  const gamesPageRequest = useRef<PaginationRequest>({ token: 0, inFlight: false });
  const scoreOperationId = useRef<string | null>(null);

  const selectedName = selectedOpponent ? opponentName(selectedOpponent) : "Соперник";
  const setActionPending = (action: PendingAction, pending: boolean) => {
    setPendingActions((current) => {
      const next = new Set(current);
      if (pending) next.add(action);
      else next.delete(action);
      return next;
    });
  };
  const scoreSubmitting = pendingActions.has("score");
  const opponentSubmitting = pendingActions.has("opponent");
  const inviteSubmitting = pendingActions.has("invite");
  const ratingSubmitting = pendingActions.has("rating");
  const profileSubmitting = pendingActions.has("profile");
  const avatarSubmitting = pendingActions.has("avatar");
  const overlayOpen = Boolean(actionSheet || opponentEditSheet || avatarPickerOpen);
  const notify = (message: string, tone: SnackbarTone = "neutral") => {
    setError("");
    setSnackbar({ id: Date.now(), message, tone });
  };

  const loadHome = async () => {
    const [nextProfile, opponentsResponse] = await Promise.all([
      api<Profile>("/api/profile"),
      api<OpponentsResponse>("/api/opponents"),
    ]);
    setProfile(nextProfile);
    setOpponents(opponentsResponse.opponents);
  };

  const loadHistory = async (page = 1, append = false) => {
    const paging = historyPageRequest.current;
    if (append) {
      if (paging.inFlight || (history && history.page >= history.total_pages)) return;
      paging.inFlight = true;
      setHistoryLoadingMore(true);
      setHistoryLoadError("");
    }
    const requestToken = ++paging.token;
    const scrollSnapshot = append && !historyNewestFirst
      ? { height: document.documentElement.scrollHeight, top: window.scrollY }
      : null;
    try {
      const response = await api<HistoryView>(`/api/games?page=${page}`);
      if (requestToken !== paging.token) return;
      flushSync(() => {
        setHistory((current) => append && current
          ? { ...response, games: appendUnique(current.games, response.games, historyGameKey) }
          : response);
      });
      if (scrollSnapshot) {
        const heightDelta = document.documentElement.scrollHeight - scrollSnapshot.height;
        window.scrollTo({ top: scrollSnapshot.top + Math.max(0, heightDelta), behavior: "auto" });
      }
    } catch (loadError: unknown) {
      if (requestToken !== paging.token) return;
      if (!append) throw loadError;
      setHistoryLoadError(messageFromError(loadError));
    } finally {
      if (requestToken === paging.token) {
        paging.inFlight = false;
        if (append) setHistoryLoadingMore(false);
      }
    }
  };

  const loadOpponent = async (opponent: Opponent, tab: StatsTab = "summary", page = 1, showScreen = true) => {
    const requestId = ++opponentRequestId.current;
    dailyPageRequest.current.token += 1;
    dailyPageRequest.current.inFlight = false;
    gamesPageRequest.current.token += 1;
    gamesPageRequest.current.inFlight = false;
    setDailyLoadingMore(false);
    setGamesLoadingMore(false);
    setSelectedOpponent(opponent);
    setOpponentStats(null);
    setDaily(null);
    setGames(null);
    setChartGames([]);
    setStatsTab(tab);
    setLastSavedGameId(null);
    setDailyLoadError("");
    setGamesLoadError("");
    setError("");
    if (showScreen) setScreen("opponent");
    const loadGames = api<GamesView>(`/api/opponents/${opponent.id}/games?page=${page}&limit=10`)
      .then((response) => {
        if (requestId !== opponentRequestId.current) return;
        setGames(response);
      })
      .catch((loadError: unknown) => {
        if (requestId === opponentRequestId.current) setGamesLoadError(messageFromError(loadError));
      });
    const loadDaily = api<DailyView>(`/api/opponents/${opponent.id}/daily?page=${page}`)
      .then((response) => {
        if (requestId !== opponentRequestId.current) return;
        setDaily(response);
      })
      .catch((loadError: unknown) => {
        if (requestId === opponentRequestId.current) setDailyLoadError(messageFromError(loadError));
      });
    const loadChart = api<GamesView>(`/api/opponents/${opponent.id}/games?page=1&limit=100`)
      .then((response) => {
        if (requestId === opponentRequestId.current) setChartGames(response.games);
      })
      .catch(() => undefined);
    const statsResponse = await api<OpponentStats>(`/api/opponents/${opponent.id}/stats`);
    if (requestId !== opponentRequestId.current) return;
    setOpponentStats(statsResponse);
    void Promise.all([loadGames, loadDaily, loadChart]);
  };

  const loadOpponentDays = async (page: number) => {
    const paging = dailyPageRequest.current;
    if (!selectedOpponent || paging.inFlight || (daily && daily.page >= daily.total_pages)) return;
    const requestId = opponentRequestId.current;
    const requestToken = ++paging.token;
    paging.inFlight = true;
    setDailyLoadingMore(true);
    setDailyLoadError("");
    try {
      const response = await api<DailyView>(`/api/opponents/${selectedOpponent.id}/daily?page=${page}`);
      if (requestId !== opponentRequestId.current || requestToken !== paging.token) return;
      setDaily((current) => current
        ? { ...response, daily_stats: appendUnique(current.daily_stats, response.daily_stats, (item) => item.played_on) }
        : response);
    } catch (loadError: unknown) {
      if (requestId !== opponentRequestId.current || requestToken !== paging.token) return;
      setDailyLoadError(messageFromError(loadError));
    } finally {
      if (requestToken === paging.token) {
        paging.inFlight = false;
        setDailyLoadingMore(false);
      }
    }
  };

  const loadOpponentGames = async (page: number) => {
    const paging = gamesPageRequest.current;
    if (!selectedOpponent || paging.inFlight || (games && games.page >= games.total_pages)) return;
    const requestId = opponentRequestId.current;
    const requestToken = ++paging.token;
    paging.inFlight = true;
    setGamesLoadingMore(true);
    setGamesLoadError("");
    try {
      const response = await api<GamesView>(`/api/opponents/${selectedOpponent.id}/games?page=${page}&limit=10`);
      if (requestId !== opponentRequestId.current || requestToken !== paging.token) return;
      setGames((current) => current
        ? { ...response, games: appendUnique(current.games, response.games, recentGameKey) }
        : response);
    } catch (loadError: unknown) {
      if (requestId !== opponentRequestId.current || requestToken !== paging.token) return;
      setGamesLoadError(messageFromError(loadError));
    } finally {
      if (requestToken === paging.token) {
        paging.inFlight = false;
        setGamesLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    const cleanupTelegram = tma.prepare();
    void loadHome()
      .catch((loadError: unknown) => setError(messageFromError(loadError)))
      .finally(() => setLoading(false));
    return () => {
      cleanupTelegram();
    };
  }, []);

  useEffect(() => {
    if (screen === "home" || screen === "stats" || screen === "profile") {
      sessionStorage.setItem("ping-tablet:main-tab", screen === "home" ? "matches" : screen);
    }
  }, [screen]);

  useEffect(() => {
    previousRenderedScreen.current = screen;
  }, [screen]);

  useLayoutEffect(() => {
    const restoresScroll = screen === "home" || screen === "stats" || screen === "profile";
    const key = `ping-tablet:scroll:${screen}`;
    const saved = restoresScroll ? Number(sessionStorage.getItem(key) ?? 0) : 0;
    window.scrollTo({ top: saved, behavior: "auto" });
    return () => {
      if (restoresScroll) sessionStorage.setItem(key, String(window.scrollY));
    };
  }, [screen]);

  useEffect(() => {
    if (!actionSheet && !opponentEditSheet && !avatarPickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionSheet(null);
        setOpponentEditSheet(null);
        setConfirmAction(null);
        setAvatarPickerOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionSheet, opponentEditSheet, avatarPickerOpen]);

  useEffect(() => {
    if (!overlayOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
      const dialog = dialogs[dialogs.length - 1];
      dialog?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')?.focus();
    });
    const keepFocusInDialog = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
      const dialog = dialogs[dialogs.length - 1];
      if (!dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", keepFocusInDialog);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keepFocusInDialog);
      previousFocus?.focus();
    };
  }, [overlayOpen]);

  const refreshOpponent = async () => {
    if (!selectedOpponent) {
      return;
    }
    const requestId = ++opponentRequestId.current;
    dailyPageRequest.current.token += 1;
    dailyPageRequest.current.inFlight = false;
    gamesPageRequest.current.token += 1;
    gamesPageRequest.current.inFlight = false;
    setDailyLoadingMore(false);
    setGamesLoadingMore(false);
    const [statsResponse, gamesResponse, dailyResponse, chartResponse] = await Promise.all([
      api<OpponentStats>(`/api/opponents/${selectedOpponent.id}/stats`),
      api<GamesView>(`/api/opponents/${selectedOpponent.id}/games?limit=10`),
      api<DailyView>(`/api/opponents/${selectedOpponent.id}/daily`),
      api<GamesView>(`/api/opponents/${selectedOpponent.id}/games?limit=100`),
    ]);
    if (requestId !== opponentRequestId.current) return;
    setOpponentStats(statsResponse);
    setGames(gamesResponse);
    setDaily(dailyResponse);
    setChartGames(chartResponse.games);
    void loadHome().catch((loadError: unknown) => setError(messageFromError(loadError)));
  };

  const showHome = () => {
    setScreen("home");
    setSelectedOpponent(null);
    setOpponentStats(null);
    setError("");
    void api<OpponentsResponse>("/api/opponents")
      .then((response) => setOpponents(response.opponents))
      .catch(() => undefined);
  };

  const openOpponent = (opponent: Opponent, tab: StatsTab = "summary", page = 1, returnScreen: "home" | "stats" = screen === "stats" ? "stats" : "home") => {
    setScreenTransition("default");
    opponentReturnScreen.current = returnScreen;
    void loadOpponent(opponent, tab, page).catch((loadError: unknown) => setError(messageFromError(loadError)));
  };

  const openHistoryOpponent = (game: HistoryGame) => {
    const knownOpponent = opponents.find((opponent) => opponent.id === game.opponent_id);
    const fallbackOpponent: Opponent = {
      id: game.opponent_id,
      name: game.opponent_name,
      first_name: game.opponent_name.startsWith("@") ? null : game.opponent_name,
      username: game.opponent_name.startsWith("@") ? game.opponent_name.slice(1) : null,
      display_name: null,
      avatar_value: null,
      elo_rating: null,
    };
    openOpponent(knownOpponent ?? fallbackOpponent, "summary", 1, "stats");
  };

  const submitScore = async () => {
    if (!selectedOpponent) {
      return;
    }
    setActionPending("score", true);
    setError("");
    try {
      const operationId = scoreOperationId.current ?? createOperationId();
      scoreOperationId.current = operationId;
      const result = await api<ScoreResponse>(`/api/opponents/${selectedOpponent.id}/scores`, {
        method: "POST",
        body: JSON.stringify({ score: `${ownScore}-${opponentScore}`, operation_id: operationId }),
      });
      const savedGame = result.recent_games[0];
      setLastSavedGameId(result.game_id);
      setProfile(result.profile);
      setOpponentStats(result.opponent_stats);
      setSelectedOpponent((current) => current ? {
        ...current,
        elo_rating: result.opponent_elo_rating,
        stats: result.opponent_stats.stats,
      } : current);
      setOpponents((current) => current.map((opponent) => opponent.id === selectedOpponent.id ? {
        ...opponent,
        elo_rating: result.opponent_elo_rating,
        stats: result.opponent_stats.stats,
      } : opponent));
      if (savedGame) {
        setGames((current) => ({
          opponent_name: current?.opponent_name ?? result.opponent_name,
          games: [savedGame, ...(current?.games ?? []).filter((game) => game.game_id !== savedGame.game_id)],
          page: 1,
          total_pages: current?.total_pages ?? 1,
        }));
        setChartGames((current) => [savedGame, ...current.filter((game) => game.game_id !== savedGame.game_id)]);
        setDaily((current) => addGameToDailyView(current, savedGame, result.opponent_name, result.opponent_stats.user_name));
        setHistory((current) => ({
          games: [
            {
              ...savedGame,
              opponent_id: selectedOpponent.id,
              opponent_name: result.opponent_name,
            },
            ...(current?.games ?? []).filter((game) => game.game_id !== savedGame.game_id),
          ],
          page: 1,
          total_pages: current?.total_pages ?? 1,
        }));
      }
      setOwnScore("");
      setOpponentScore("");
      scoreOperationId.current = null;
      tma.haptic.notification("success");
      setScoreDrawerOpen(false);
      setScreen("opponent");
    } catch (submitError: unknown) {
      setError(messageFromError(submitError));
      tma.haptic.notification("error");
    } finally {
      setActionPending("score", false);
    }
  };

  const openScore = (returnTarget: ScoreReturnTarget) => {
    setOwnScore("");
    setOpponentScore("");
    setScoreValidationMessage("");
    setScoreSide("own");
    setScoreReturnTarget(returnTarget);
    scoreOperationId.current = null;
    setError("");
    setScoreDrawerOpen(true);
  };

  const openScoreForOpponent = (opponent: Opponent) => {
    setSelectedOpponent(opponent);
    setActionSheet(null);
    openScore("home");
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        void loadOpponent(opponent, "summary", 1, false)
          .catch((loadError: unknown) => setError(messageFromError(loadError)));
      }, 0);
    });
  };

  const resetScoreDraft = () => {
    setOwnScore("");
    setOpponentScore("");
    setScoreValidationMessage("");
    setScoreSide("own");
    scoreOperationId.current = null;
  };

  const backFromScoreToOpponentPicker = () => {
    resetScoreDraft();
    setScoreDrawerOpen(false);
    setScreen("home");
    setActionSheet("opponents");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const closeScoreToOrigin = () => {
    resetScoreDraft();
    setScoreDrawerOpen(false);
    setActionSheet(null);
    if (scoreReturnTarget === "opponent" && selectedOpponent && opponentStats) {
      setScreen("opponent");
    } else {
      setSelectedOpponent(null);
      setOpponentStats(null);
      setScreen("home");
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const enterScoreDigit = (digit: string) => {
    const update = (value: string) => (value === "0" ? digit : `${value}${digit}`).slice(0, 2);
    if (scoreSide === "own") setOwnScore(update);
    else setOpponentScore(update);
    setScoreValidationMessage("");
    tma.haptic.impact("light");
  };

  const eraseScoreDigit = () => {
    if (scoreSide === "own") setOwnScore((value) => value.slice(0, -1));
    else setOpponentScore((value) => value.slice(0, -1));
    setScoreValidationMessage("");
  };

  const continueScore = () => {
    if (scoreSide === "own") {
      setScoreValidationMessage("");
      setScoreSide("opponent");
      tma.haptic.selection();
      return;
    }
    const validationMessage = scoreValidationError(Number(ownScore), Number(opponentScore));
    if (validationMessage) {
      setScoreValidationMessage(validationMessage);
      tma.haptic.notification("error");
      return;
    }
    setScoreValidationMessage("");
    void submitScore();
  };

  const undoScore = async () => {
    if (!selectedOpponent || lastSavedGameId === null) {
      return;
    }
    setActionPending("score", true);
    try {
      await api(`/api/opponents/${selectedOpponent.id}/scores/${lastSavedGameId}`, { method: "DELETE" });
      setLastSavedGameId(null);
      tma.haptic.notification("warning");
      await refreshOpponent();
    } catch (undoError: unknown) {
      setError(messageFromError(undoError));
    } finally {
      setActionPending("score", false);
    }
  };

  const openEdit = () => {
    if (!opponentStats) {
      return;
    }
    setGamesTotal(`${opponentStats.stats.wins}-${opponentStats.stats.losses}`);
    setPointsTotal(`${opponentStats.stats.points_for}-${opponentStats.stats.points_against}`);
    setConfirmAction(null);
    setError("");
    setOpponentEditSheet("actions");
  };

  const saveTotal = async (kind: "games" | "points") => {
    if (!selectedOpponent) {
      return;
    }
    setActionPending("opponent", true);
    setError("");
    try {
      const value = kind === "games" ? gamesTotal : pointsTotal;
      const result = await api<OpponentStats>(`/api/opponents/${selectedOpponent.id}/totals/${kind}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      setOpponentStats(result);
      tma.haptic.notification("success");
      setOpponentEditSheet(null);
    } catch (saveError: unknown) {
      setError(messageFromError(saveError));
    } finally {
      setActionPending("opponent", false);
    }
  };

  const confirmDestructiveAction = async () => {
    if (!selectedOpponent || !confirmAction) {
      return;
    }
    setError("");
    setActionPending("opponent", true);
    try {
      if (confirmAction === "reset") {
        await api(`/api/opponents/${selectedOpponent.id}/reset`, { method: "POST" });
        tma.haptic.notification("warning");
        await refreshOpponent();
        setOpponentEditSheet(null);
      } else {
        await api(`/api/opponents/${selectedOpponent.id}`, { method: "DELETE" });
        tma.haptic.notification("warning");
        await showHome();
        setOpponentEditSheet(null);
      }
      setConfirmAction(null);
    } catch (confirmError: unknown) {
      setError(messageFromError(confirmError));
    } finally {
      setActionPending("opponent", false);
    }
  };

  const openInvite = async (mode: InviteMode = "share") => {
    setActionSheet(mode);
    setSnackbar(null);
    setError("");
    if (mode === "accept") return;
    setActionPending("invite", true);
    try {
      const result = await api<InviteResponse>("/api/invites", { method: "POST" });
      setInviteCode(result.code);
      setInviteLink(result.invite_link);
    } catch (inviteError: unknown) {
      notify(messageFromError(inviteError), "error");
    } finally {
      setActionPending("invite", false);
    }
  };

  const shareInvite = async () => {
    const text = `тебе бросили вызов\nв пинг 🏓 понг 🏓 каунтер\n\n${inviteLink || `Код: ${inviteCode}`}`;
    try {
      const shareUrl = `https://t.me/share/url?text=${encodeURIComponent(text)}`;
      if (!tma.openTelegramLink(shareUrl)) {
        window.open(shareUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      notify("Не удалось открыть отправку через Telegram", "error");
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      notify("Код скопирован", "success");
      tma.haptic.notification("success");
    } catch {
      notify("Не удалось скопировать код", "error");
    }
  };

  const acceptInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionPending("invite", true);
    setError("");
    try {
      const result = await api<InviteAcceptResponse>("/api/invites/accept", {
        method: "POST",
        body: JSON.stringify({ code: inviteInput }),
      });
      const messages: Record<string, string> = {
        accepted: "Соперник добавлен",
        already_connected: "Этот соперник уже есть в списке",
        self: "Это ваш собственный код",
        invalid: "Код не найден",
      };
      notify(messages[result.status] ?? "Код обработан", result.accepted ? "success" : "neutral");
      if (result.accepted) {
        tma.haptic.notification("success");
        await loadHome();
        setActionSheet(null);
      }
    } catch (acceptError: unknown) {
      notify(messageFromError(acceptError), "error");
    } finally {
      setActionPending("invite", false);
    }
  };

  const saveRating = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionPending("rating", true);
    setSnackbar(null);
    try {
      const result = await api<Profile>("/api/rating", {
        method: "POST",
        body: JSON.stringify({ value: ratingInput }),
      });
      setProfile(result);
      setRatingInput(result.user.rating ?? "");
      notify(result.user.rating_is_fnt ? "Рейтинг ФНТР добавлен. Теперь ваш уровень — «Профик»" : "Рейтинг добавлен", "success");
      tma.haptic.notification("success");
    } catch (ratingError: unknown) {
      notify(messageFromError(ratingError), "error");
    } finally {
      setActionPending("rating", false);
    }
  };

  const clearRating = async () => {
    setActionPending("rating", true);
    setSnackbar(null);
    try {
      const result = await api<Profile>("/api/rating", { method: "DELETE" });
      setProfile(result);
      setRatingInput("");
      notify("Рейтинг сброшен", "success");
      tma.haptic.notification("success");
    } catch (ratingError: unknown) {
      notify(messageFromError(ratingError), "error");
    } finally {
      setActionPending("rating", false);
    }
  };

  const saveProfileName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionPending("profile", true);
    setError("");
    try {
      const result = await api<Profile>("/api/profile/name", {
        method: "PUT",
        body: JSON.stringify({ value: profileNameInput }),
      });
      setProfile(result);
      setProfileEditing(false);
      tma.haptic.notification("success");
    } catch (nameError: unknown) {
      setError(messageFromError(nameError));
    } finally {
      setActionPending("profile", false);
    }
  };

  const saveAvatar = async (avatarValue: string) => {
    setActionPending("avatar", true);
    setError("");
    try {
      const result = await api<Profile>("/api/profile/avatar", {
        method: "PUT",
        body: JSON.stringify({ value: avatarValue }),
      });
      setProfile(result);
      setAvatarPickerOpen(false);
      tma.haptic.notification("success");
    } catch (avatarError: unknown) {
      setError(messageFromError(avatarError));
    } finally {
      setActionPending("avatar", false);
    }
  };

  const selectMainTab = (tab: MainTab) => {
    setScreenTransition("default");
    const currentTab: MainTab = screen === "stats" ? "stats" : screen === "profile" ? "profile" : "matches";
    setMainTabDirection(Math.sign(mainTabPosition[tab] - mainTabPosition[currentTab]) as -1 | 0 | 1);
    setSelectedOpponent(null);
    setOpponentStats(null);
    setProfileEditing(false);
    setAvatarPickerOpen(false);
    setError("");
    setScreen(tab === "matches" ? "home" : tab);
    if (tab === "stats" && !history) void loadHistory().catch((loadError: unknown) => setError(messageFromError(loadError)));
  };

  const selectOpponentTab = (tab: StatsTab) => {
    const scrollTop = window.scrollY;
    setStatsTab(tab);
    if (opponentTabScrollFrame.current !== null) {
      window.cancelAnimationFrame(opponentTabScrollFrame.current);
    }
    opponentTabScrollFrame.current = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollTop, behavior: "auto" });
      opponentTabScrollFrame.current = null;
    });
  };

  const goBack = () => {
    setScreenTransition("back");
    if (screen === "confirm") {
      setScreen("edit");
    } else if (screen === "edit") {
      setScreen("opponent");
    } else if (screen === "score") {
      backFromScoreToOpponentPicker();
    } else if (screen === "levels") {
      setScreen("profile");
    } else if (screen === "opponent" && opponentReturnScreen.current === "stats") {
      setSelectedOpponent(null);
      setOpponentStats(null);
      setError("");
      setScreen("stats");
    } else if (screen === "opponent" || screen === "stats" || screen === "profile") {
      showHome();
    }
  };

  useEffect(() => {
    if (scoreDrawerOpen) return tma.backButton(closeScoreToOrigin);
    if (screen === "home" || screen === "stats" || screen === "profile") return;
    return tma.backButton(goBack);
    // Re-subscribe only when routing state changes; both handlers intentionally
    // close over the matching render's score/opponent state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, scoreDrawerOpen]);

  useEffect(() => {
    if (loading || !profile || handledStartParam.current) return;
    const startParam = tma.startParam();
    if (!startParam.startsWith("invite_")) return;
    handledStartParam.current = true;
    setInviteInput(startParam.slice("invite_".length).toUpperCase());
    void openInvite("accept");
    // `openInvite` belongs to the render that first receives the ready profile;
    // re-running this one-shot start-param effect for its identity is incorrect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile]);

  const page = (() => {
    if (loading) {
      return null;
    }
    if (!profile) {
      return <ErrorScreen error={error || "Не удалось загрузить данные"} onRetry={() => void loadHome()} />;
    }
    if (screen === "profile") {
      return (
        <ProfileScreen
          profile={profile}
          editing={profileEditing}
          nameInput={profileNameInput}
          submitting={profileSubmitting}
          onLevel={() => {
            setScreenTransition("default");
            setRatingInput(profile.user.rating ?? "");
            setSnackbar(null);
            setScreen("levels");
          }}
          onEdit={() => {
            setProfileNameInput(userName(profile.user));
            setProfileEditing(true);
          }}
          onAvatarEdit={() => {
            setError("");
            setAvatarPickerOpen(true);
          }}
          onNameInput={setProfileNameInput}
          onSaveName={saveProfileName}
        />
      );
    }
    if (screen === "stats") {
      return (
        <HistoryScreen
          newestFirst={historyNewestFirst}
          view={history}
          loadingMore={historyLoadingMore}
          loadError={historyLoadError}
          onLoadMore={() => void loadHistory((history?.page ?? 1) + 1, true)}
          onOpenOpponent={openHistoryOpponent}
        />
      );
    }
    if (screen === "levels") {
      return (
        <LevelsScreen
          profile={profile}
          ratingValue={ratingInput}
          ratingSubmitting={ratingSubmitting}
          onRatingValue={setRatingInput}
          onRatingSave={saveRating}
          onRatingClear={() => void clearRating()}
        />
      );
    }
    if (screen === "opponent" && selectedOpponent) {
      if (!opponentStats) {
        return <OpponentOpeningScreen opponent={selectedOpponent} onBack={goBack} />;
      }
      return (
        <OpponentScreen
          opponent={selectedOpponent}
          stats={opponentStats}
          tab={statsTab}
          daily={daily}
          games={games}
          chartGames={chartGames}
          onTabChange={selectOpponentTab}
          dailyLoadingMore={dailyLoadingMore}
          dailyLoadError={dailyLoadError}
          gamesLoadingMore={gamesLoadingMore}
          gamesLoadError={gamesLoadError}
          onDaysLoadMore={() => void loadOpponentDays((daily?.page ?? 1) + 1)}
          onGamesLoadMore={() => void loadOpponentGames((games?.page ?? 1) + 1)}
          onEdit={openEdit}
          editingOpen={opponentEditSheet !== null}
          onBack={goBack}
        />
      );
    }
    if (screen === "edit" && selectedOpponent && opponentStats) {
      return (
        <EditScreen
          opponentName={selectedName}
          gamesTotal={gamesTotal}
          pointsTotal={pointsTotal}
          submitting={opponentSubmitting}
          onGamesTotal={setGamesTotal}
          onPointsTotal={setPointsTotal}
          onSaveGames={() => void saveTotal("games")}
          onSavePoints={() => void saveTotal("points")}
          onReset={() => {
            setScreenTransition("default");
            setConfirmAction("reset");
            setScreen("confirm");
          }}
          onDelete={() => {
            setScreenTransition("default");
            setConfirmAction("delete");
            setScreen("confirm");
          }}
        />
      );
    }
    if (screen === "confirm" && confirmAction) {
      return (
        <ConfirmScreen
          action={confirmAction}
          opponentName={selectedName}
          submitting={opponentSubmitting}
          onCancel={goBack}
          onConfirm={() => void confirmDestructiveAction()}
        />
      );
    }
    return <HomeScreen profile={profile} opponents={opponents} onOpenOpponent={openOpponent} />;
  })();

  const canShowNavigation = profile && !loading && (screen === "home" || screen === "stats" || screen === "profile" || screen === "opponent");
  const activeTab: MainTab = screen === "stats" || screen === "profile" ? screen : "matches";
  const savedHistoryScroll = screen === "stats" ? Number(sessionStorage.getItem("ping-tablet:scroll:stats") ?? 0) : 0;
  const screenMotion: ScreenMotion = screenTransition === "back"
    ? { kind: "back" }
    : isMainTabScreen(screen) && isMainTabScreen(previousRenderedScreen.current) && savedHistoryScroll <= 0 && mainTabDirection !== 0
      ? { kind: "tab", direction: mainTabDirection }
      : { kind: "none" };

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="ping-tablet-layout">
        <div className="app-shell" data-vaul-drawer-wrapper="">
          {profile && (screen === "home" || screen === "stats") ? (
            <PageHeader
              title={screen === "home" ? "пинг понг каунтер" : "история"}
              sticky={screen === "stats"}
              profileAvatar={profile.user.avatar_value}
              sortNewestFirst={screen === "stats" ? historyNewestFirst : undefined}
              onSort={screen === "stats" ? () => setHistoryNewestFirst((value) => !value) : undefined}
            />
          ) : null}
          <Snackbar
            message={error || snackbar?.message || ""}
            tone={error ? "error" : snackbar?.tone}
            onDismiss={() => {
              setError("");
              setSnackbar(null);
            }}
          />
          <AnimatePresence
            initial={false}
            mode="popLayout"
            custom={screenMotion}
            onExitComplete={() => setScreenTransition("default")}
          >
            <motion.main
              className="screen"
              key={screen}
              data-screen={screen}
              custom={screenMotion}
              variants={{
                initial: (motion: ScreenMotion) => ({
                  opacity: motion.kind === "tab" ? 0 : 1,
                  transform: reduceMotion
                    ? "translateX(0)"
                    : motion.kind === "tab"
                      ? `translateX(${motion.direction > 0 ? 14 : -14}px)`
                      : "translateX(0)",
                  zIndex: 0,
                }),
                animate: {
                  opacity: 1,
                  transform: "translate(0, 0)",
                  zIndex: 0,
                },
                exit: (motion: ScreenMotion) => {
                  if (motion.kind === "back") {
                    return {
                      opacity: reduceMotion ? 0 : 1,
                      transform: reduceMotion ? "translateX(0)" : "translateX(100vw)",
                      zIndex: 2,
                      transition: { duration: reduceMotion ? 0.12 : 0.26, ease: easeDrawer },
                    };
                  }
                  if (motion.kind === "tab") {
                    return {
                      opacity: 0,
                      transform: reduceMotion ? "translateX(0)" : `translateX(${motion.direction > 0 ? -14 : 14}px)`,
                      zIndex: 0,
                    };
                  }
                  return { opacity: 1, transform: "translateX(0)", zIndex: 0, transition: { duration: 0 } };
                },
              }}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }}
            >
              {screen === "levels" || screen === "edit" || screen === "confirm" ? (
                <PageHeader title={pageTitle(screen)} onBack={goBack} />
              ) : null}
              {page}
            </motion.main>
          </AnimatePresence>

        {canShowNavigation ? <ProgressiveBottomBlur /> : null}
        {canShowNavigation ? (
          <div className="bottom-toolbar-slot">
            <motion.div
              className="bottom-nav-slot"
              initial={{ opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.98)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }}
            >
              <BottomNavigation
                active={activeTab}
                onSelect={selectMainTab}
                actionLabel={screen === "profile" && profileEditing ? "Сохранить" : screen === "opponent" ? "Добавить счёт" : undefined}
                actionForm={screen === "profile" && profileEditing ? "profile-name-form" : undefined}
                actionDisabled={screen === "profile" && profileEditing ? profileSubmitting || !profileNameInput.trim() : screen === "opponent" ? !opponentStats || scoreSubmitting : false}
                onAction={screen === "opponent" ? () => openScore("opponent") : undefined}
                auxiliaryActionLabel={screen === "opponent" && lastSavedGameId !== null ? "Отменить последний счёт" : undefined}
                auxiliaryActionDisabled={scoreSubmitting}
                onAuxiliaryAction={screen === "opponent" && lastSavedGameId !== null ? () => void undoScore() : undefined}
              />
            </motion.div>
          </div>
        ) : null}
        {selectedOpponent ? (
          <ScoreDrawer
            open={scoreDrawerOpen}
            opponentName={selectedName}
            ownScore={ownScore}
            opponentScore={opponentScore}
            side={scoreSide}
            submitting={scoreSubmitting}
            validationMessage={scoreValidationMessage}
            onOpenChange={(open) => {
              if (!open) closeScoreToOrigin();
            }}
            onDigit={enterScoreDigit}
            onErase={eraseScoreDigit}
            onContinue={continueScore}
            onBack={backFromScoreToOpponentPicker}
            onClose={closeScoreToOrigin}
            onSide={(side) => {
              setScoreValidationMessage("");
              setScoreSide(side);
            }}
          />
        ) : null}
        <ActionMenu
          mode={actionSheet}
          showTrigger={screen === "home" && Boolean(profile)}
          opponents={opponents}
          code={inviteCode}
          input={inviteInput}
          submitting={inviteSubmitting}
          onOpen={() => setActionSheet("actions")}
          onClose={() => setActionSheet(null)}
          onBack={() => setActionSheet("actions")}
          onScore={() => setActionSheet("opponents")}
          onScoreOpponent={openScoreForOpponent}
          onShare={() => void openInvite("share")}
          onAccept={() => void openInvite("accept")}
          onInput={setInviteInput}
          onCopyInvite={() => void copyInvite()}
          onShareInvite={() => void shareInvite()}
          onAcceptInvite={acceptInvite}
        />
        <AnimatePresence initial={false}>
          {opponentEditSheet ? (
            <OpponentEditMenu
              mode={opponentEditSheet}
              opponentName={selectedName}
              gamesTotal={gamesTotal}
              pointsTotal={pointsTotal}
              submitting={opponentSubmitting}
              onClose={() => {
                setOpponentEditSheet(null);
                setConfirmAction(null);
              }}
              onBack={() => {
                setOpponentEditSheet("actions");
                setConfirmAction(null);
              }}
              onMode={(mode) => {
                setOpponentEditSheet(mode);
                if (mode === "reset" || mode === "delete") setConfirmAction(mode);
              }}
              onGamesTotal={setGamesTotal}
              onPointsTotal={setPointsTotal}
              onSaveGames={() => void saveTotal("games")}
              onSavePoints={() => void saveTotal("points")}
              onConfirm={() => void confirmDestructiveAction()}
            />
          ) : null}
        </AnimatePresence>
        <AvatarPicker
          open={avatarPickerOpen}
          submitting={avatarSubmitting}
          onClose={() => setAvatarPickerOpen(false)}
          onEmoji={(emoji) => void saveAvatar(emoji)}
        />
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}

function pageTitle(screen: Screen): string {
  if (screen === "opponent") return "статистика";
  if (screen === "levels") return "Уровень";
  if (screen === "edit") return "Изменение счёта";
  if (screen === "confirm") return "Подтверждение";
  return "";
}

function MorphingHeading({
  as = "h1",
  children,
  className,
  morphId,
}: {
  as?: "h1" | "h2";
  children: string;
  className?: string;
  morphId?: string;
}) {
  const StaticHeading = as === "h2" ? "h2" : "h1";

  if (!morphId) {
    return <StaticHeading className={className}>{children}</StaticHeading>;
  }
  return <WaveHeaderTitle as={as} className={className}>{children}</WaveHeaderTitle>;
}

function WaveHeaderTitle({ as = "h1", children, className }: { as?: "h1" | "h2"; children: string; className?: string }) {
  const reduceMotion = useReducedMotion();
  const Heading = as === "h2" ? motion.h2 : motion.h1;
  const glyphs = Array.from(children);

  return (
    <Heading className={className} aria-label={children}>
      <span className="screen-title-copy" aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span className="screen-title-wave" key={children}>
            {glyphs.map((glyph, index) => (
              <motion.span
                className="screen-title-glyph"
                key={`${children}-${index}-${glyph}`}
                initial={{ opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(100%)" }}
                animate={{ opacity: 1, transform: "translateY(0)" }}
                exit={{ opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(-100%)" }}
                transition={{ duration: 0.12, delay: reduceMotion ? 0 : index * 0.003, ease: easeOut }}
              >
                {glyph === " " ? "\u00a0" : glyph}
              </motion.span>
            ))}
          </motion.span>
        </AnimatePresence>
      </span>
    </Heading>
  );
}

export function LegacyMorphingHeaderTitle({
  as = "h1",
  children,
  className,
  morphId,
}: {
  as?: "h1" | "h2";
  children: string;
  className?: string;
  morphId?: string;
}) {
  const reduceMotion = useReducedMotion();
  const generatedId = useId().replace(/:/g, "");
  const headingId = morphId ?? `heading-${generatedId}`;
  const Heading = as === "h2" ? motion.h2 : motion.h1;
  const glyphs = Array.from(children).map((glyph, index) => ({
    glyph,
    slotId: `${headingId}-slot-${index}`,
  }));

  return (
    <Heading className={className} aria-label={children}>
      <motion.span className="screen-title-copy" aria-hidden="true">
        <AnimatePresence mode="popLayout">
          {glyphs.map(({ glyph, slotId }) => (
            <motion.span
              className="screen-title-slot"
              key={slotId}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion
                ? { duration: 0.12, ease: easeOut }
                : {
                    layout: { duration: 0.18, ease: easeOut },
                    opacity: { duration: 0.14, ease: easeOut },
                  }}
            >
              <AnimatePresence initial={false} mode="sync">
                <motion.span
                  className="screen-title-glyph"
                  key={glyph}
                  initial={{
                    opacity: 0,
                    transform: reduceMotion ? "translateX(0)" : "translateX(-100%)",
                  }}
                  animate={{ opacity: 1, transform: "translateX(0)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.14, ease: easeOut }}
                >
                  {glyph === " " ? "\u00a0" : glyph}
                </motion.span>
              </AnimatePresence>
            </motion.span>
          ))}
        </AnimatePresence>
      </motion.span>
    </Heading>
  );
}

function ScreenTitle({ children }: { children: string }) {
  return <MorphingHeading morphId="screen-header-title">{children}</MorphingHeading>;
}

function HeaderSortMorph({ newestFirst, onSort }: { newestFirst?: boolean; onSort?(): void }) {
  const reduceMotion = useReducedMotion();
  const iconTransition = reduceMotion
    ? { layout: { duration: 0 }, opacity: { duration: 0.12, ease: easeOut }, transform: { duration: 0 } }
    : { layout: { duration: 0.24, ease: easeInOut }, opacity: { duration: 0.16, ease: easeOut }, transform: { duration: 0.24, ease: easeInOut } };
  const icon = (
    <motion.span
      className="history-sort-icon"
      layoutId="screen-header-sort-icon"
      animate={{
        opacity: onSort ? 1 : 0,
        transform: `scale(${reduceMotion ? 1 : onSort ? 1 : 0.5}) scaleY(${newestFirst === false ? -1 : 1})`,
      }}
      transition={iconTransition}
    >
      <AppIcon name="filter" size={22} />
    </motion.span>
  );

  if (onSort) {
    return (
      <button
        className="history-sort-button"
        type="button"
        onClick={onSort}
        aria-label={newestFirst ? "Сначала старые" : "Сначала новые"}
        title={newestFirst ? "Сначала старые" : "Сначала новые"}
      >
        {icon}
      </button>
    );
  }

  return <span className="page-header-spacer history-sort-pivot" aria-hidden="true">{icon}</span>;
}

function HeaderProfileAvatar({ value, back }: { value: string | null; back: boolean }) {
  const reduceMotion = useReducedMotion();
  const morphTransition = reduceMotion
    ? { duration: 0.12, ease: easeOut }
    : { duration: 0.24, ease: easeInOut };
  const avatarKind = profileAvatarKind(value);
  const hasCustomAvatar = avatarKind !== "default";

  return (
    <span
      className={`header-profile-avatar header-leading-surface${back ? " header-leading-surface-back" : ""}`}
      aria-hidden="true"
    >
      <motion.span
        className="header-leading-avatar-background"
        animate={{ opacity: back ? 0 : 1, transform: reduceMotion || !back ? "scale(1)" : "scale(0.72)" }}
        transition={morphTransition}
      />
      {hasCustomAvatar ? (
        <motion.span
          className="header-leading-custom-avatar"
          animate={{ opacity: back ? 0 : 1, transform: reduceMotion || !back ? "scale(1)" : "scale(0.72)" }}
          transition={morphTransition}
        >
          <ProfileAvatarContent value={value} defaultIconSize={22} />
        </motion.span>
      ) : null}
      <motion.svg className="header-leading-morph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        {back ? (
          <motion.path
            d="m15 18-6-6 6-6"
            initial={{ opacity: 0, pathLength: 0, transform: reduceMotion ? "scale(1)" : "scale(0.72)" }}
            animate={{ opacity: 1, pathLength: 1, transform: "scale(1)" }}
            transition={morphTransition}
          />
        ) : !hasCustomAvatar ? (
          <>
            <motion.circle cx="12" cy="8" r="5" initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1 }} transition={morphTransition} />
            <motion.path d="M20 21a8 8 0 0 0-16 0" initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1 }} transition={morphTransition} />
          </>
        ) : null}
      </motion.svg>
    </span>
  );
}

function HeaderProfileMorph({ value, onBack }: { value: string | null; onBack?(): void }) {
  return (
    <span className="header-profile-button header-profile-static header-leading-slot">
      <HeaderProfileAvatar value={value} back={Boolean(onBack)} />
      {onBack ? <button className="header-leading-action" type="button" aria-label="Назад" title="Назад" onClick={onBack} /> : null}
    </span>
  );
}

function PageHeader({ title, sticky = false, onBack, profileAvatar, sortNewestFirst, onSort }: { title: string; sticky?: boolean; onBack?(): void; profileAvatar?: string | null; sortNewestFirst?: boolean; onSort?(): void }) {
  return (
    <header className={sticky ? "page-header page-header-sticky" : "page-header"}>
      {profileAvatar !== undefined ? (
        <HeaderProfileMorph value={profileAvatar} onBack={onBack} />
      ) : onBack ? (
        <button type="button" aria-label="Назад" title="Назад" onClick={onBack}>
          <AppIcon name="chevron-left" size={30} aria-hidden="true" />
        </button>
      ) : (
        <span className="page-header-spacer" aria-hidden="true" />
      )}
      <ScreenTitle>{title}</ScreenTitle>
      {profileAvatar !== undefined ? <HeaderSortMorph newestFirst={sortNewestFirst} onSort={onSort} /> : <span className="page-header-spacer" aria-hidden="true" />}
    </header>
  );
}

function HomeScreen({ profile, opponents, onOpenOpponent }: { profile: Profile; opponents: Opponent[]; onOpenOpponent(opponent: Opponent): void }) {
  const rate = winRate(profile.stats);
  return (
    <>
      <section className="home-summary family-balance">
        <div className="scoreline" aria-label={`Побед ${profile.stats.wins}, поражений ${profile.stats.losses}`}>
          <ScorePair
            left={<RollingNumber value={profile.stats.wins} animateOnMount />}
            right={<RollingNumber value={profile.stats.losses} animateOnMount />}
          />
        </div>
        <p className="summary-caption">
          <strong className={`win-rate-badge ${winRateTone(rate)}`}>{rate}% побед</strong>
          <span className="summary-divider" aria-hidden="true">·</span>
          <span>{gamesCount(profile.stats)} партий</span>
        </p>
      </section>

      <section className="section-heading home-list-heading">
        <MorphingHeading as="h2">Соперники</MorphingHeading>
        <span>{opponents.length}</span>
      </section>

      {opponents.length ? (
        <div className="opponent-list">
          {opponents.map((opponent) => (
            <button
              className="opponent-card"
              type="button"
              key={opponent.id}
              onClick={() => onOpenOpponent(opponent)}
            >
              <span className="avatar" aria-hidden="true"><ProfileAvatarContent value={opponent.avatar_value ?? null} defaultIconSize={22} /></span>
              <span className="opponent-card-copy">
                <strong>{opponentName(opponent)}</strong>
                <small>{opponent.stats ? <ScorePair left={opponent.stats.wins} right={opponent.stats.losses} /> : "Счёт пока не добавлен"}</small>
              </span>
              <AppIcon className="card-arrow" name="chevron-right" aria-hidden="true" size={25} />
            </button>
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <MorphingHeading as="h2">Добавь первого соперника</MorphingHeading>
          <p className="muted-copy">Отправь ему код вызова, чтобы начать вести общий счёт.</p>
        </section>
      )}
    </>
  );
}

function ProgressiveBottomBlur() {
  return <div className="progressive-bottom-blur" aria-hidden="true" />;
}

function HistoryScreen({
  newestFirst,
  view,
  loadingMore,
  loadError,
  onLoadMore,
  onOpenOpponent,
}: {
  newestFirst: boolean;
  view: HistoryView | null;
  loadingMore: boolean;
  loadError: string;
  onLoadMore(): void;
  onOpenOpponent(game: HistoryGame): void;
}) {
  const reduceMotion = useReducedMotion();
  const sortedGames = [...(view?.games ?? [])].sort((left, right) => {
    const delta = new Date(right.played_at).valueOf() - new Date(left.played_at).valueOf();
    return newestFirst ? delta : -delta;
  });
  const groups = groupHistory(sortedGames);
  return (
    <section className="history-screen">
      {groups.length ? groups.map((group) => (
        <section className="history-group" key={group.label}>
          <div className="history-group-heading">
            <MorphingHeading as="h2">{group.label}</MorphingHeading>
          </div>
          <div className="history-list">
            {group.games.map((game) => {
              const won = game.own_score > game.opponent_score;
              return (
                <motion.button
                  className="history-row"
                  type="button"
                  key={`${game.opponent_id}-${game.played_at}`}
                  layout="position"
                  layoutDependency={newestFirst}
                  transition={{ layout: reduceMotion ? { duration: 0 } : { duration: 0.18, ease: easeInOut } }}
                  onClick={() => onOpenOpponent(game)}
                >
                  <span className="history-avatar" aria-hidden="true">
                    {initials(game.opponent_name)}
                    <i className={won ? "history-badge history-badge-win" : "history-badge history-badge-loss"}>
                      {won ? <AppIcon name="crown" size={15} strokeWidth={2.5} /> : <AppIcon name="x" size={15} strokeWidth={3} />}
                    </i>
                  </span>
                  <span className="history-copy">
                    <small className={won ? "history-result-win" : "history-result-loss"}>{won ? "Победа" : "Поражение"}</small>
                    <strong>{game.opponent_name}</strong>
                  </span>
                  <span className="history-result">
                    <strong className={won ? "history-score result-win" : "history-score result-loss"}><ScorePair left={game.own_score} right={game.opponent_score} /></strong>
                    <EloDeltaBadge value={game.elo_change} />
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>
      )) : <p className="muted-copy history-empty">Здесь появятся сыгранные матчи.</p>}
      <ProgressiveLoadTrigger
        error={loadError}
        hasMore={(view?.page ?? 1) < (view?.total_pages ?? 1)}
        loading={loadingMore}
        onLoadMore={onLoadMore}
      />
    </section>
  );
}

const scoreRules = [
  {
    icon: "target" as const,
    title: "До 10 : 10",
    description: "Партия заканчивается, когда игрок набирает 11 очков и опережает соперника минимум на 2.",
  },
  {
    icon: "zap" as const,
    title: "После 10 : 10",
    description: "Игра продолжается до преимущества в 2 очка: 12 : 10, 13 : 11 и дальше.",
  },
  {
    icon: "crown" as const,
    title: "Без ничьей",
    description: "В завершённой партии всегда есть победитель.",
  },
] as const;

function ScoreValidationSnackbar({ message }: { message: string }) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const dragY = useMotionValue(0);
  const swipeStart = useRef<{ pointerId: number; y: number; at: number } | null>(null);
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: easeInOut };

  useEffect(() => {
    if (!message) setExpanded(false);
  }, [message]);

  useEffect(() => {
    if (expanded) {
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".score-validation-expanded")?.focus());
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  const startSwipe = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const surface = event.currentTarget;
    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events in browser tests do not create an active pointer.
    }
    swipeStart.current = { pointerId: event.pointerId, y: event.clientY, at: performance.now() };
  }, []);
  const moveSwipe = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const distance = event.clientY - start.y;
    dragY.set(expanded ? Math.max(-12, Math.min(76, distance)) : Math.max(-76, Math.min(12, distance)));
  }, [dragY, expanded]);
  const finishSwipe = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    swipeStart.current = null;
    const distance = event.clientY - start.y;
    const velocity = distance / Math.max(1, performance.now() - start.at);
    const completes = expanded ? distance >= 28 || velocity >= 0.42 : distance <= -28 || velocity <= -0.42;
    if (completes) {
      dragY.set(0);
      setExpanded(!expanded);
    } else if (reduceMotion) dragY.set(0);
    else animate(dragY, 0, { type: "spring", stiffness: 460, damping: 38 });
  }, [dragY, expanded, reduceMotion]);
  const cancelSwipe = useCallback(() => {
    swipeStart.current = null;
    dragY.set(0);
  }, [dragY]);

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          className={expanded ? "score-validation-layer score-validation-layer-expanded" : "score-validation-layer"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }}
        >
          <AnimatePresence>
            {expanded ? (
              <motion.div
                className="score-validation-backdrop"
                role="presentation"
                aria-hidden="true"
                onClick={() => setExpanded(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }}
              />
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {expanded ? (
              <motion.section
                className="score-validation-surface score-validation-expanded"
                key="expanded"
                layout
                layoutId="score-validation-surface"
                role="dialog"
                aria-modal="true"
                aria-label="Правила счёта"
                tabIndex={-1}
                style={{ y: dragY }}
                transition={{ layout: layoutTransition }}
              >
                <motion.div
                  className="score-rules-list"
                  initial={{ opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0)" }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.18, delay: reduceMotion ? 0 : 0.04, ease: easeOut }}
                >
                  {scoreRules.map((rule) => (
                    <div className="score-rule" key={rule.title}>
                      <span aria-hidden="true"><AppIcon name={rule.icon} size={23} /></span>
                      <div><strong>{rule.title}</strong><p>{rule.description}</p></div>
                    </div>
                  ))}
                </motion.div>
                <div
                  className="score-validation-handle"
                  aria-hidden="true"
                >
                  <span aria-hidden="true" />
                </div>
                <div
                  className="score-validation-gesture-layer"
                  aria-hidden="true"
                  onPointerDown={startSwipe}
                  onPointerMove={moveSwipe}
                  onPointerUp={finishSwipe}
                  onPointerCancel={cancelSwipe}
                />
              </motion.section>
            ) : (
              <motion.div
                className="score-validation-surface score-validation-compact"
                key="compact"
                layout
                layoutId="score-validation-surface"
                role="alert"
                aria-label={`${message}. Проведи вверх, чтобы показать правила счёта`}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpanded(true);
                  }
                }}
                style={{ y: dragY }}
                initial={{ opacity: 0, transform: reduceMotion ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.96)" }}
                animate={{ opacity: 1, transform: "translateY(0) scale(1)" }}
                exit={{ opacity: 0, transform: reduceMotion ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.96)" }}
                transition={{ layout: layoutTransition, opacity: { duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }, transform: { duration: reduceMotion ? 0.12 : 0.18, ease: easeOut } }}
              >
                <span>{message}</span>
                <span className="score-validation-info" aria-hidden="true">
                  <motion.span layoutId="score-validation-info"><AppIcon name="info" size={21} /></motion.span>
                </span>
                <div
                  className="score-validation-gesture-layer"
                  aria-hidden="true"
                  onPointerDown={startSwipe}
                  onPointerMove={moveSwipe}
                  onPointerUp={finishSwipe}
                  onPointerCancel={cancelSwipe}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ScoreDrawer(props: {
  open: boolean;
  opponentName: string;
  ownScore: string;
  opponentScore: string;
  side: ScoreSide;
  submitting: boolean;
  validationMessage: string;
  onOpenChange(open: boolean): void;
  onDigit(digit: string): void;
  onErase(): void;
  onContinue(): void;
  onBack(): void;
  onClose(): void;
  onSide(side: ScoreSide): void;
}) {
  return (
    <Drawer.Root
      open={props.open}
      onOpenChange={props.onOpenChange}
      fixed
      handleOnly
      repositionInputs={false}
      shouldScaleBackground
    >
      <Drawer.Portal>
        <Drawer.Overlay className="score-drawer-overlay" />
        <Drawer.Content className="score-drawer-content">
          <Drawer.Title className="visually-hidden">Добавить счёт</Drawer.Title>
          <Drawer.Description className="visually-hidden">Введи свой счёт и счёт соперника</Drawer.Description>
          <Drawer.Handle className="score-drawer-handle" aria-label="Потянуть, чтобы закрыть" />
          <ScoreScreen {...props} />
          <ScoreValidationSnackbar message={props.validationMessage} />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function ScoreScreen(props: {
  opponentName: string;
  ownScore: string;
  opponentScore: string;
  side: ScoreSide;
  submitting: boolean;
  onDigit(digit: string): void;
  onErase(): void;
  onContinue(): void;
  onBack(): void;
  onClose(): void;
  onSide(side: ScoreSide): void;
}) {
  const current = props.side === "own" ? props.ownScore : props.opponentScore;
  const canContinue = props.side === "own" ? Boolean(props.ownScore) : Boolean(props.ownScore && props.opponentScore);

  return (
    <motion.section className="score-screen">
      <header className="score-header">
        <button type="button" aria-label="Назад" onClick={props.onBack}><AppIcon name="arrow-left" size={29} /></button>
        <MorphingHeading>Добавить счёт</MorphingHeading>
        <button type="button" aria-label="Закрыть" onClick={props.onClose}><AppIcon name="x" size={30} /></button>
      </header>
      <div className="score-value" aria-live="polite"><RollingNumber value={current || "0"} /></div>
      <p className="score-progress">
        <ScorePair
          left={<RollingNumber value={props.ownScore || "0"} />}
          right={<RollingNumber value={props.opponentScore || "0"} />}
        />
      </p>
      <SegmentedControl
        ariaLabel="Выбор игрока"
        className="score-player-switch"
        tone="dark"
        value={props.side}
        options={[
          { value: "own", label: "Ты" },
          { value: "opponent", label: "Противник" },
        ]}
        onChange={props.onSide}
      />
      <NumericKeypad ariaLabel="Клавиатура счёта" onDigit={props.onDigit} onErase={props.onErase} />
      <button className="score-continue" type="button" disabled={!canContinue || props.submitting} onClick={props.onContinue}>{props.submitting ? "Сохраняем…" : props.side === "own" ? "Дальше" : "Сохранить"}</button>
    </motion.section>
  );
}

function FntrBadge({ className = "" }: { className?: string }) {
  return <span className={`fntr-badge${className ? ` ${className}` : ""}`}>ФНТР</span>;
}

function ProfileScreen(props: { profile: Profile; editing: boolean; nameInput: string; submitting: boolean; onLevel(): void; onEdit(): void; onAvatarEdit(): void; onNameInput(value: string): void; onSaveName(event: FormEvent<HTMLFormElement>): void }) {
  const { profile } = props;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const startEditing = () => {
    flushSync(() => props.onEdit());
    nameInputRef.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <section className="profile-hero family-profile-hero">
        <div className="profile-avatar-wrap">
          <span
            className="profile-avatar"
            aria-hidden="true"
          >
            <ProfileAvatarContent value={profile.user.avatar_value} />
          </span>
          {profile.user.rating_is_fnt ? <FntrBadge className="profile-avatar-fntr-badge" /> : null}
          {props.editing ? <motion.button className="profile-avatar-edit modal-icon-button" type="button" aria-label="Изменить аватар" initial={{ opacity: 0, transform: "scale(0.94)" }} animate={{ opacity: 1, transform: "scale(1)" }} transition={{ duration: 0.18, ease: easeOut }} onClick={props.onAvatarEdit}><AppIcon name="pencil" size={14} /></motion.button> : null}
        </div>
        {props.editing ? <form id="profile-name-form" className="profile-name-form" onSubmit={props.onSaveName}>
          <input ref={nameInputRef} autoFocus value={props.nameInput} onChange={(event) => props.onNameInput(event.target.value)} maxLength={64} aria-label="Имя профиля" />
        </form> : <MorphingHeading>{userName(profile.user)}</MorphingHeading>}
        <p>{profile.user.username ? `@${profile.user.username}` : "Игрок Telegram"}</p>
      </section>

      <div className={props.editing ? "profile-locked-content profile-locked-content-disabled" : "profile-locked-content"} aria-disabled={props.editing}>
        <section className="profile-actions" aria-label="Действия профиля">
          <button type="button" disabled aria-label="Рейтинг недоступен"><span><AppIcon name="star" size={31} /></span><small>Рейтинг</small></button>
          <button type="button" onClick={props.onLevel} disabled={props.editing}><span><AppIcon name="chart" size={31} /></span><small>Уровень</small></button>
          <button type="button" onClick={startEditing} disabled={props.editing}><span><AppIcon name="settings" size={31} /></span><small>Настройки</small></button>
        </section>

        <div className="profile-divider"><span>Статистика</span></div>

        <section className="profile-metrics" aria-label="Статистика игрока">
          <div className="profile-metric"><span>Всего игр</span><strong><RollingNumber value={gamesCount(profile.stats)} /></strong></div>
          <div className="profile-metrics-divider" aria-hidden="true" />
          <div className="profile-metric"><span>Процент побед</span><strong><RollingNumber value={winRate(profile.stats)} />%</strong></div>
        </section>

        <dl className="profile-facts profile-detailed-facts">
          <div><dt><AppIcon name="calendar" size={21} /><span>Начал играть</span></dt><dd>{formatProfileDate(profile.user.created_at)}</dd></div>
          <div><dt><AppIcon name="chart" size={21} /><span>Уровень игры</span></dt><dd><button className="profile-fact-link" type="button" onClick={props.onLevel} disabled={props.editing}><span>{playerLevels[levelIndexFor(profile)].name}</span><AppIcon name="chevron-right" size={21} /></button></dd></div>
          <div><dt><AppIcon name="crown" size={21} /><span>Победы</span></dt><dd>{profile.stats.wins}</dd></div>
          <div><dt><AppIcon name="circle-minus" size={21} /><span>Поражения</span></dt><dd>{profile.stats.losses}</dd></div>
          <div><dt><AppIcon name="circle-pile" size={21} /><span>Всего мячей</span></dt><dd><ScorePair left={profile.stats.points_for} right={profile.stats.points_against} /></dd></div>
          <div><dt><AppIcon name="zap" size={21} /><span>Текущая серия</span></dt><dd>{profile.extended_stats.win_streak}</dd></div>
          <div><dt><AppIcon name="clock" size={21} /><span>Овертаймы</span></dt><dd><ScorePair left={profile.extended_stats.overtime_wins} right={profile.extended_stats.overtime_losses} /></dd></div>
        </dl>
      </div>
    </>
  );
}

function LevelsScreen(props: {
  profile: Profile;
  ratingValue: string;
  ratingSubmitting: boolean;
  onRatingValue(value: string): void;
  onRatingSave(event: FormEvent<HTMLFormElement>): void;
  onRatingClear(): void;
}) {
  const { profile } = props;
  const currentIndex = levelIndexFor(profile);
  const current = playerLevels[currentIndex];
  const next = playerLevels[currentIndex + 1];
  return (
    <>
      <section className="levels-hero">
        <span className="level-hero-icon" aria-hidden="true">
          {current.emoji}
          {profile.user.rating_is_fnt ? <FntrBadge className="level-icon-fntr-badge" /> : null}
        </span>
        <MorphingHeading>{current.name}</MorphingHeading>
        <strong>{profile.user.elo_rating} elo</strong>
        <small>{next ? `До следующего уровня — ${Math.max(0, next.threshold - profile.user.elo_rating)} elo` : "Максимальный уровень"}</small>
      </section>
      <section className="levels-list" aria-label="Уровни игроков">
        {playerLevels.map((level, index) => (
          <div className={index === currentIndex ? "level-row level-row-current" : "level-row"} key={level.name}>
            <span className="level-emoji" aria-hidden="true">{level.emoji}</span>
            <span><strong>{level.name}</strong><small>{level.detail}</small></span>
            {index === currentIndex ? <AppIcon name="check" size={20} strokeWidth={3} /> : null}
          </div>
        ))}
      </section>
      <section className="rating-editor levels-rating-editor" aria-label="Рейтинг ФНТР">
        <form className="inline-form rating-form" onSubmit={props.onRatingSave}>
          <label className="visually-hidden" htmlFor="rating">Рейтинг или ссылка на профиль ФНТР</label>
          <input
            id="rating"
            value={props.ratingValue}
            onChange={(event) => props.onRatingValue(event.target.value)}
            placeholder="Рейтинг или ссылка ФНТР"
            required
          />
          <button className="primary-button" type="submit" disabled={props.ratingSubmitting}>
            {props.ratingSubmitting ? "Добавляем…" : "Добавить"}
          </button>
        </form>
        {profile.user.rating ? (
          <button className="text-button danger-text" type="button" onClick={props.onRatingClear} disabled={props.ratingSubmitting}>
            Сбросить
          </button>
        ) : null}
      </section>
    </>
  );
}

const EMOJI_BATCH_SIZE = 320;

function AvatarPicker(props: { open: boolean; submitting: boolean; onClose(): void; onEmoji(value: string): void }) {
  const [visibleEmojiCount, setVisibleEmojiCount] = useState(EMOJI_BATCH_SIZE);

  useEffect(() => {
    if (props.open) setVisibleEmojiCount(EMOJI_BATCH_SIZE);
  }, [props.open]);

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div className="avatar-picker-overlay" role="presentation" onClick={props.onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          <motion.section className="avatar-picker" role="dialog" aria-modal="true" aria-label="Выбрать аватар" onClick={(event) => event.stopPropagation()} initial={{ opacity: 0, transform: "translateY(24px) scale(0.98)" }} animate={{ opacity: 1, transform: "translateY(0) scale(1)" }} exit={{ opacity: 0, transform: "translateY(18px) scale(0.99)" }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}>
            <header><MorphingHeading as="h2">Выбрать аватар</MorphingHeading><button className="modal-icon-button" type="button" aria-label="Закрыть" onClick={props.onClose}><AppIcon name="x" size={20} /></button></header>
            <div
              className="avatar-emoji-grid"
              aria-label="Выбрать эмодзи"
              onScroll={(event) => {
                const grid = event.currentTarget;
                if (grid.scrollHeight - grid.scrollTop - grid.clientHeight < 480) {
                  setVisibleEmojiCount((count) => Math.min(count + EMOJI_BATCH_SIZE, avatarEmojis.length));
                }
              }}
            >
              {avatarEmojis.slice(0, visibleEmojiCount).map((emoji) => <button type="button" key={emoji} aria-label={`Эмодзи ${emoji}`} disabled={props.submitting} onClick={() => props.onEmoji(emoji)}>{emoji}</button>)}
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ActionMenu(props: {
  mode: ActionSheet;
  showTrigger: boolean;
  opponents: Opponent[];
  code: string;
  input: string;
  submitting: boolean;
  onOpen(): void;
  onClose(): void;
  onBack(): void;
  onScore(): void;
  onScoreOpponent(opponent: Opponent): void;
  onShare(): void;
  onAccept(): void;
  onInput(value: string): void;
  onCopyInvite(): void;
  onShareInvite(): void;
  onAcceptInvite(event: FormEvent<HTMLFormElement>): void;
}) {
  const reduceMotion = useReducedMotion();
  const previousModeRef = useRef<ActionSheet>(props.mode);
  const triggerReturnsFromMenu = previousModeRef.current !== null && props.mode === null;
  const returningToRoot = previousModeRef.current !== null && previousModeRef.current !== "actions" && props.mode === "actions";
  const layoutTransition = reduceMotion ? { duration: 0 } : { duration: 0.24, ease: easeInOut };
  const titles: Record<Exclude<ActionSheet, null>, string> = {
    actions: "Добавить",
    opponents: "Добавить счёт",
    share: "Отправить код",
    accept: "Добавить соперника",
  };
  const isRoot = props.mode === "actions";

  useEffect(() => {
    previousModeRef.current = props.mode;
  }, [props.mode]);

  return (
    <AnimatePresence initial={false}>
      {!props.mode && props.showTrigger ? (
        <motion.div
          className="floating-add-slot"
          key="add-trigger"
          custom={Boolean(props.mode)}
          initial={{ opacity: triggerReturnsFromMenu ? 1 : 0 }}
          animate={{ opacity: 1 }}
          variants={{
            exit: (morphingToMenu: boolean) => ({ opacity: morphingToMenu ? 1 : 0 }),
          }}
          exit="exit"
          transition={{ duration: reduceMotion ? 0.12 : 0.16, ease: easeOut }}
        >
          <motion.div
            className="floating-add-scale"
            custom={Boolean(props.mode)}
            initial={{ transform: reduceMotion || triggerReturnsFromMenu ? "scale(1)" : "scale(0.96)" }}
            animate={{ transform: "scale(1)" }}
            variants={{
              exit: (morphingToMenu: boolean) => ({
                transform: reduceMotion || morphingToMenu ? "scale(1)" : "scale(0.96)",
              }),
            }}
            exit="exit"
            transition={{ duration: reduceMotion ? 0.12 : 0.14, ease: easeOut }}
          >
            <motion.button
              className="floating-add-button"
              type="button"
              aria-label="Добавить"
              title="Добавить"
              layoutId="add-flow-surface"
              transition={{ layout: layoutTransition }}
              onClick={(event) => {
                event.stopPropagation();
                props.onOpen();
              }}
            >
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.12, ease: easeOut }}
              >
                <AppIcon name="add" aria-hidden="true" size={32} strokeWidth={2} />
              </motion.span>
            </motion.button>
          </motion.div>
        </motion.div>
      ) : props.mode ? (
        <motion.div
          className={isRoot ? "action-overlay" : "action-overlay action-overlay-expanded"}
          role="presentation"
          onClick={props.onClose}
        >
          <motion.section
            className={isRoot ? "action-sheet action-sheet-root" : "action-sheet action-sheet-expanded"}
            role="dialog"
            aria-modal="true"
            aria-label={titles[props.mode]}
            onClick={(event) => event.stopPropagation()}
            layout
            layoutId="add-flow-surface"
            transition={{ layout: layoutTransition }}
          >
            {isRoot ? (
                <motion.div
                  className="action-list"
                  key="actions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: reduceMotion ? 0.1 : 0.12,
                    delay: reduceMotion ? 0 : returningToRoot ? 0.16 : 0.1,
                    ease: easeOut,
                  }}
                >
                  <button type="button" onClick={props.onScore}><span className="action-icon action-icon-blue"><AppIcon name="add" size={27} /></span><span><strong>Добавить счёт</strong><small>Записать результат партии</small></span></button>
                  <button type="button" onClick={props.onShare}><span className="action-icon action-icon-green"><AppIcon name="send" size={25} /></span><span><strong>Отправить код</strong><small>Пригласить нового соперника</small></span></button>
                  <button type="button" onClick={props.onAccept}><span className="action-icon action-icon-pink"><AppIcon name="circle-plus" size={26} /></span><span><strong>Добавить соперника</strong><small>Ввести полученный код</small></span></button>
                </motion.div>
              ) : (
                <motion.div
                  className="action-sheet-content action-sheet-detail"
                  key={props.mode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: reduceMotion ? 0.1 : 0.14, ease: easeOut }}
                >
                  <header>
                    <MorphingHeading as="h2">{titles[props.mode]}</MorphingHeading>
                    <motion.button
                      className="modal-icon-button"
                      type="button"
                      aria-label="Назад"
                      onClick={props.onBack}
                      initial={{ opacity: 0, transform: reduceMotion ? "scale(1)" : "scale(0.92)" }}
                      animate={{ opacity: 1, transform: "scale(1)" }}
                      transition={{ duration: reduceMotion ? 0.12 : 0.14, ease: easeOut }}
                    >
                      <AppIcon name="arrow-left" size={20} />
                    </motion.button>
                  </header>
                  <motion.div
                    className="action-sheet-panel"
                    initial={{ opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(6px)" }}
                    animate={{ opacity: 1, transform: "translateY(0)" }}
                    transition={{ duration: reduceMotion ? 0.12 : 0.16, ease: easeOut }}
                  >
                    {props.mode === "opponents" ? <div className="action-list opponent-picker">
                      {props.opponents.map((opponent) => <button type="button" key={opponent.id} onClick={() => props.onScoreOpponent(opponent)}><span className="avatar"><ProfileAvatarContent value={opponent.avatar_value ?? null} defaultIconSize={22} /></span><span><strong>{opponentName(opponent)}</strong><small>{opponent.stats ? <ScorePair left={opponent.stats.wins} right={opponent.stats.losses} /> : "Нет матчей"}</small></span><AppIcon name="chevron-right" size={24} /></button>)}
                      {!props.opponents.length ? <p className="muted-copy">Сначала добавь соперника по коду.</p> : null}
                    </div> : null}
                    {props.mode === "share" ? <div className="invite-sheet">
                      <strong>{props.code || "…"}</strong>
                      <div className="invite-actions">
                        <button className="sheet-primary-button" type="button" onClick={props.onCopyInvite} disabled={!props.code}>Скопировать</button>
                        <button className="sheet-telegram-button" type="button" aria-label="Отправить через Telegram" title="Отправить через Telegram" onClick={props.onShareInvite} disabled={!props.code}>
                          <AppIcon name="send" size={25} />
                        </button>
                      </div>
                    </div> : null}
                    {props.mode === "accept" ? <form className="invite-sheet invite-sheet-form" onSubmit={props.onAcceptInvite}>
                      <label htmlFor="invite-code">Код приглашения</label>
                      <input id="invite-code" value={props.input} onChange={(event) => props.onInput(event.target.value.toUpperCase())} placeholder="Например, ABC123" autoComplete="off" required />
                      <button className="sheet-primary-button" type="submit" disabled={props.submitting}>Добавить</button>
                    </form> : null}
                  </motion.div>
                </motion.div>
              )}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function OpponentEditMenu(props: {
  mode: Exclude<OpponentEditSheet, null>;
  opponentName: string;
  gamesTotal: string;
  pointsTotal: string;
  submitting: boolean;
  onClose(): void;
  onBack(): void;
  onMode(mode: Exclude<OpponentEditSheet, null>): void;
  onGamesTotal(value: string): void;
  onPointsTotal(value: string): void;
  onSaveGames(): void;
  onSavePoints(): void;
  onConfirm(): void;
}) {
  const reduceMotion = useReducedMotion();
  const mode = props.mode;
  const [pairSide, setPairSide] = useState<ScoreSide>("own");
  const touchedPairSides = useRef<Set<ScoreSide>>(new Set());
  const titles: Record<Exclude<OpponentEditSheet, null>, string> = {
    actions: "Изменить",
    games: "Изменить счёт",
    points: "Изменить мячи",
    reset: "Сбросить статистику",
    delete: "Удалить соперника",
  };
  const isRoot = mode === "actions";
  const isDanger = mode === "reset" || mode === "delete";
  const pairValue = mode === "games" ? props.gamesTotal : props.pointsTotal;
  const [pairOwn = "", pairOpponent = ""] = pairValue.split(/[-:]/, 2);
  const updatePair = (own: string, opponent: string) => {
    const next = `${own}-${opponent}`;
    if (mode === "games") props.onGamesTotal(next);
    if (mode === "points") props.onPointsTotal(next);
  };
  const enterPairDigit = (digit: string) => {
    const current = pairSide === "own" ? pairOwn : pairOpponent;
    const next = touchedPairSides.current.has(pairSide) ? `${current}${digit}`.slice(0, 4) : digit;
    touchedPairSides.current.add(pairSide);
    if (pairSide === "own") updatePair(next, pairOpponent);
    else updatePair(pairOwn, next);
    tma.haptic.impact("light");
  };
  const erasePairDigit = () => {
    const current = pairSide === "own" ? pairOwn : pairOpponent;
    const next = touchedPairSides.current.has(pairSide) ? current.slice(0, -1) : "";
    touchedPairSides.current.add(pairSide);
    if (pairSide === "own") updatePair(next, pairOpponent);
    else updatePair(pairOwn, next);
  };

  useEffect(() => {
    if (mode !== "games" && mode !== "points") return;
    setPairSide("own");
    touchedPairSides.current = new Set();
  }, [mode]);

  return (
    <motion.div
      className="action-overlay"
      role="presentation"
      onClick={props.onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }}
    >
      <motion.section
        className="action-sheet action-sheet-root opponent-edit-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={titles[mode]}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="action-sheet-content">
          <header>
            <MorphingHeading as="h2">{titles[mode]}</MorphingHeading>
            <button className="modal-icon-button" type="button" aria-label={isRoot ? "Закрыть" : "Назад"} onClick={isRoot ? props.onClose : props.onBack}>
              <motion.span
                className="action-header-icon"
                key={isRoot ? "close" : "back"}
                initial={{ opacity: 0, transform: reduceMotion ? "rotate(0deg) scale(1)" : "rotate(-45deg) scale(0.94)" }}
                animate={{ opacity: 1, transform: "rotate(0deg) scale(1)" }}
                transition={{ duration: 0.18, ease: easeOut }}
              >
                <AppIcon name={isRoot ? "x" : "arrow-left"} size={20} />
              </motion.span>
            </button>
          </header>
          <motion.div
            className="action-sheet-panel"
            key={mode}
            initial={{ opacity: 0, transform: reduceMotion ? "translateX(0)" : "translateX(12px)" }}
            animate={{ opacity: 1, transform: "translateX(0)" }}
            transition={{ duration: 0.18, ease: easeOut }}
          >
                  {mode === "actions" ? (
                    <div className="action-list opponent-edit-list">
                      <button type="button" onClick={() => props.onMode("games")}><span className="action-icon action-icon-blue"><AppIcon name="award" size={25} /></span><span><strong>Изменить счёт</strong><small>Обновить общий итог матчей</small></span></button>
                      <button type="button" onClick={() => props.onMode("points")}><span className="action-icon action-icon-green"><AppIcon name="circle-pile" size={25} /></span><span><strong>Изменить мячи</strong><small>Обновить количество мячей</small></span></button>
                      <button type="button" onClick={() => props.onMode("reset")}><span className="action-icon action-icon-gray"><AppIcon name="refresh" size={25} /></span><span><strong>Сбросить статистику</strong><small>Обнулить только у себя</small></span></button>
                      <button type="button" onClick={() => props.onMode("delete")}><span className="action-icon action-icon-red"><AppIcon name="trash" size={24} /></span><span><strong>Удалить соперника</strong><small>Убрать только из своего списка</small></span></button>
                    </div>
                  ) : null}
                  {mode === "games" ? (
                    <div className="opponent-edit-form">
                      <div className="pair-keypad-switch" role="tablist" aria-label={`Счёт матчей: ты и ${props.opponentName}`}>
                        <button className={pairSide === "own" ? "pair-keypad-side pair-keypad-side-active" : "pair-keypad-side"} type="button" role="tab" aria-selected={pairSide === "own"} onClick={() => setPairSide("own")}><span>Ты</span><strong>{pairOwn || "0"}</strong></button>
                        <button className={pairSide === "opponent" ? "pair-keypad-side pair-keypad-side-active" : "pair-keypad-side"} type="button" role="tab" aria-selected={pairSide === "opponent"} onClick={() => setPairSide("opponent")}><span>{props.opponentName}</span><strong>{pairOpponent || "0"}</strong></button>
                      </div>
                      <NumericKeypad ariaLabel="Клавиатура итога матчей" onDigit={enterPairDigit} onErase={erasePairDigit} />
                      <button className="sheet-primary-button" type="button" onClick={props.onSaveGames} disabled={props.submitting || !pairOwn || !pairOpponent}>Сохранить</button>
                    </div>
                  ) : null}
                  {mode === "points" ? (
                    <div className="opponent-edit-form">
                      <div className="pair-keypad-switch" role="tablist" aria-label={`Счёт мячей: ты и ${props.opponentName}`}>
                        <button className={pairSide === "own" ? "pair-keypad-side pair-keypad-side-active" : "pair-keypad-side"} type="button" role="tab" aria-selected={pairSide === "own"} onClick={() => setPairSide("own")}><span>Ты</span><strong>{pairOwn || "0"}</strong></button>
                        <button className={pairSide === "opponent" ? "pair-keypad-side pair-keypad-side-active" : "pair-keypad-side"} type="button" role="tab" aria-selected={pairSide === "opponent"} onClick={() => setPairSide("opponent")}><span>{props.opponentName}</span><strong>{pairOpponent || "0"}</strong></button>
                      </div>
                      <NumericKeypad ariaLabel="Клавиатура итога мячей" onDigit={enterPairDigit} onErase={erasePairDigit} />
                      <button className="sheet-primary-button" type="button" onClick={props.onSavePoints} disabled={props.submitting || !pairOwn || !pairOpponent}>Сохранить</button>
                    </div>
                  ) : null}
                  {isDanger ? (
                    <div className="opponent-edit-confirm">
                      <p>{linkedStatsPolicyText(mode, props.opponentName)}</p>
                      <button className="sheet-danger-button" type="button" onClick={props.onConfirm} disabled={props.submitting}>{props.submitting ? (mode === "delete" ? "Удаляем…" : "Сбрасываем…") : mode === "delete" ? "Удалить" : "Сбросить"}</button>
                    </div>
                  ) : null}
          </motion.div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function EditScreen(props: { opponentName: string; gamesTotal: string; pointsTotal: string; submitting: boolean; onGamesTotal(value: string): void; onPointsTotal(value: string): void; onSaveGames(): void; onSavePoints(): void; onReset(): void; onDelete(): void }) {
  return (
    <>
      <section className="edit-hero edit-profile-hero"><span className="avatar avatar-opponent" aria-hidden="true">{initials(props.opponentName)}</span><MorphingHeading>{props.opponentName}</MorphingHeading><p>Правки сохраняются для обоих связанных игроков.</p></section>
      <section className="settings-section">
        <p className="eyebrow">Итог партий</p>
        <div className="inline-form"><input value={props.gamesTotal} onChange={(event) => props.onGamesTotal(event.target.value)} inputMode="numeric" aria-label="Итог партий" /><button className="primary-button" type="button" onClick={props.onSaveGames} disabled={props.submitting}>Сохранить</button></div>
      </section>
      <section className="settings-section">
        <p className="eyebrow">Итог мячей</p>
        <div className="inline-form"><input value={props.pointsTotal} onChange={(event) => props.onPointsTotal(event.target.value)} inputMode="numeric" aria-label="Итог мячей" /><button className="primary-button" type="button" onClick={props.onSavePoints} disabled={props.submitting}>Сохранить</button></div>
      </section>
      <section className="danger-zone">
        <button className="danger-button" type="button" onClick={props.onReset}>Сбросить статистику</button>
        <button className="danger-button" type="button" onClick={props.onDelete}>Удалить соперника</button>
      </section>
    </>
  );
}

function ConfirmScreen({ action, opponentName, submitting, onCancel, onConfirm }: { action: ConfirmAction; opponentName: string; submitting: boolean; onCancel(): void; onConfirm(): void }) {
  const isDelete = action === "delete";
  return <section className="confirm-screen"><p className="eyebrow">Подтверждение</p><MorphingHeading>{isDelete ? "Удалить соперника?" : "Сбросить статистику?"}</MorphingHeading><p>{linkedStatsPolicyText(action, opponentName)}</p><div className="confirm-actions"><button className="primary-button" type="button" onClick={onCancel}>Отменить</button><button className="danger-button" type="button" onClick={onConfirm} disabled={submitting}>{submitting ? (isDelete ? "Удаляем…" : "Сбрасываем…") : isDelete ? "Удалить" : "Сбросить"}</button></div></section>;
}

function linkedStatsPolicyText(action: ConfirmAction, opponentName: string): string {
  const localAction = action === "delete"
    ? `${opponentName} исчезнет только из вашего списка.`
    : `Ваша статистика с ${opponentName} обнулится.`;
  return `${localAction} Если данные останутся у соперника, они вернутся после новой партии. Если их не останется у вас обоих, счёт начнётся с нуля.`;
}

function ErrorScreen({ error, onRetry }: { error: string; onRetry(): void }) {
  return <section className="loading-screen"><p className="eyebrow">Ошибка загрузки</p><MorphingHeading>Не удалось открыть матч</MorphingHeading><p>{error}</p><button className="primary-button" type="button" onClick={onRetry}>Повторить</button></section>;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось выполнить действие. Попробуйте ещё раз.";
}

declare global {
  interface Window {
    __pingTabletRoot?: ReturnType<typeof ReactDOM.createRoot>;
  }
}

const rootElement = document.getElementById("root")!;
const root = window.__pingTabletRoot ?? ReactDOM.createRoot(rootElement);
window.__pingTabletRoot = root;
root.render(<App />);
