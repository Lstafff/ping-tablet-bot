import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

import type { DailyView, ExtendedStats, GamesView, Opponent, OpponentStats, RecentGame, Stats } from "../../api/types";
import { AppIcon } from "../../components/AppIcon";
import { ProgressiveLoadTrigger } from "../../components/ProgressiveLoadTrigger";
import { ProfileAvatarContent } from "../../components/ProfileAvatar";
import { EloDeltaBadge, ScorePair, ScoreValue } from "../../components/ScoreDisplay";
import { SegmentedControl } from "../../components/SegmentedControl";
import { easeOut } from "../../lib/motion";
import { gamesCount, opponentName, winRate } from "../../lib/player";
import { calculateOpponentHeaderCollapseState } from "./collapsingHeader";

export type StatsTab = "summary" | "days" | "games";

export type OpponentScreenProps = {
  opponent: Opponent;
  stats: OpponentStats;
  tab: StatsTab;
  daily: DailyView | null;
  games: GamesView | null;
  chartGames: RecentGame[];
  onTabChange(tab: StatsTab): void;
  dailyLoadingMore: boolean;
  dailyLoadError: string;
  gamesLoadingMore: boolean;
  gamesLoadError: string;
  onDaysLoadMore(): void;
  onGamesLoadMore(): void;
  onEdit(): void;
  editingOpen: boolean;
  onBack(): void;
};

export function OpponentScreen(props: OpponentScreenProps) {
  const { opponent, stats } = props;
  const reduceMotion = useReducedMotion();
  const previousTab = useRef(props.tab);
  const tabOrder: Record<StatsTab, number> = { summary: 0, days: 1, games: 2 };
  const tabDirection = Math.sign(tabOrder[props.tab] - tabOrder[previousTab.current]);

  useEffect(() => {
    previousTab.current = props.tab;
  }, [props.tab]);

  const tabContent = props.tab === "summary" ? (
    <>
      <StatsSummary stats={stats.extended_stats} />
      {!props.editingOpen ? (
        <button
          className="secondary-button opponent-edit-inline"
          type="button"
          onClick={props.onEdit}
        >
          Редактировать
        </button>
      ) : <span className="opponent-edit-inline-placeholder" aria-hidden="true" />}
    </>
  ) : props.tab === "days" ? (
    <DailyTable
      view={props.daily}
      loadingMore={props.dailyLoadingMore}
      loadError={props.dailyLoadError}
      onLoadMore={props.onDaysLoadMore}
    />
  ) : (
    <GamesTable
      view={props.games}
      loadingMore={props.gamesLoadingMore}
      loadError={props.gamesLoadError}
      onLoadMore={props.onGamesLoadMore}
    />
  );

  return (
    <>
      <OpponentCollapsingHeader opponent={opponent} stats={stats.stats} onBack={props.onBack} />

      <ActivityHeatmap games={props.chartGames} />

      <section className="opponent-metrics" aria-label="Главная статистика">
        <div><span>Мячи</span><strong><ScorePair left={stats.stats.points_for} right={stats.stats.points_against} /></strong></div>
        <div><span>Текущая серия</span><strong>{stats.extended_stats.win_streak}</strong></div>
      </section>

      <SegmentedControl
        ariaLabel="Статистика с соперником"
        value={props.tab}
        options={[
          { value: "summary", label: "Общая" },
          { value: "days", label: "По дням" },
          { value: "games", label: "По играм" },
        ]}
        onChange={props.onTabChange}
      />

      <AnimatePresence initial={false} mode="popLayout" custom={tabDirection}>
        <motion.div
          className="opponent-tab-content"
          key={props.tab}
          custom={tabDirection}
          variants={{
            initial: (direction: number) => ({
              opacity: 0,
              transform: reduceMotion ? "translateX(0)" : `translateX(${direction >= 0 ? 14 : -14}px)`,
            }),
            animate: { opacity: 1, transform: "translateX(0)" },
            exit: (direction: number) => ({
              opacity: 0,
              transform: reduceMotion ? "translateX(0)" : `translateX(${direction >= 0 ? -10 : 10}px)`,
            }),
          }}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: easeOut }}
        >
          {tabContent}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export function OpponentCollapsingHeader({ opponent, stats, onBack, pending = false }: { opponent: Opponent; stats?: Stats; onBack(): void; pending?: boolean }) {
  const reduceMotion = useReducedMotion();
  const headerRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLSpanElement>(null);
  const avatarRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const resolvedStats = stats ?? opponent.stats;

  useLayoutEffect(() => {
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const header = headerRef.current;
      const backdrop = backdropRef.current;
      const avatar = avatarRef.current;
      const title = titleRef.current;
      if (!header || !backdrop || !avatar || !title) return;

      const state = calculateOpponentHeaderCollapseState(window.scrollY, Boolean(reduceMotion));
      avatar.style.opacity = String(state.avatarOpacity);
      avatar.style.transform = `translate3d(0, ${state.avatarTranslateY}px, 0) scale(${state.avatarScale})`;
      title.style.color = `color-mix(in srgb, var(--color-text-primary) ${state.titlePrimaryShare}%, var(--color-text-secondary))`;
      title.style.transform = `translate3d(0, ${state.titleTranslateY}px, 0) scale(${state.titleScale})`;
      if (summaryRef.current) {
        summaryRef.current.style.opacity = String(state.summaryOpacity);
        summaryRef.current.style.transform = reduceMotion ? "none" : `translate3d(0, ${state.summaryTranslateY}px, 0)`;
      }
      backdrop.style.opacity = String(state.backdropOpacity);
    };
    const requestUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [opponent.id, reduceMotion, resolvedStats]);

  return (
    <>
      <header className="opponent-collapsing-header" ref={headerRef} aria-label={`Статистика с ${opponentName(opponent)}`} aria-busy={pending || undefined}>
        <span className="opponent-header-backdrop" ref={backdropRef} aria-hidden="true" />
        <button className="opponent-header-back" type="button" aria-label="Назад" title="Назад" onClick={onBack}>
          <AppIcon name="chevron-left" size={30} aria-hidden="true" />
        </button>
        <span className="avatar avatar-opponent opponent-header-avatar" ref={avatarRef} aria-hidden="true">
          <ProfileAvatarContent value={opponent.avatar_value ?? null} />
        </span>
        {resolvedStats ? (
          <>
            <div className="opponent-header-title" ref={titleRef}>
              <h1 className="opponent-header-name">{opponentName(opponent)}</h1>
              <div className="opponent-scoreline opponent-header-score" aria-label={`Побед ${resolvedStats.wins}, поражений ${resolvedStats.losses}`}>
                <ScorePair left={<strong>{resolvedStats.wins}</strong>} right={<strong>{resolvedStats.losses}</strong>} />
              </div>
            </div>
            <p className="opponent-header-summary" ref={summaryRef}><strong>{winRate(resolvedStats)}%</strong> побед · {gamesCount(resolvedStats)} партий</p>
          </>
        ) : <div className="opponent-header-title" ref={titleRef}><h1 className="opponent-header-name">{opponentName(opponent)}</h1></div>}
      </header>
      <div className="opponent-header-spacer" aria-hidden="true" />
    </>
  );
}

export function OpponentOpeningScreen({ opponent, onBack }: { opponent: Opponent; onBack(): void }) {
  return <OpponentCollapsingHeader opponent={opponent} stats={opponent.stats} onBack={onBack} pending />;
}

const activityWeekCount = 26;

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function gameCountLabel(value: number): string {
  const remainder100 = value % 100;
  const remainder10 = value % 10;
  if (remainder100 >= 11 && remainder100 <= 14) return `${value} игр`;
  if (remainder10 === 1) return `${value} игра`;
  if (remainder10 >= 2 && remainder10 <= 4) return `${value} игры`;
  return `${value} игр`;
}

function dayCountLabel(value: number): string {
  const remainder100 = value % 100;
  const remainder10 = value % 10;
  if (remainder100 >= 11 && remainder100 <= 14) return `${value} дней`;
  if (remainder10 === 1) return `${value} день`;
  if (remainder10 >= 2 && remainder10 <= 4) return `${value} дня`;
  return `${value} дней`;
}

export function ActivityHeatmap({ games }: { games: RecentGame[] }) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay());
  const startDate = new Date(currentWeekStart);
  startDate.setDate(currentWeekStart.getDate() - (activityWeekCount - 1) * 7);

  const activityByDay = new Map<string, { wins: number; losses: number }>();
  for (const game of games) {
    const playedAt = new Date(game.played_at);
    if (Number.isNaN(playedAt.valueOf())) continue;
    const key = localDateKey(playedAt);
    const activity = activityByDay.get(key) ?? { wins: 0, losses: 0 };
    if (game.own_score > game.opponent_score) activity.wins += 1;
    else activity.losses += 1;
    activityByDay.set(key, activity);
  }

  const visibleStartKey = localDateKey(startDate);
  const todayKey = localDateKey(today);
  const visibleActivity = [...activityByDay.entries()].filter(([key]) => key >= visibleStartKey && key <= todayKey);
  const activeDays = visibleActivity.length;
  const visibleGames = visibleActivity.reduce((total, [, value]) => total + value.wins + value.losses, 0);
  const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

  return (
    <section className="match-activity" aria-labelledby="match-activity-title">
      <div className="match-activity-heading">
        <span id="match-activity-title">Активность</span>
        <strong>{activeDays ? `${dayCountLabel(activeDays)} с матчами` : "Матчей пока нет"}</strong>
      </div>
      <div className="activity-calendar" role="img" aria-label={`Активность за 26 недель: ${gameCountLabel(visibleGames)}`}>
        {Array.from({ length: activityWeekCount }, (_, weekIndex) => (
          <span className="activity-week" aria-hidden="true" key={`week-${weekIndex}`}>
            {Array.from({ length: 7 }, (_, dayIndex) => {
              const date = new Date(startDate);
              date.setDate(startDate.getDate() + weekIndex * 7 + dayIndex);
              const key = localDateKey(date);
              const activity = activityByDay.get(key);
              const total = (activity?.wins ?? 0) + (activity?.losses ?? 0);
              const result = !total ? "none" : activity?.wins && activity.losses ? "mixed" : activity?.wins ? "win" : "loss";
              const title = total ? `${dateFormatter.format(date)}: ${gameCountLabel(total)}` : `${dateFormatter.format(date)}: матчей нет`;
              return <i className="activity-cell" data-future={key > todayKey || undefined} data-level={Math.min(total, 3)} data-result={result} key={key} title={title} />;
            })}
          </span>
        ))}
      </div>
      <div className="match-activity-footer">
        <span>{dateFormatter.format(startDate)}</span>
        <span className="activity-legend">
          <span><i className="activity-cell" data-level="1" data-result="win" />Победы</span>
          <span><i className="activity-cell" data-level="1" data-result="mixed" />Оба исхода</span>
          <span><i className="activity-cell" data-level="1" data-result="loss" />Поражения</span>
        </span>
        <span>Сегодня</span>
      </div>
    </section>
  );
}

export function StatsSummary({ stats }: { stats: ExtendedStats }) {
  return (
    <section className="details-section">
      <dl className="facts-list">
        <div><dt>Текущая серия</dt><dd>{stats.win_streak}</dd></div>
        <div><dt>Овертаймы</dt><dd><ScorePair left={stats.overtime_wins} right={stats.overtime_losses} /></dd></div>
        <div><dt>Самая длинная партия</dt><dd>{stats.longest_own_score !== null ? <ScorePair left={stats.longest_own_score} right={stats.longest_opponent_score ?? "—"} /> : "—"}</dd></div>
        <div><dt>Частый счёт</dt><dd><ScoreValue value={stats.most_common_score} /></dd></div>
      </dl>
    </section>
  );
}

export function DailyTable({ view, loadingMore, loadError, onLoadMore }: { view: DailyView | null; loadingMore: boolean; loadError: string; onLoadMore(): void }) {
  return (
    <section className="table-section">
      {view?.daily_stats.length ? <div className="data-table" role="list">{view.daily_stats.map((day) => <div className="table-row" key={day.played_on} role="listitem"><time dateTime={day.played_on}>{formatDate(day.played_on)}</time><b><ScorePair left={day.wins} right={day.losses} /></b></div>)}</div> : <p className="muted-copy">Пока нет сыгранных матчей.</p>}
      <ProgressiveLoadTrigger error={loadError} hasMore={(view?.page ?? 1) < (view?.total_pages ?? 1)} loading={loadingMore} onLoadMore={onLoadMore} />
    </section>
  );
}

export function GamesTable({ view, loadingMore, loadError, onLoadMore }: { view: GamesView | null; loadingMore: boolean; loadError: string; onLoadMore(): void }) {
  return (
    <section className="table-section">
      {view?.games.length ? <div className="data-table" role="list">{view.games.map((game) => {
        const won = game.own_score > game.opponent_score;
        return (
          <div className="table-row" key={`${game.game_id ?? game.played_at}-${game.own_score}-${game.opponent_score}`} role="listitem">
            <span className="table-game-copy">
              <small className={won ? "result-win" : "result-loss"}>{won ? "Победа" : "Поражение"}</small>
              <time dateTime={game.played_at}>{formatDateTime(game.played_at)}</time>
            </span>
            <span className="table-result"><b><ScorePair left={game.own_score} right={game.opponent_score} /></b><EloDeltaBadge value={game.elo_change} /></span>
          </div>
        );
      })}</div> : <p className="muted-copy">Пока нет сыгранных матчей.</p>}
      <ProgressiveLoadTrigger error={loadError} hasMore={(view?.page ?? 1) < (view?.total_pages ?? 1)} loading={loadingMore} onLoadMore={onLoadMore} />
    </section>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
