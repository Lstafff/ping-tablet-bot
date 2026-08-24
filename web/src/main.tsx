import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from "motion/react";
import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import ReactDOM from "react-dom/client";

import "@fontsource-variable/nunito/wght.css";

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
} from "./api/types";
import { ErrorScreen, InitialAppSkeleton } from "./components/AppLoading";
import { BottomNavigation, MainTab } from "./components/BottomNavigation";
import { PageHeader } from "./components/PageHeader";
export { LegacyMorphingHeaderTitle, LegacyWaveHeaderTitle } from "./components/PageHeader";
import { ProgressiveBottomBlur } from "./components/ProgressiveBottomBlur";
import { Snackbar, type SnackbarTone } from "./components/Snackbar";
import { ActionMenu, AvatarPicker, type ActionSheet } from "./features/actions/ActionMenu";
import { HistoryScreen } from "./features/history/HistoryScreen";
import { HomeScreen } from "./features/home/HomeScreen";
import { OpponentEditMenu, type OpponentEditSheet } from "./features/opponent/OpponentEditMenu";
import { OpponentScreen, type StatsTab } from "./features/opponent/OpponentFlow";
import { LevelsScreen, ProfileScreen } from "./features/profile/ProfileScreens";
import { ScoreDrawer, type ScoreSide } from "./features/score/ScoreDrawer";
import { easeInOut, easeOut } from "./lib/motion";
import { api } from "./lib/preview-api";
import { historyGameKey, opponentName, userName } from "./lib/player";
import { tma } from "./lib/tma";
import "./tokens.css";
import "./styles.css";

type Screen = "home" | "stats" | "profile" | "levels" | "opponent";
type ConfirmAction = "reset" | "delete";
type InviteMode = "share" | "accept";
type ScoreReturnTarget = "home" | "opponent";
type PendingAction = "score" | "opponent" | "invite" | "rating" | "profile" | "avatar";
type PaginationRequest = { token: number; inFlight: boolean };
type SnackbarNotice = { id: number; tone: SnackbarTone; message: string } | null;
type ScreenMotion = { kind: "none" } | { kind: "reveal" } | { kind: "tab"; direction: -1 | 1 } | { kind: "back" };

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

function createOperationId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `score-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function recentGameKey(game: RecentGame): string {
  return `${game.game_id ?? game.played_at}-${game.own_score}-${game.opponent_score}`;
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
  const [opponentLayoutIdentity, setOpponentLayoutIdentity] = useState<string | number>(0);
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
  const nestedEntryScrollSnapshot = useRef<{ screen: Screen; top: number } | null>(null);
  const previousRenderedScreen = useRef<Screen>(screen);
  const opponentRequestId = useRef(0);
  const historyPageRequest = useRef<PaginationRequest>({ token: 0, inFlight: false });
  const dailyPageRequest = useRef<PaginationRequest>({ token: 0, inFlight: false });
  const gamesPageRequest = useRef<PaginationRequest>({ token: 0, inFlight: false });
  const scoreOperationId = useRef<string | null>(null);
  const hasRevealedInitialContent = useRef(false);

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
    if (!loading) hasRevealedInitialContent.current = true;
  }, [loading]);

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
      if (!restoresScroll) return;
      const snapshot = nestedEntryScrollSnapshot.current;
      if (snapshot?.screen === screen) {
        sessionStorage.setItem(key, String(snapshot.top));
        nestedEntryScrollSnapshot.current = null;
      } else {
        sessionStorage.setItem(key, String(window.scrollY));
      }
    };
  }, [screen]);

  useEffect(() => {
    if (!actionSheet && !opponentEditSheet && !avatarPickerOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [actionSheet, opponentEditSheet, avatarPickerOpen]);

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

  const openOpponent = (opponent: Opponent, tab: StatsTab = "summary", page = 1, returnScreen: "home" | "stats" = screen === "stats" ? "stats" : "home", layoutIdentity: string | number = opponent.id) => {
    setScreenTransition("default");
    setOpponentLayoutIdentity(layoutIdentity);
    opponentReturnScreen.current = returnScreen;
    if (screen === "home" || screen === "stats" || screen === "profile") {
      nestedEntryScrollSnapshot.current = { screen, top: window.scrollY };
    }
    window.scrollTo({ top: 0, behavior: "auto" });
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
    openOpponent(knownOpponent ?? fallbackOpponent, "summary", 1, "stats", `history-${historyGameKey(game)}`);
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
    if (screen === "levels") {
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
      return <InitialAppSkeleton />;
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
          opponents={opponents}
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
      return (
        <OpponentScreen
          opponent={selectedOpponent}
          layoutIdentity={opponentLayoutIdentity}
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
    return <HomeScreen profile={profile} opponents={opponents} onOpenOpponent={openOpponent} />;
  })();

  const canShowNavigation = profile && !loading && (screen === "home" || screen === "stats" || screen === "profile" || screen === "opponent");
  const activeTab: MainTab = screen === "stats" || screen === "profile" ? screen : "matches";
  const savedHistoryScroll = screen === "stats" ? Number(sessionStorage.getItem("ping-tablet:scroll:stats") ?? 0) : 0;
  const screenMotion: ScreenMotion = !loading && !hasRevealedInitialContent.current
    ? { kind: "reveal" }
    : screenTransition === "back"
    ? { kind: "back" }
    : isMainTabScreen(screen) && isMainTabScreen(previousRenderedScreen.current) && savedHistoryScroll <= 0 && mainTabDirection !== 0
      ? { kind: "tab", direction: mainTabDirection }
      : { kind: "none" };

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="ping-tablet-layout">
        <div className="app-shell" data-vaul-drawer-wrapper="">
          {!loading && profile && (screen === "home" || screen === "stats") ? (
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
              key={loading ? "initial-loading" : screen}
              data-screen={screen}
              custom={screenMotion}
              variants={{
                initial: (motion: ScreenMotion) => ({
                  opacity: motion.kind === "tab" || motion.kind === "reveal" ? 0 : 1,
                  transform: reduceMotion
                    ? "translateX(0)"
                    : motion.kind === "tab"
                      ? `translateX(${motion.direction > 0 ? 14 : -14}px)`
                      : "translateX(0)",
                  filter: motion.kind === "reveal" && !reduceMotion ? "blur(2px)" : "blur(0)",
                  zIndex: 0,
                }),
                animate: {
                  opacity: 1,
                  transform: "translate(0, 0)",
                  filter: "blur(0)",
                  zIndex: 0,
                },
                exit: (motion: ScreenMotion) => {
                  if (motion.kind === "reveal") {
                    return {
                      opacity: 0,
                      transform: "translateX(0)",
                      filter: reduceMotion ? "blur(0)" : "blur(2px)",
                      zIndex: 0,
                      transition: { duration: 0.16, ease: easeInOut },
                    };
                  }
                  if (motion.kind === "back") {
                    return {
                      opacity: reduceMotion ? 0 : 1,
                      transform: reduceMotion ? "translateX(0)" : "translate3d(102vw, 0, 0)",
                      zIndex: 2,
                      transition: { duration: reduceMotion ? 0.12 : 0.25, ease: easeOut },
                    };
                  }
                  if (motion.kind === "tab") {
                    return {
                      opacity: 0,
                      transform: reduceMotion ? "translateX(0)" : `translateX(${motion.direction > 0 ? -14 : 14}px)`,
                      zIndex: 0,
                    };
                  }
                  return { opacity: 1, transform: "translateX(0)", filter: "blur(0)", zIndex: 0, transition: { duration: 0 } };
                },
              }}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: reduceMotion ? 0.12 : screenMotion.kind === "reveal" ? 0.2 : 0.18, ease: easeOut }}
            >
              {screen === "levels" ? <PageHeader title="Уровень" onBack={goBack} /> : null}
              {page}
            </motion.main>
          </AnimatePresence>
        </div>

        {canShowNavigation ? <ProgressiveBottomBlur /> : null}
        {canShowNavigation ? (
          <div className="bottom-toolbar-slot">
            <div className="bottom-nav-slot">
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
            </div>
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
      </LayoutGroup>
    </MotionConfig>
  );
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
