import { AnimatePresence, LayoutGroup, MotionConfig, motion, useAnimate, useReducedMotion } from "motion/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

import { MaterialSymbol } from "../primitives/material-symbols-react";
import { BottomNavigation, MainTab } from "./components/BottomNavigation";
import { tma } from "./lib/tma";
import "./styles.css";

type User = {
  telegram_id: number;
  first_name: string;
  username: string | null;
  created_at: string;
  rating: string | null;
  rating_is_fnt: boolean;
  display_name: string | null;
  avatar_value: string | null;
};

type Opponent = {
  id: number;
  name: string;
  first_name: string | null;
  username: string | null;
  stats?: Stats;
};

type Stats = {
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
};

type ExtendedStats = {
  games: number;
  overtime_wins: number;
  overtime_losses: number;
  longest_own_score: number | null;
  longest_opponent_score: number | null;
  longest_points: number;
  win_streak: number;
  close_margin_games: number;
  most_common_score: string | null;
};

type Profile = {
  user: User;
  stats: Stats;
  extended_stats: ExtendedStats;
  player_level: string;
};

type OpponentStats = {
  opponent_name: string;
  user_name: string;
  stats: Stats;
  extended_stats: ExtendedStats;
};

type RecentGame = {
  played_at: string;
  own_score: number;
  opponent_score: number;
};

type GamesView = {
  games: RecentGame[];
  page: number;
  total_pages: number;
};

type HistoryGame = RecentGame & {
  opponent_id: number;
  opponent_name: string;
};

type HistoryView = {
  games: HistoryGame[];
  page: number;
  total_pages: number;
};

type DailyStat = {
  played_on: string;
  wins: number;
  losses: number;
};

type DailyView = {
  daily_stats: DailyStat[];
  page: number;
  total_pages: number;
};

type Screen = "home" | "stats" | "profile" | "rating" | "levels" | "opponent" | "score" | "edit" | "confirm";
type StatsTab = "summary" | "days" | "games";
type ConfirmAction = "reset" | "delete";
type InviteMode = "share" | "accept";
type ScoreSide = "own" | "opponent";
type ActionSheet = "actions" | "opponents" | "share" | "accept" | null;

function scoreValidationError(ownScore: number, opponentScore: number): string | null {
  if (ownScore === opponentScore) return "Завершённый матч не может закончиться вничью";

  const winner = Math.max(ownScore, opponentScore);
  const loser = Math.min(ownScore, opponentScore);
  if (winner < 11) return "Победитель должен набрать минимум 11 очков";
  if (winner === 11 && loser > 9) return "После 10:10 нужна разница ровно в 2 очка";
  if (winner > 11 && loser < 10) return "Счёт выше 11 возможен только после 10:10";
  if (winner > 11 && winner - loser !== 2) return "После 10:10 нужна разница ровно в 2 очка";
  return null;
}

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const LOCAL_PREVIEW = tma.isLocalPreview();

const previewProfile: Profile = {
  user: {
    telegram_id: 1,
    first_name: "Алексей",
    username: "alexey",
    created_at: "2025-02-14T12:00:00+03:00",
    rating: "412",
    rating_is_fnt: false,
    display_name: null,
    avatar_value: null,
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
    close_margin_games: 17,
    most_common_score: "11:8",
  },
  player_level: "Любитель",
};

const previewOpponents: Opponent[] = [
  { id: 1, name: "Мария", first_name: "Мария", username: "maria", stats: { wins: 24, losses: 13, points_for: 416, points_against: 359 } },
  { id: 2, name: "Иван", first_name: "Иван", username: "ivan", stats: { wins: 18, losses: 17, points_for: 358, points_against: 349 } },
  { id: 3, name: "Даша", first_name: "Даша", username: null, stats: { wins: 16, losses: 7, points_for: 244, points_against: 228 } },
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
    close_margin_games: 8,
    most_common_score: "11:9",
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
  games: [
    { played_at: "2026-07-21T19:30:00+03:00", own_score: 11, opponent_score: 8 },
    { played_at: "2026-07-21T19:18:00+03:00", own_score: 9, opponent_score: 11 },
    { played_at: "2026-07-18T20:05:00+03:00", own_score: 12, opponent_score: 10 },
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

const previewGamesByOpponent = new Map<number, RecentGame[]>(
  previewOpponents.map((opponent) => [opponent.id, structuredClone(previewGames.games)]),
);
let previewGameId = 999;
const previewSavedGames = new Map<number, { opponentId: number; game: RecentGame; historyGame: HistoryGame }>();

const previewDaily: DailyView = {
  daily_stats: [
    { played_on: "2026-07-21", wins: 1, losses: 1 },
    { played_on: "2026-07-18", wins: 2, losses: 0 },
    { played_on: "2026-07-12", wins: 1, losses: 2 },
  ],
  page: 1,
  total_pages: 1,
};

function previewPlayedAt(daysAgo: number, hour: number, minute: number): string {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

const previewHistory: HistoryView = {
  games: [
    { opponent_id: 1, opponent_name: "Мария", played_at: previewPlayedAt(0, 19, 30), own_score: 11, opponent_score: 8 },
    { opponent_id: 2, opponent_name: "Иван", played_at: previewPlayedAt(0, 18, 10), own_score: 9, opponent_score: 11 },
    { opponent_id: 3, opponent_name: "Даша", played_at: previewPlayedAt(3, 20, 5), own_score: 12, opponent_score: 10 },
    { opponent_id: 1, opponent_name: "Мария", played_at: previewPlayedAt(8, 17, 45), own_score: 11, opponent_score: 6 },
    { opponent_id: 2, opponent_name: "Иван", played_at: previewPlayedAt(36, 16, 20), own_score: 7, opponent_score: 11 },
  ],
  page: 1,
  total_pages: 1,
};

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (LOCAL_PREVIEW) {
    return previewApi<T>(path, options);
  }

  const initData = tma.initData();
  if (!initData) {
    throw new Error("Откройте мини-приложение внутри Telegram");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `tma ${initData}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
  throw new Error(payload?.detail || "Не удалось выполнить действие. Попробуйте ещё раз.");
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
    return structuredClone(previewHistory) as T;
  }
  if (path.includes("/stats") || path.includes("/totals/")) {
    return previewStatsForOpponent(path) as T;
  }
  if (path.includes("/games")) {
    const opponentGames = previewGamesByOpponent.get(opponentId) ?? previewGames.games;
    return { games: structuredClone(opponentGames), page: 1, total_pages: 1 } as T;
  }
  if (path.includes("/daily")) {
    return structuredClone(previewDaily) as T;
  }
  if (path.endsWith("/scores") && method === "POST") {
    const score = payload.score?.match(/^(\d+)[-:](\d+)$/);
    const opponent = previewOpponents.find((item) => item.id === opponentId);
    if (!score || !opponent?.stats) throw new Error("Не удалось сохранить демонстрационный матч");

    const game: RecentGame = {
      played_at: new Date().toISOString(),
      own_score: Number(score[1]),
      opponent_score: Number(score[2]),
    };
    const historyGame: HistoryGame = {
      ...game,
      opponent_id: opponent.id,
      opponent_name: opponentName(opponent),
    };
    const won = game.own_score > game.opponent_score;
    const opponentGames = previewGamesByOpponent.get(opponent.id) ?? [];
    opponentGames.unshift(game);
    previewGamesByOpponent.set(opponent.id, opponentGames);
    previewHistory.games.unshift(historyGame);
    opponent.stats.wins += won ? 1 : 0;
    opponent.stats.losses += won ? 0 : 1;
    opponent.stats.points_for += game.own_score;
    opponent.stats.points_against += game.opponent_score;
    previewProfile.stats.wins += won ? 1 : 0;
    previewProfile.stats.losses += won ? 0 : 1;
    previewProfile.stats.points_for += game.own_score;
    previewProfile.stats.points_against += game.opponent_score;
    previewProfile.extended_stats.games = gamesCount(previewProfile.stats);

    const gameId = previewGameId++;
    previewSavedGames.set(gameId, { opponentId: opponent.id, game, historyGame });
    return { game_id: gameId } as T;
  }
  if (/\/scores\/\d+$/.test(path) && method === "DELETE") {
    const gameId = Number(path.match(/\/scores\/(\d+)$/)?.[1] ?? 0);
    const saved = previewSavedGames.get(gameId);
    const opponent = previewOpponents.find((item) => item.id === saved?.opponentId);
    if (saved && opponent?.stats) {
      const won = saved.game.own_score > saved.game.opponent_score;
      const opponentGames = previewGamesByOpponent.get(saved.opponentId) ?? [];
      previewGamesByOpponent.set(saved.opponentId, opponentGames.filter((game) => game !== saved.game));
      previewHistory.games = previewHistory.games.filter((game) => game !== saved.historyGame);
      opponent.stats.wins -= won ? 1 : 0;
      opponent.stats.losses -= won ? 0 : 1;
      opponent.stats.points_for -= saved.game.own_score;
      opponent.stats.points_against -= saved.game.opponent_score;
      previewProfile.stats.wins -= won ? 1 : 0;
      previewProfile.stats.losses -= won ? 0 : 1;
      previewProfile.stats.points_for -= saved.game.own_score;
      previewProfile.stats.points_against -= saved.game.opponent_score;
      previewProfile.extended_stats.games = gamesCount(previewProfile.stats);
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
    return { ...structuredClone(previewProfile), user: { ...previewProfile.user, rating: payload.value ?? null } } as T;
  }
  if (path === "/api/rating" && method === "DELETE") {
    return { ...structuredClone(previewProfile), user: { ...previewProfile.user, rating: null } } as T;
  }
  return {} as T;
}

function opponentName(opponent: Opponent): string {
  if (opponent.first_name) {
    return opponent.first_name;
  }
  if (opponent.username) {
    return opponent.username.startsWith("@") ? opponent.username : `@${opponent.username}`;
  }
  return opponent.first_name || opponent.name;
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

function initials(value: string): string {
  const clean = value.replace(/^@/, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || "—";
}

function gamesCount(stats: Stats): number {
  return stats.wins + stats.losses;
}

function winRate(stats: Stats): number {
  const games = gamesCount(stats);
  return games ? Math.round((stats.wins / games) * 100) : 0;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

function formatChartDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function RollingNumber({ value, className = "" }: { value: string | number; className?: string }) {
  const reduceMotion = useReducedMotion();
  const characters = String(value).split("");
  return (
    <span className={`rolling-number ${className}`.trim()} aria-label={String(value)}>
      {characters.map((character, index) => {
        if (!/\d/.test(character)) {
          return <span className="rolling-separator" aria-hidden="true" key={`separator-${index}-${character}`}>{character}</span>;
        }
        return (
          <span className="rolling-digit" aria-hidden="true" key={`digit-${index}`}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={`${index}-${character}`}
                initial={{ opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(68%)" }}
                animate={{ opacity: 1, transform: "translateY(0)" }}
                exit={{ opacity: 0, transform: reduceMotion ? "translateY(0)" : "translateY(-68%)" }}
                transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: [0.23, 1, 0.32, 1] }}
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

function ProfileAvatar({ value }: { value: string | null }) {
  if (value?.startsWith("data:image/")) {
    return <img src={value} alt="" />;
  }
  if (value) {
    return <span className="profile-avatar-emoji">{value}</span>;
  }
  return <MaterialSymbol name="person" size={62} fill weight={420} />;
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

function App() {
  const reduceMotion = useReducedMotion();
  const [screen, setScreen] = useState<Screen>(() => {
    const saved = sessionStorage.getItem("ping-tablet:main-tab");
    return saved === "stats" || saved === "profile" ? saved : "home";
  });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<Opponent | null>(null);
  const [opponentStats, setOpponentStats] = useState<OpponentStats | null>(null);
  const [daily, setDaily] = useState<DailyView | null>(null);
  const [games, setGames] = useState<GamesView | null>(null);
  const [chartGames, setChartGames] = useState<RecentGame[]>([]);
  const [history, setHistory] = useState<HistoryView | null>(null);
  const [statsTab, setStatsTab] = useState<StatsTab>("summary");
  const [scoreSide, setScoreSide] = useState<ScoreSide>("own");
  const [actionSheet, setActionSheet] = useState<ActionSheet>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [ratingInput, setRatingInput] = useState("");
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileEditing, setProfileEditing] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [ownScore, setOwnScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [scoreValidationAttempt, setScoreValidationAttempt] = useState(0);
  const [scoreValidationMessage, setScoreValidationMessage] = useState("");
  const [gamesTotal, setGamesTotal] = useState("");
  const [pointsTotal, setPointsTotal] = useState("");
  const [lastSavedGameId, setLastSavedGameId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const handledStartParam = useRef(false);

  const selectedName = selectedOpponent ? opponentName(selectedOpponent) : "Соперник";
  const loadHome = async () => {
    const [nextProfile, opponentsResponse, historyResponse] = await Promise.all([
      api<Profile>("/api/profile"),
      api<{ opponents: Opponent[] }>("/api/opponents"),
      api<HistoryView>("/api/games?page=1"),
    ]);
    setProfile(nextProfile);
    setOpponents(opponentsResponse.opponents);
    setHistory(historyResponse);
  };

  const loadHistory = async (page = 1) => {
    const response = await api<HistoryView>(`/api/games?page=${page}`);
    setHistory(response);
  };

  const loadOpponent = async (opponent: Opponent, tab: StatsTab = "summary", page = 1, showScreen = true) => {
    setSelectedOpponent(opponent);
    setStatsTab(tab);
    setLastSavedGameId(null);
    setError("");
    if (showScreen) setScreen("opponent");
    const [statsResponse, gamesResponse, dailyResponse, chartResponse] = await Promise.all([
      api<OpponentStats>(`/api/opponents/${opponent.id}/stats`),
      api<GamesView>(`/api/opponents/${opponent.id}/games?page=${page}&limit=10`),
      api<DailyView>(`/api/opponents/${opponent.id}/daily?page=${page}`),
      api<GamesView>(`/api/opponents/${opponent.id}/games?page=1&limit=100`),
    ]);
    setOpponentStats(statsResponse);
    setGames(gamesResponse);
    setDaily(dailyResponse);
    setChartGames(chartResponse.games);
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
    const key = `ping-tablet:scroll:${screen}:${selectedOpponent?.id ?? "root"}`;
    const saved = Number(sessionStorage.getItem(key) ?? 0);
    window.requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: "auto" }));
    return () => sessionStorage.setItem(key, String(window.scrollY));
  }, [screen, selectedOpponent?.id]);

  useEffect(() => {
    if (!actionSheet && !avatarPickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionSheet(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionSheet, avatarPickerOpen]);

  const refreshOpponent = async () => {
    if (!selectedOpponent) {
      return;
    }
    const [statsResponse, gamesResponse, dailyResponse, chartResponse, nextProfile, opponentsResponse, historyResponse] = await Promise.all([
      api<OpponentStats>(`/api/opponents/${selectedOpponent.id}/stats`),
      api<GamesView>(`/api/opponents/${selectedOpponent.id}/games?limit=10`),
      api<DailyView>(`/api/opponents/${selectedOpponent.id}/daily`),
      api<GamesView>(`/api/opponents/${selectedOpponent.id}/games?limit=100`),
      api<Profile>("/api/profile"),
      api<{ opponents: Opponent[] }>("/api/opponents"),
      api<HistoryView>("/api/games?page=1"),
    ]);
    setOpponentStats(statsResponse);
    setGames(gamesResponse);
    setDaily(dailyResponse);
    setChartGames(chartResponse.games);
    setProfile(nextProfile);
    setOpponents(opponentsResponse.opponents);
    setHistory(historyResponse);
  };

  const showHome = async () => {
    setScreen("home");
    setSelectedOpponent(null);
    setOpponentStats(null);
    setError("");
    try {
      await loadHome();
    } catch (homeError: unknown) {
      setError(messageFromError(homeError));
    }
  };

  const openOpponent = (opponent: Opponent, tab: StatsTab = "summary", page = 1) => {
    void loadOpponent(opponent, tab, page).catch((loadError: unknown) => setError(messageFromError(loadError)));
  };

  const submitScore = async () => {
    if (!selectedOpponent) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ game_id: number }>(`/api/opponents/${selectedOpponent.id}/scores`, {
        method: "POST",
        body: JSON.stringify({ score: `${ownScore}-${opponentScore}` }),
      });
      setLastSavedGameId(result.game_id);
      setOwnScore("");
      setOpponentScore("");
      tma.haptic.notification("success");
      await refreshOpponent();
      setScreen("opponent");
    } catch (submitError: unknown) {
      setError(messageFromError(submitError));
      tma.haptic.notification("error");
    } finally {
      setSubmitting(false);
    }
  };

  const openScore = () => {
    setOwnScore("");
    setOpponentScore("");
    setScoreValidationAttempt(0);
    setScoreValidationMessage("");
    setScoreSide("own");
    setError("");
    setScreen("score");
  };

  const openScoreForOpponent = async (opponent: Opponent) => {
    await loadOpponent(opponent, "summary", 1, false);
    setActionSheet(null);
    openScore();
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
      setScoreValidationAttempt((attempt) => attempt + 1);
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
    setSubmitting(true);
    try {
      await api(`/api/opponents/${selectedOpponent.id}/scores/${lastSavedGameId}`, { method: "DELETE" });
      setLastSavedGameId(null);
      tma.haptic.notification("warning");
      await refreshOpponent();
    } catch (undoError: unknown) {
      setError(messageFromError(undoError));
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = () => {
    if (!opponentStats) {
      return;
    }
    setGamesTotal(`${opponentStats.stats.wins}-${opponentStats.stats.losses}`);
    setPointsTotal(`${opponentStats.stats.points_for}-${opponentStats.stats.points_against}`);
    setScreen("edit");
  };

  const saveTotal = async (kind: "games" | "points") => {
    if (!selectedOpponent) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const value = kind === "games" ? gamesTotal : pointsTotal;
      const result = await api<OpponentStats>(`/api/opponents/${selectedOpponent.id}/totals/${kind}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      setOpponentStats(result);
      tma.haptic.notification("success");
    } catch (saveError: unknown) {
      setError(messageFromError(saveError));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDestructiveAction = async () => {
    if (!selectedOpponent || !confirmAction) {
      return;
    }
    setSubmitting(true);
    try {
      if (confirmAction === "reset") {
        await api(`/api/opponents/${selectedOpponent.id}/reset`, { method: "POST" });
        tma.haptic.notification("warning");
        await refreshOpponent();
        setScreen("edit");
      } else {
        await api(`/api/opponents/${selectedOpponent.id}`, { method: "DELETE" });
        tma.haptic.notification("warning");
        await showHome();
      }
      setConfirmAction(null);
    } catch (confirmError: unknown) {
      setError(messageFromError(confirmError));
    } finally {
      setSubmitting(false);
    }
  };

  const openInvite = async (mode: InviteMode = "share") => {
    setActionSheet(mode);
    setInviteMessage("");
    setError("");
    if (mode === "accept") return;
    try {
      const result = await api<{ code: string; invite_link: string | null }>("/api/invites", { method: "POST" });
      setInviteCode(result.code);
      setInviteLink(result.invite_link);
    } catch (inviteError: unknown) {
      setError(messageFromError(inviteError));
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
      setError("Не удалось открыть отправку через Telegram");
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
    } catch {
      setError("Не удалось скопировать код");
    }
  };

  const acceptInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ status: string; accepted: boolean }>("/api/invites/accept", {
        method: "POST",
        body: JSON.stringify({ code: inviteInput }),
      });
      const messages: Record<string, string> = {
        accepted: "Соперник добавлен",
        already_connected: "Этот соперник уже есть в списке",
        self: "Это ваш собственный код",
        invalid: "Код не найден",
      };
      setInviteMessage(messages[result.status] ?? "Код обработан");
      if (result.accepted) {
        tma.haptic.notification("success");
        await loadHome();
        setActionSheet(null);
      }
    } catch (acceptError: unknown) {
      setError(messageFromError(acceptError));
    } finally {
      setSubmitting(false);
    }
  };

  const saveRating = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await api<Profile>("/api/rating", {
        method: "POST",
        body: JSON.stringify({ value: ratingInput }),
      });
      setProfile(result);
      setRatingInput("");
      tma.haptic.notification("success");
      setScreen("profile");
    } catch (ratingError: unknown) {
      setError(messageFromError(ratingError));
    } finally {
      setSubmitting(false);
    }
  };

  const clearRating = async () => {
    setSubmitting(true);
    try {
      const result = await api<Profile>("/api/rating", { method: "DELETE" });
      setProfile(result);
      setScreen("profile");
    } catch (ratingError: unknown) {
      setError(messageFromError(ratingError));
    } finally {
      setSubmitting(false);
    }
  };

  const saveProfileName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  const saveAvatar = async (avatarValue: string) => {
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  const selectMainTab = (tab: MainTab) => {
    setSelectedOpponent(null);
    setOpponentStats(null);
    setProfileEditing(false);
    setAvatarPickerOpen(false);
    setError("");
    setScreen(tab === "matches" ? "home" : tab);
    if (tab === "stats") void loadHistory().catch((loadError: unknown) => setError(messageFromError(loadError)));
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const goBack = () => {
    if (screen === "confirm") {
      setScreen("edit");
    } else if (screen === "edit") {
      setScreen("opponent");
    } else if (screen === "score") {
      setScreen("opponent");
    } else if (screen === "rating" || screen === "levels") {
      setScreen("profile");
    } else if (screen === "opponent" || screen === "stats" || screen === "profile") {
      void showHome();
    }
  };

  useEffect(() => {
    if (screen === "home" || screen === "stats" || screen === "profile") return;
    return tma.backButton(goBack);
  }, [screen]);

  useEffect(() => {
    if (loading || !profile || handledStartParam.current) return;
    const startParam = tma.startParam();
    if (!startParam.startsWith("invite_")) return;
    handledStartParam.current = true;
    setInviteInput(startParam.slice("invite_".length).toUpperCase());
    void openInvite("accept");
  }, [loading, profile]);

  const page = useMemo(() => {
    if (loading) {
      return <LoadingScreen />;
    }
    if (!tma.isTelegram() && !LOCAL_PREVIEW) {
      return <TelegramOnlyScreen />;
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
          submitting={submitting}
          onRating={() => setScreen("rating")}
          onLevel={() => setScreen("levels")}
          onEdit={() => {
            setProfileNameInput(userName(profile.user));
            setProfileEditing(true);
          }}
          onAvatarEdit={() => setAvatarPickerOpen(true)}
          onNameInput={setProfileNameInput}
          onSaveName={saveProfileName}
        />
      );
    }
    if (screen === "stats") {
      return <HistoryScreen view={history} onPage={(page) => void loadHistory(page)} />;
    }
    if (screen === "rating") {
      return (
        <RatingScreen
          profile={profile}
          value={ratingInput}
          submitting={submitting}
          onValue={setRatingInput}
          onSave={saveRating}
          onClear={() => void clearRating()}
        />
      );
    }
    if (screen === "levels") {
      return <LevelsScreen profile={profile} />;
    }
    if (screen === "opponent" && selectedOpponent && opponentStats) {
      return (
        <OpponentScreen
          opponent={selectedOpponent}
          stats={opponentStats}
          tab={statsTab}
          daily={daily}
          games={games}
          chartGames={chartGames}
          lastSavedGameId={lastSavedGameId}
          submitting={submitting}
          onAddScore={openScore}
          onUndo={() => void undoScore()}
          onTabChange={(tab) => setStatsTab(tab)}
          onDaysPage={(page) => selectedOpponent && openOpponent(selectedOpponent, "days", page)}
          onGamesPage={(page) => selectedOpponent && openOpponent(selectedOpponent, "games", page)}
          onEdit={openEdit}
        />
      );
    }
    if (screen === "score" && selectedOpponent && opponentStats) {
      return (
        <ScoreScreen
          opponentName={selectedName}
          ownScore={ownScore}
          opponentScore={opponentScore}
          side={scoreSide}
          submitting={submitting}
          validationAttempt={scoreValidationAttempt}
          validationMessage={scoreValidationMessage}
          onDigit={enterScoreDigit}
          onErase={eraseScoreDigit}
          onContinue={continueScore}
          onClose={() => setScreen("opponent")}
          onSide={(side) => {
            setScoreValidationMessage("");
            setScoreSide(side);
          }}
        />
      );
    }
    if (screen === "edit" && selectedOpponent && opponentStats) {
      return (
        <EditScreen
          opponentName={selectedName}
          gamesTotal={gamesTotal}
          pointsTotal={pointsTotal}
          submitting={submitting}
          onGamesTotal={setGamesTotal}
          onPointsTotal={setPointsTotal}
          onSaveGames={() => void saveTotal("games")}
          onSavePoints={() => void saveTotal("points")}
          onReset={() => {
            setConfirmAction("reset");
            setScreen("confirm");
          }}
          onDelete={() => {
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
          submitting={submitting}
          onCancel={() => setScreen("edit")}
          onConfirm={() => void confirmDestructiveAction()}
        />
      );
    }
    return <HomeScreen profile={profile} opponents={opponents} onOpenOpponent={openOpponent} />;
  }, [
    confirmAction,
    actionSheet,
    avatarPickerOpen,
    chartGames,
    daily,
    error,
    games,
    gamesTotal,
    history,
    inviteCode,
    inviteInput,
    inviteLink,
    inviteMessage,
    lastSavedGameId,
    loading,
    opponentScore,
    opponentStats,
    opponents,
    ownScore,
    pointsTotal,
    profile,
    profileEditing,
    profileNameInput,
    ratingInput,
    screen,
    scoreSide,
    scoreValidationAttempt,
    scoreValidationMessage,
    selectedName,
    selectedOpponent,
    statsTab,
    submitting,
  ]);

  const canShowNavigation = profile && !loading && !profileEditing && (screen === "home" || screen === "stats" || screen === "profile");
  const activeTab: MainTab = screen === "stats" || screen === "profile" ? screen : "matches";

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="ping-tablet-layout">
        <div className={screen === "score" ? "app-shell app-shell-dark" : "app-shell"}>
          {screen === "home" ? <PageHeader title="ping tablet bot" /> : null}
          {screen === "opponent" || screen === "rating" || screen === "levels" || screen === "edit" || screen === "confirm" ? (
            <PageHeader title={pageTitle(screen)} onBack={goBack} />
          ) : null}

          <AnimatePresence initial={false} mode="popLayout">
            <motion.main
              className="screen"
              key={screen}
              initial={{
                opacity: screen === "score" ? 1 : 0,
                transform: screen === "score" && !reduceMotion ? "translateY(100%)" : "translateY(4px)",
              }}
              animate={{ opacity: 1, transform: "translateY(0)" }}
              exit={{
                opacity: screen === "score" ? 1 : 0,
                transform: screen === "score" && !reduceMotion ? "translateY(100%)" : "translateY(-3px)",
              }}
              transition={{ duration: screen === "score" ? 0.28 : 0.18, ease: [0.23, 1, 0.32, 1] }}
            >
              {page}
            </motion.main>
          </AnimatePresence>

        {screen === "home" && profile && !actionSheet ? (
          <div className="floating-add-slot">
            <button
              className="floating-add-button"
              type="button"
              aria-label="Добавить"
              title="Добавить"
              onClick={() => setActionSheet("actions")}
            >
              <MaterialSymbol name="add" aria-hidden="true" size={34} weight={400} />
            </button>
          </div>
        ) : null}
        {screen === "profile" && profileEditing ? (
          <div className="profile-save-slot">
            <button className="profile-save-button" type="submit" form="profile-name-form" disabled={submitting || !profileNameInput.trim()}>Сохранить</button>
          </div>
        ) : null}
        {canShowNavigation ? <BottomNavigation active={activeTab} onSelect={selectMainTab} /> : null}
        <ActionMenu
          mode={actionSheet}
          opponents={opponents}
          code={inviteCode}
          input={inviteInput}
          message={inviteMessage}
          submitting={submitting}
          onClose={() => setActionSheet(null)}
          onBack={() => setActionSheet("actions")}
          onScore={() => setActionSheet("opponents")}
          onScoreOpponent={(opponent) => void openScoreForOpponent(opponent).catch((loadError: unknown) => setError(messageFromError(loadError)))}
          onShare={() => void openInvite("share")}
          onAccept={() => void openInvite("accept")}
          onInput={setInviteInput}
          onCopyInvite={() => void copyInvite()}
          onShareInvite={() => void shareInvite()}
          onAcceptInvite={acceptInvite}
        />
        <AvatarPicker
          open={avatarPickerOpen}
          submitting={submitting}
          onClose={() => setAvatarPickerOpen(false)}
          onEmoji={(emoji) => void saveAvatar(emoji)}
        />
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}

function pageTitle(screen: Screen): string {
  if (screen === "opponent") return "Статистика";
  if (screen === "rating") return "Рейтинг";
  if (screen === "levels") return "Уровень";
  if (screen === "edit") return "Изменение счёта";
  if (screen === "confirm") return "Подтверждение";
  return "";
}

function PageHeader({ title, onBack }: { title: string; onBack?(): void }) {
  return (
    <header className="page-header">
      {onBack ? (
        <button type="button" aria-label="Назад" title="Назад" onClick={onBack}>
          <MaterialSymbol name="chevron_left" size={30} weight={450} aria-hidden="true" />
        </button>
      ) : (
        <span className="page-header-spacer" aria-hidden="true" />
      )}
      <h1>{title}</h1>
      <span className="page-header-spacer" aria-hidden="true" />
    </header>
  );
}

function HomeScreen({ profile, opponents, onOpenOpponent }: { profile: Profile; opponents: Opponent[]; onOpenOpponent(opponent: Opponent): void }) {
  const rate = winRate(profile.stats);
  return (
    <>
      <section className="home-summary family-balance">
        <div className="scoreline" aria-label={`Побед ${profile.stats.wins}, поражений ${profile.stats.losses}`}>
          <RollingNumber value={profile.stats.wins} />
          <i>:</i>
          <RollingNumber value={profile.stats.losses} />
        </div>
        <p className="summary-caption">
          <strong className={`win-rate-badge ${winRateTone(rate)}`}>{rate}% побед</strong>
          <span>· {gamesCount(profile.stats)} партий</span>
        </p>
      </section>

      <section className="section-heading home-list-heading">
        <h2>Соперники</h2>
        <span>{opponents.length}</span>
      </section>

      {opponents.length ? (
        <div className="opponent-list">
          {opponents.map((opponent) => (
            <motion.button
              layout
              layoutId={`opponent-card-${opponent.id}`}
              className="opponent-card"
              type="button"
              key={opponent.id}
              onClick={() => onOpenOpponent(opponent)}
              transition={{ layout: { type: "spring", bounce: 0, duration: 0.35 } }}
            >
              <span className="avatar" aria-hidden="true">{initials(opponentName(opponent))}</span>
              <span className="opponent-card-copy">
                <strong>{opponentName(opponent)}</strong>
                <small>{opponent.stats ? `${opponent.stats.wins} : ${opponent.stats.losses}` : "Счёт пока не добавлен"}</small>
              </span>
              <MaterialSymbol className="card-arrow" name="chevron_right" aria-hidden="true" size={25} />
            </motion.button>
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <h2>Добавь первого соперника</h2>
          <p className="muted-copy">Отправь ему код вызова, чтобы начать вести общий счёт.</p>
        </section>
      )}
    </>
  );
}

function HistoryScreen({ view, onPage }: { view: HistoryView | null; onPage(page: number): void }) {
  const [newestFirst, setNewestFirst] = useState(true);
  const sortedGames = [...(view?.games ?? [])].sort((left, right) => {
    const delta = new Date(right.played_at).valueOf() - new Date(left.played_at).valueOf();
    return newestFirst ? delta : -delta;
  });
  const groups = groupHistory(sortedGames);
  return (
    <section className="history-screen">
      <div className="history-page-heading">
        <h1>История</h1>
        <button type="button" onClick={() => setNewestFirst((value) => !value)} aria-label={newestFirst ? "Сначала старые" : "Сначала новые"} title={newestFirst ? "Сначала старые" : "Сначала новые"}>
          <MaterialSymbol name="filter_list" size={22} weight={450} />
        </button>
      </div>
      {groups.length ? groups.map((group) => (
        <section className="history-group" key={group.label}>
          <div className="history-group-heading">
            <h2>{group.label}</h2>
          </div>
          <div className="history-list">
            {group.games.map((game) => {
              const won = game.own_score > game.opponent_score;
              return (
                <article className="history-row" key={`${game.opponent_id}-${game.played_at}`}>
                  <span className="history-avatar" aria-hidden="true">
                    {initials(game.opponent_name)}
                    <i className={won ? "history-badge history-badge-win" : "history-badge history-badge-loss"}>
                      <MaterialSymbol name={won ? "check" : "close"} size={15} weight={700} />
                    </i>
                  </span>
                  <span className="history-copy">
                    <small className={won ? "history-result-win" : "history-result-loss"}>{won ? "Победа" : "Поражение"}</small>
                    <strong>{game.opponent_name}</strong>
                  </span>
                  <strong className={won ? "history-score result-win" : "history-score"}>{game.own_score}:{game.opponent_score}</strong>
                </article>
              );
            })}
          </div>
        </section>
      )) : <p className="muted-copy history-empty">Здесь появятся сыгранные матчи.</p>}
      <Pagination page={view?.page ?? 1} totalPages={view?.total_pages ?? 1} onPage={onPage} />
    </section>
  );
}

function OpponentScreen(props: {
  opponent: Opponent;
  stats: OpponentStats;
  tab: StatsTab;
  daily: DailyView | null;
  games: GamesView | null;
  chartGames: RecentGame[];
  lastSavedGameId: number | null;
  submitting: boolean;
  onAddScore(): void;
  onUndo(): void;
  onTabChange(tab: StatsTab): void;
  onDaysPage(page: number): void;
  onGamesPage(page: number): void;
  onEdit(): void;
}) {
  const { opponent, stats } = props;
  return (
    <>
      <motion.section layoutId={`opponent-card-${opponent.id}`} className="opponent-hero" transition={{ layout: { type: "spring", bounce: 0, duration: 0.35 } }}>
        <span className="avatar avatar-opponent" aria-hidden="true">{initials(opponentName(opponent))}</span>
        <h1>{opponentName(opponent)}</h1>
        <div className="opponent-scoreline" aria-label={`Побед ${stats.stats.wins}, поражений ${stats.stats.losses}`}>
          <strong><RollingNumber value={stats.stats.wins} /></strong><i>:</i><strong><RollingNumber value={stats.stats.losses} /></strong>
        </div>
        <p><strong>{winRate(stats.stats)}%</strong> побед · {gamesCount(stats.stats)} партий</p>
      </motion.section>

      <MatchChart games={props.chartGames} stats={stats.stats} />

      <section className="opponent-metrics" aria-label="Главная статистика">
        <div><span>Мячи</span><strong>{stats.stats.points_for}:{stats.stats.points_against}</strong></div>
        <div><span>Лучшая серия</span><strong>{stats.extended_stats.win_streak}</strong></div>
      </section>

      <div className="segmented-control" role="tablist" aria-label="Статистика с соперником">
        <TabButton active={props.tab === "summary"} onClick={() => props.onTabChange("summary")}>Общая</TabButton>
        <TabButton active={props.tab === "days"} onClick={() => props.onTabChange("days")}>По дням</TabButton>
        <TabButton active={props.tab === "games"} onClick={() => props.onTabChange("games")}>Игры</TabButton>
      </div>

      {props.tab === "summary" ? <StatsSummary stats={stats.extended_stats} /> : null}
      {props.tab === "days" ? <DailyTable view={props.daily} onPage={props.onDaysPage} /> : null}
      {props.tab === "games" ? <GamesTable view={props.games} onPage={props.onGamesPage} /> : null}

      <div className="opponent-actions">
        <button className="secondary-button" type="button" onClick={props.onEdit}>Изменить</button>
        <button className="primary-button" type="button" onClick={props.onAddScore}>Добавить счёт</button>
      </div>
      {props.lastSavedGameId !== null ? <button className="text-button undo-button" type="button" onClick={props.onUndo} disabled={props.submitting}>Отменить последний счёт</button> : null}
    </>
  );
}

function MatchChart({ games, stats }: { games: RecentGame[]; stats: Stats }) {
  const ordered = [...games].reverse();
  const loadedWins = ordered.filter((game) => game.own_score > game.opponent_score).length;
  let wins = Math.max(0, stats.wins - loadedWins);
  let played = Math.max(0, gamesCount(stats) - ordered.length);
  const values = ordered.map((game, index) => {
    if (game.own_score > game.opponent_score) wins += 1;
    played += 1;
    return Math.round((wins / played) * 100);
  });
  const currentRate = winRate(stats);
  const maximumRate = Math.max(0, ...values);
  const yMaximum = Math.min(100, Math.max(10, maximumRate + 10));
  const plot = { left: 42, right: 330, top: 16, bottom: 128 };
  const chartValues = values.length > 1 ? values : values.length ? [values[0], values[0]] : [0, 0];
  const points = chartValues.map((value, index, all) => {
    const x = plot.left + (index / Math.max(all.length - 1, 1)) * (plot.right - plot.left);
    const y = plot.bottom - (value / yMaximum) * (plot.bottom - plot.top);
    return `${x},${y}`;
  }).join(" ");
  const startDate = ordered.length ? formatChartDate(ordered[0].played_at) : "—";

  return (
    <section className="match-chart" aria-label="Динамика процента побед">
      <div className="match-chart-heading"><span>Процент побед</span><strong><RollingNumber value={currentRate} />%</strong></div>
      <svg viewBox="0 0 340 166" role="img" aria-label={`График процента побед с ${startDate} по сегодня`}>
        <line className="chart-axis" x1={plot.left} y1={plot.top} x2={plot.left} y2={plot.bottom} />
        <line className="chart-axis" x1={plot.left} y1={plot.bottom} x2={plot.right} y2={plot.bottom} />
        <text className="chart-axis-label" x={plot.left - 8} y={plot.top} textAnchor="end" dominantBaseline="middle">{yMaximum}%</text>
        <text className="chart-axis-label" x={plot.left - 8} y={plot.bottom} textAnchor="end" dominantBaseline="middle">0%</text>
        <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
        <text className="chart-date-label" x={plot.left} y="143">{startDate}</text>
        <text className="chart-date-label" x={plot.right} y="143" textAnchor="end">Сегодня</text>
      </svg>
    </section>
  );
}

function ScoreScreen(props: {
  opponentName: string;
  ownScore: string;
  opponentScore: string;
  side: ScoreSide;
  submitting: boolean;
  validationAttempt: number;
  validationMessage: string;
  onDigit(digit: string): void;
  onErase(): void;
  onContinue(): void;
  onClose(): void;
  onSide(side: ScoreSide): void;
}) {
  const reduceMotion = useReducedMotion();
  const [scope, animate] = useAnimate();
  const current = props.side === "own" ? props.ownScore : props.opponentScore;
  const canContinue = props.side === "own" ? Boolean(props.ownScore) : Boolean(props.ownScore && props.opponentScore);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "erase"];

  useEffect(() => {
    if (!props.validationAttempt || !scope.current) return;
    const feedback = reduceMotion
      ? { opacity: [1, 0.72, 1] }
      : { transform: ["translateX(0)", "translateX(-5px)", "translateX(4px)", "translateX(-2px)", "translateX(0)"] };
    void animate(scope.current, feedback, { duration: reduceMotion ? 0.16 : 0.24, ease: [0.23, 1, 0.32, 1] });
  }, [animate, props.validationAttempt, reduceMotion, scope]);

  return (
    <motion.section className="score-screen" ref={scope}>
      <header className="score-header">
        <h1>Добавить счёт</h1>
        <button type="button" aria-label="Закрыть" onClick={props.onClose}><MaterialSymbol name="close" size={30} weight={500} /></button>
      </header>
      <div className="score-switch" role="tablist" aria-label="Выбор игрока">
        <button className={props.side === "own" ? "score-switch-active" : ""} type="button" role="tab" aria-selected={props.side === "own"} onClick={() => props.onSide("own")}>Ты</button>
        <button className={props.side === "opponent" ? "score-switch-active" : ""} type="button" role="tab" aria-selected={props.side === "opponent"} onClick={() => props.onSide("opponent")}>{props.opponentName}</button>
      </div>
      <div className="score-value" aria-live="polite"><RollingNumber value={current || "0"} /></div>
      <p className="score-progress"><RollingNumber value={props.ownScore || "0"} /> <i>:</i> <RollingNumber value={props.opponentScore || "0"} /></p>
      <div className={props.validationMessage ? "score-opponent-row score-opponent-row-error" : "score-opponent-row"}><span className="avatar">{initials(props.opponentName)}</span><div><strong>{props.opponentName}</strong><small role={props.validationMessage ? "alert" : undefined}>{props.validationMessage || (props.side === "own" ? "Сначала твой счёт" : "Теперь счёт соперника")}</small></div></div>
      <div className="score-keypad" aria-label="Клавиатура счёта">
        {keys.map((key, index) => key === "" ? <span key={`empty-${index}`} /> : (
          <motion.button key={key} type="button" whileTap={{ scale: 0.88 }} transition={{ type: "spring", stiffness: 600, damping: 38 }} aria-label={key === "erase" ? "Удалить цифру" : key} onClick={key === "erase" ? props.onErase : () => props.onDigit(key)}>
            {key === "erase" ? <MaterialSymbol name="arrow_back" size={29} weight={450} /> : key}
          </motion.button>
        ))}
      </div>
      <button className="score-continue" type="button" disabled={!canContinue || props.submitting} onClick={props.onContinue}>{props.side === "own" ? "Дальше" : "Сохранить"}</button>
    </motion.section>
  );
}

function StatsSummary({ stats }: { stats: ExtendedStats }) {
  return (
    <section className="details-section">
      <dl className="facts-list">
        <div><dt>Серия побед</dt><dd>{stats.win_streak}</dd></div>
        <div><dt>Овертаймы</dt><dd>{stats.overtime_wins}:{stats.overtime_losses}</dd></div>
        <div><dt>Самая длинная партия</dt><dd>{stats.longest_own_score !== null ? `${stats.longest_own_score}:${stats.longest_opponent_score}` : "—"}</dd></div>
        <div><dt>Частый счёт</dt><dd>{stats.most_common_score ?? "—"}</dd></div>
      </dl>
    </section>
  );
}

function DailyTable({ view, onPage }: { view: DailyView | null; onPage(page: number): void }) {
  return (
    <section className="table-section">
      {view?.daily_stats.length ? <div className="data-table" role="list">{view.daily_stats.map((day) => <div className="table-row" key={day.played_on} role="listitem"><time dateTime={day.played_on}>{formatDate(day.played_on)}</time><b>{day.wins}:{day.losses}</b></div>)}</div> : <p className="muted-copy">Пока нет сыгранных матчей.</p>}
      <Pagination page={view?.page ?? 1} totalPages={view?.total_pages ?? 1} onPage={onPage} />
    </section>
  );
}

function GamesTable({ view, onPage }: { view: GamesView | null; onPage(page: number): void }) {
  return (
    <section className="table-section">
      {view?.games.length ? <div className="data-table" role="list">{view.games.slice(0, 10).map((game) => <div className="table-row" key={`${game.played_at}-${game.own_score}-${game.opponent_score}`} role="listitem"><time dateTime={game.played_at}>{formatDateTime(game.played_at)}</time><b className={game.own_score > game.opponent_score ? "result-win" : "result-loss"}>{game.own_score}:{game.opponent_score}</b></div>)}</div> : <p className="muted-copy">Пока нет сыгранных матчей.</p>}
      <Pagination page={view?.page ?? 1} totalPages={view?.total_pages ?? 1} onPage={onPage} />
    </section>
  );
}

function ProfileScreen(props: { profile: Profile; editing: boolean; nameInput: string; submitting: boolean; onRating(): void; onLevel(): void; onEdit(): void; onAvatarEdit(): void; onNameInput(value: string): void; onSaveName(event: FormEvent<HTMLFormElement>): void }) {
  const { profile } = props;
  const nameInputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <section className="profile-hero family-profile-hero">
        <div className="profile-avatar-wrap">
          <span className="profile-avatar" aria-hidden="true"><ProfileAvatar value={profile.user.avatar_value} /></span>
          {props.editing ? <motion.button className="profile-avatar-edit" type="button" aria-label="Изменить аватар" initial={{ opacity: 0, transform: "scale(0.94)" }} animate={{ opacity: 1, transform: "scale(1)" }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} onClick={props.onAvatarEdit}><MaterialSymbol name="edit" size={24} weight={550} /></motion.button> : null}
        </div>
        {props.editing ? <form id="profile-name-form" className="profile-name-form" onSubmit={props.onSaveName}>
          <input ref={nameInputRef} autoFocus value={props.nameInput} onChange={(event) => props.onNameInput(event.target.value)} maxLength={64} aria-label="Имя профиля" />
        </form> : <h1>{userName(profile.user)}</h1>}
        <p>{profile.user.username ? `@${profile.user.username}` : "Игрок Telegram"}</p>
      </section>

      <div className={props.editing ? "profile-locked-content profile-locked-content-disabled" : "profile-locked-content"} aria-disabled={props.editing}>
        <section className="profile-actions" aria-label="Действия профиля">
          <button type="button" onClick={props.onRating} disabled={props.editing}><span><MaterialSymbol name="star" size={31} fill weight={600} /></span><small>Рейтинг</small></button>
          <button type="button" onClick={props.onLevel} disabled={props.editing}><span><MaterialSymbol name="analytics" size={31} fill weight={500} /></span><small>Уровень</small></button>
          <button type="button" onClick={props.onEdit} disabled={props.editing}><span><MaterialSymbol name="person" size={31} fill weight={600} /></span><small>Настройки</small></button>
        </section>

        <div className="profile-divider"><span>Статистика</span></div>

        <section className="profile-metrics" aria-label="Статистика игрока">
          <div><span>Игр всего</span><strong><RollingNumber value={gamesCount(profile.stats)} /></strong></div>
          <div><span>Процент побед</span><strong><RollingNumber value={winRate(profile.stats)} />%</strong></div>
        </section>

        <dl className="profile-facts">
          <div><dt><MaterialSymbol name="calendar_month" size={21} weight={450} /><span>Начал играть</span></dt><dd>{formatProfileDate(profile.user.created_at)}</dd></div>
          <div><dt><MaterialSymbol name="analytics" size={21} weight={450} /><span>Уровень игры</span></dt><dd>{profile.player_level}</dd></div>
          <div><dt><MaterialSymbol name="star" size={21} weight={450} /><span>Рейтинг</span></dt><dd>{profile.user.rating ? `${profile.user.rating}${profile.user.rating_is_fnt ? " ФНТР" : ""}` : "Не указан"}</dd></div>
        </dl>

        <div className="profile-divider"><span>Ещё про вас</span></div>
        <dl className="profile-facts profile-detailed-facts">
          <div><dt><MaterialSymbol name="workspace_premium" size={21} weight={450} /><span>Победы</span></dt><dd>{profile.stats.wins}</dd></div>
          <div><dt><MaterialSymbol name="remove_circle" size={21} weight={450} /><span>Поражения</span></dt><dd>{profile.stats.losses}</dd></div>
          <div><dt><MaterialSymbol name="radio_button_checked" size={21} weight={450} /><span>Мячи</span></dt><dd>{profile.stats.points_for}:{profile.stats.points_against}</dd></div>
          <div><dt><MaterialSymbol name="bolt" size={21} weight={450} /><span>Лучшая серия</span></dt><dd>{profile.extended_stats.win_streak}</dd></div>
          <div><dt><MaterialSymbol name="schedule" size={21} weight={450} /><span>Овертаймы</span></dt><dd>{profile.extended_stats.overtime_wins}:{profile.extended_stats.overtime_losses}</dd></div>
        </dl>
      </div>
    </>
  );
}

const playerLevels = [
  { name: "Новичок", detail: "До 49 матчей", threshold: 0, emoji: "👶" },
  { name: "Любитель", detail: "От 50 матчей", threshold: 50, emoji: "🏓" },
  { name: "Бывалый", detail: "От 150 матчей", threshold: 150, emoji: "🤘" },
  { name: "Робот", detail: "От 300 матчей", threshold: 300, emoji: "🦾" },
  { name: "Профик", detail: "От 500 матчей или рейтинг ФНТР", threshold: 500, emoji: "💀" },
] as const;

function LevelsScreen({ profile }: { profile: Profile }) {
  const games = gamesCount(profile.stats);
  const currentIndex = profile.user.rating_is_fnt ? playerLevels.length - 1 : playerLevels.reduce((index, level, levelIndex) => games >= level.threshold ? levelIndex : index, 0);
  const current = playerLevels[currentIndex];
  const next = playerLevels[currentIndex + 1];
  return (
    <>
      <section className="levels-hero">
        <span aria-hidden="true">{current.emoji}</span>
        <p>Твой уровень</p>
        <h1>{current.name}</h1>
        <strong>{games} матчей</strong>
        <small>{next ? `Следующий уровень с ${next.threshold} матчей` : "Максимальный уровень"}</small>
      </section>
      <section className="levels-list" aria-label="Уровни игроков">
        {playerLevels.map((level, index) => (
          <div className={index === currentIndex ? "level-row level-row-current" : "level-row"} key={level.name}>
            <span className="level-emoji" aria-hidden="true">{level.emoji}</span>
            <span><strong>{level.name}</strong><small>{level.detail}</small></span>
            {index === currentIndex ? <MaterialSymbol name="check" size={20} weight={700} /> : null}
          </div>
        ))}
      </section>
    </>
  );
}

const avatarEmojis = ["😀", "😎", "🤩", "🙂", "😊", "🏓", "🔥", "⚡", "🏆", "🎯", "🚀", "🌟", "💪", "🧠", "👾", "🫡"];

function AvatarPicker(props: { open: boolean; submitting: boolean; onClose(): void; onEmoji(value: string): void }) {
  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div className="avatar-picker-overlay" role="presentation" onClick={props.onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          <motion.section className="avatar-picker" role="dialog" aria-modal="true" aria-label="Выбрать аватар" onClick={(event) => event.stopPropagation()} initial={{ opacity: 0, transform: "translateY(24px) scale(0.98)" }} animate={{ opacity: 1, transform: "translateY(0) scale(1)" }} exit={{ opacity: 0, transform: "translateY(18px) scale(0.99)" }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}>
            <header><h2>Выбрать аватар</h2><button type="button" aria-label="Закрыть" onClick={props.onClose}><MaterialSymbol name="close" size={26} weight={500} /></button></header>
            <div className="avatar-emoji-grid" aria-label="Выбрать эмодзи">
              {avatarEmojis.map((emoji) => <motion.button type="button" key={emoji} disabled={props.submitting} whileTap={{ scale: 0.86 }} transition={{ type: "spring", stiffness: 600, damping: 38 }} onClick={() => props.onEmoji(emoji)}>{emoji}</motion.button>)}
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function RatingScreen(props: { profile: Profile; value: string; submitting: boolean; onValue(value: string): void; onSave(event: FormEvent<HTMLFormElement>): void; onClear(): void }) {
  const rating = props.profile.user.rating;
  return (
    <>
      <section className="rating-hero">
        <span aria-hidden="true"><MaterialSymbol name="star" size={46} fill weight={600} /></span>
        <p>Твой рейтинг</p>
        <h1>{rating ?? "Не указан"}</h1>
        <small>{props.profile.user.rating_is_fnt ? "Рейтинг ФНТР" : "Внутренний рейтинг"}</small>
      </section>
      <section className="rating-editor">
        <form className="stacked-form rating-form" onSubmit={props.onSave}>
          <label htmlFor="rating">Рейтинг или ссылка на профиль ФНТР</label>
          <input id="rating" value={props.value} onChange={(event) => props.onValue(event.target.value)} placeholder="Например, 412" required />
          <button className="primary-button" type="submit" disabled={props.submitting}>Сохранить</button>
        </form>
        {rating ? <button className="text-button danger-text" type="button" onClick={props.onClear} disabled={props.submitting}>Очистить рейтинг</button> : null}
      </section>
    </>
  );
}

function ActionMenu(props: {
  mode: ActionSheet;
  opponents: Opponent[];
  code: string;
  input: string;
  message: string;
  submitting: boolean;
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
  const sourceOffsetX = Math.min(window.innerWidth, 430) / 2 - 54;
  const closedTransform = reduceMotion ? "translate(0, 0) scale(0.98)" : `translate(${sourceOffsetX}px, 48px) scale(0.16, 0.19)`;
  const titles: Record<Exclude<ActionSheet, null>, string> = {
    actions: "Добавить",
    opponents: "Добавить счёт",
    share: "Отправить код",
    accept: "Добавить соперника",
  };
  const isRoot = props.mode === "actions";
  return (
    <AnimatePresence>
      {props.mode ? (
        <motion.div className="action-overlay" role="presentation" onClick={props.onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}>
          <motion.section
            className="action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={titles[props.mode]}
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, transform: closedTransform, borderRadius: 30 }}
            animate={{ opacity: 1, transform: "translate(0, 0) scale(1)", borderRadius: 24 }}
            exit={{ opacity: 0, transform: closedTransform, borderRadius: 30 }}
            transition={{ type: "spring", duration: 0.28, bounce: 0.12 }}
          >
            <div className="action-sheet-content">
              <header>
                <h2>{titles[props.mode]}</h2>
                <button type="button" aria-label={isRoot ? "Закрыть" : "Назад"} onClick={isRoot ? props.onClose : props.onBack}>
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      className="action-header-icon"
                      key={isRoot ? "close" : "back"}
                      initial={{ opacity: 0, transform: reduceMotion ? "rotate(0deg) scale(1)" : "rotate(-45deg) scale(0.94)" }}
                      animate={{ opacity: 1, transform: "rotate(0deg) scale(1)" }}
                      exit={{ opacity: 0, transform: reduceMotion ? "rotate(0deg) scale(1)" : "rotate(45deg) scale(0.94)" }}
                      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <MaterialSymbol name={isRoot ? "close" : "arrow_back"} size={26} weight={500} />
                    </motion.span>
                  </AnimatePresence>
                </button>
              </header>
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  className="action-sheet-panel"
                  key={props.mode}
                  initial={{ opacity: 0, transform: reduceMotion ? "translateX(0)" : "translateX(12px)" }}
                  animate={{ opacity: 1, transform: "translateX(0)" }}
                  exit={{ opacity: 0, transform: reduceMotion ? "translateX(0)" : "translateX(-10px)" }}
                  transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                >
                  {props.mode === "actions" ? <div className="action-list">
                    <button type="button" onClick={props.onScore}><span className="action-icon action-icon-blue"><MaterialSymbol name="add" size={27} fill weight={600} /></span><span><strong>Добавить счёт</strong><small>Записать результат партии</small></span></button>
                    <button type="button" onClick={props.onShare}><span className="action-icon action-icon-green"><MaterialSymbol name="send" size={25} fill weight={600} /></span><span><strong>Отправить код</strong><small>Пригласить нового соперника</small></span></button>
                    <button type="button" onClick={props.onAccept}><span className="action-icon action-icon-pink"><MaterialSymbol name="add_circle" size={26} fill weight={600} /></span><span><strong>Добавить соперника</strong><small>Ввести полученный код</small></span></button>
                  </div> : null}
                  {props.mode === "opponents" ? <div className="action-list opponent-picker">
                    {props.opponents.map((opponent) => <button type="button" key={opponent.id} onClick={() => props.onScoreOpponent(opponent)}><span className="avatar">{initials(opponentName(opponent))}</span><span><strong>{opponentName(opponent)}</strong><small>{opponent.stats ? `${opponent.stats.wins} : ${opponent.stats.losses}` : "Нет матчей"}</small></span><MaterialSymbol name="chevron_right" size={24} /></button>)}
                    {!props.opponents.length ? <p className="muted-copy">Сначала добавь соперника по коду.</p> : null}
                  </div> : null}
                  {props.mode === "share" ? <div className="invite-sheet">
                    <span>Твой код</span>
                    <strong>{props.code || "…"}</strong>
                    <div className="invite-actions">
                      <button className="sheet-primary-button" type="button" onClick={props.onCopyInvite} disabled={!props.code}>Скопировать</button>
                      <button className="sheet-telegram-button" type="button" aria-label="Отправить через Telegram" title="Отправить через Telegram" onClick={props.onShareInvite} disabled={!props.code}>
                        <MaterialSymbol name="send" size={25} fill weight={600} />
                      </button>
                    </div>
                  </div> : null}
                  {props.mode === "accept" ? <form className="invite-sheet invite-sheet-form" onSubmit={props.onAcceptInvite}>
                    <label htmlFor="invite-code">Код приглашения</label>
                    <input id="invite-code" value={props.input} onChange={(event) => props.onInput(event.target.value.toUpperCase())} placeholder="Например, ABC123" autoComplete="off" required />
                    <button className="sheet-primary-button" type="submit" disabled={props.submitting}>Добавить</button>
                    {props.message ? <p>{props.message}</p> : null}
                  </form> : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function EditScreen(props: { opponentName: string; gamesTotal: string; pointsTotal: string; submitting: boolean; onGamesTotal(value: string): void; onPointsTotal(value: string): void; onSaveGames(): void; onSavePoints(): void; onReset(): void; onDelete(): void }) {
  return (
    <>
      <section className="edit-hero edit-profile-hero"><span className="avatar avatar-opponent" aria-hidden="true">{initials(props.opponentName)}</span><h1>{props.opponentName}</h1><p>Правки сохраняются для обоих связанных игроков.</p></section>
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
  return <section className="confirm-screen"><p className="eyebrow">Подтверждение</p><h1>{isDelete ? "Удалить соперника?" : "Сбросить статистику?"}</h1><p>{isDelete ? `${opponentName} и вся история ваших матчей будут удалены.` : `${opponentName} останется в списке, но история и ручные итоги обнулятся.`}</p><div className="confirm-actions"><button className="primary-button" type="button" onClick={onCancel}>Отменить</button><button className="danger-button" type="button" onClick={onConfirm} disabled={submitting}>{isDelete ? "Удалить" : "Сбросить"}</button></div></section>;
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage(page: number): void }) {
  if (totalPages <= 1) {
    return null;
  }
  return <div className="pagination"><button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1}>Назад</button><span>{page} / {totalPages}</span><button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Дальше</button></div>;
}

function TabButton({ active, children, onClick }: { active: boolean; children: string; onClick(): void }) {
  return <button className={active ? "tab-button tab-button-active" : "tab-button"} type="button" role="tab" aria-selected={active} onClick={onClick}>{children}</button>;
}

function LoadingScreen() {
  return <section className="loading-screen"><p className="eyebrow">пинг понг каунтер</p><h1>Загружаем матч</h1></section>;
}

function TelegramOnlyScreen() {
  return <section className="loading-screen"><p className="eyebrow">пинг понг каунтер</p><h1>Открой приложение в Telegram</h1><p>Так мы безопасно узнаем твою учётную запись и загрузим статистику</p></section>;
}

function ErrorScreen({ error, onRetry }: { error: string; onRetry(): void }) {
  return <section className="loading-screen"><p className="eyebrow">Ошибка загрузки</p><h1>Не удалось открыть матч</h1><p>{error}</p><button className="primary-button" type="button" onClick={onRetry}>Повторить</button></section>;
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
