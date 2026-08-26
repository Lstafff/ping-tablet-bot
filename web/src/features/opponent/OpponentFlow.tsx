import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

import type { DailyView, ExtendedStats, GamesView, Opponent, OpponentStats, RecentGame, Stats } from "../../api/types";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { HeaderActionButton, HeaderAvatarBackMorph } from "../../components/PageHeader";
import { ProgressiveLoadTrigger } from "../../components/ProgressiveLoadTrigger";
import { ProfileAvatarContent } from "../../components/ProfileAvatar";
import { EloDeltaBadge, ScorePair, ScoreValue } from "../../components/ScoreDisplay";
import { SegmentedControl } from "../../components/SegmentedControl";
import { easeOut, opponentSharedLayoutId } from "../../lib/motion";
import { gamesCount, opponentName, winRate } from "../../lib/player";
import { calculateOpponentHeaderCollapseState, calculateOpponentHeaderSnapTarget } from "./collapsingHeader";
import "./opponent.css";

export type StatsTab = "summary" | "days" | "games";

export type OpponentScreenProps = {
  opponent: Opponent;
  profileAvatar: string | null;
  layoutIdentity: string | number;
  stats: OpponentStats | null;
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

  const tabContent = !stats ? null : props.tab === "summary" ? (
    <StatsSummary stats={stats.extended_stats} />
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

  const reveal = (index: number) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)", filter: "blur(3px)" },
    animate: { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
    transition: { duration: reduceMotion ? 0.12 : 0.28, delay: reduceMotion ? 0 : index * 0.04, ease: easeOut },
  });

  return (
    <>
      <OpponentCollapsingHeader opponent={opponent} profileAvatar={props.profileAvatar} layoutIdentity={props.layoutIdentity} stats={stats?.stats ?? opponent.stats} onBack={props.onBack} onEdit={props.onEdit} pending={!stats} />

      {stats ? (
        <>
          <motion.div className="opponent-reveal-group" {...reveal(0)}>
            <ActivityHeatmap games={props.chartGames} />
          </motion.div>

          <motion.div className="opponent-reveal-group" {...reveal(1)}>
            <section className="opponent-metrics" aria-label="Главная статистика">
              <div><span>Мячи</span><strong><ScorePair left={<AnimatedNumber value={stats.stats.points_for} animateOnMount />} right={<AnimatedNumber value={stats.stats.points_against} animateOnMount />} /></strong></div>
              <div><span>Текущая серия</span><strong><AnimatedNumber value={stats.extended_stats.win_streak} animateOnMount /></strong></div>
            </section>
          </motion.div>

          <motion.div className="opponent-reveal-group opponent-stats-region" {...reveal(2)}>
            <SegmentedControl
              ariaLabel="Ваша статистика"
              idPrefix="opponent-stats"
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
                id={`opponent-stats-panel-${props.tab}`}
                role="tabpanel"
                aria-labelledby={`opponent-stats-tab-${props.tab}`}
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
          </motion.div>
        </>
      ) : null}
    </>
  );
}

export function OpponentCollapsingHeader({ opponent, profileAvatar, layoutIdentity = opponent.id, stats, onBack, onEdit, pending = false }: { opponent: Opponent; profileAvatar: string | null; layoutIdentity?: string | number; stats?: Stats; onBack(): void; onEdit(): void; pending?: boolean }) {
  const reduceMotion = useReducedMotion();
  const headerRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLSpanElement>(null);
  const avatarContentRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const resolvedStats = stats ?? opponent.stats;

  useLayoutEffect(() => {
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const header = headerRef.current;
      const backdrop = backdropRef.current;
      const avatarContent = avatarContentRef.current;
      const name = nameRef.current;
      if (!header || !backdrop || !avatarContent || !name) return;

      const state = calculateOpponentHeaderCollapseState(window.scrollY, Boolean(reduceMotion));
      const avatarTransform = reduceMotion
        ? "none"
        : `translate3d(0, ${state.avatarTranslateY}px, 0) scale(${state.avatarScale})`;
      avatarContent.style.transform = avatarTransform;
      avatarContent.style.visibility = reduceMotion && state.progress === 1 ? "hidden" : "visible";
      name.style.transform = reduceMotion ? "none" : `translate3d(0, ${state.nameTranslateY}px, 0) scale(${state.nameScale})`;
      const score = scoreRef.current;
      if (score) {
        score.style.fontWeight = String(state.scoreFontWeight);
        score.style.transform = reduceMotion ? "none" : `translate3d(0, ${state.scoreTranslateY}px, 0) scale(${state.scoreScale})`;
      }
      if (summaryRef.current) {
        summaryRef.current.style.opacity = String(state.summaryOpacity);
        summaryRef.current.style.transform = reduceMotion ? "none" : `translate3d(0, ${state.summaryTranslateY}px, 0)`;
      }
      backdrop.style.opacity = String(state.backdropOpacity);
    };
    let snapTimer: number | null = null;
    let snapAnimation: ReturnType<typeof animate> | null = null;
    let snapping = false;
    let pointerActive = false;
    const snapToRestingState = () => {
      snapTimer = null;
      const scrollY = window.scrollY;
      const target = calculateOpponentHeaderSnapTarget(scrollY);
      if (target === null || reduceMotion) return;
      snapping = true;
      snapAnimation = animate(scrollY, target, {
        type: "spring",
        stiffness: 420,
        damping: 38,
        mass: 0.8,
        onUpdate: (value) => window.scrollTo({ top: value, behavior: "auto" }),
        onComplete: () => {
          snapping = false;
          snapAnimation = null;
        },
      });
    };
    const requestUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(update);
      if (reduceMotion || snapping || pointerActive) return;
      if (snapTimer !== null) window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(snapToRestingState, 110);
    };
    const stopSnap = () => {
      if (snapTimer !== null) window.clearTimeout(snapTimer);
      snapTimer = null;
      snapAnimation?.stop();
      snapAnimation = null;
      snapping = false;
    };
    const beginPointerInteraction = () => {
      pointerActive = true;
      stopSnap();
    };
    const endPointerInteraction = () => {
      pointerActive = false;
      requestUpdate();
    };
    const handleWheel = () => {
      stopSnap();
      requestUpdate();
    };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("pointerdown", beginPointerInteraction, { passive: true });
    window.addEventListener("pointerup", endPointerInteraction, { passive: true });
    window.addEventListener("pointercancel", endPointerInteraction, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      window.removeEventListener("pointerdown", beginPointerInteraction);
      window.removeEventListener("pointerup", endPointerInteraction);
      window.removeEventListener("pointercancel", endPointerInteraction);
      window.removeEventListener("wheel", handleWheel);
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (snapTimer !== null) window.clearTimeout(snapTimer);
      snapAnimation?.stop();
    };
  }, [opponent.id, reduceMotion, resolvedStats]);

  return (
    <>
      <header className="opponent-collapsing-header" ref={headerRef} aria-label={`Статистика с ${opponentName(opponent)}`} aria-busy={pending || undefined}>
        <span className="opponent-header-backdrop" ref={backdropRef} aria-hidden="true" />
        <HeaderAvatarBackMorph className="opponent-header-back" value={profileAvatar} onBack={onBack} />
        <HeaderActionButton className="opponent-header-edit" icon="pencil" label="Редактировать" onClick={onEdit} />
        <motion.span
          className="opponent-header-avatar-stage"
          layoutId={reduceMotion ? undefined : opponentSharedLayoutId(layoutIdentity, "avatar")}
          transition={{ layout: { duration: 0.24, ease: easeOut } }}
          aria-hidden="true"
        >
          <span className="avatar avatar-opponent opponent-header-avatar-content" ref={avatarContentRef}>
            <ProfileAvatarContent value={opponent.avatar_value ?? null} defaultIconSize={40} />
          </span>
        </motion.span>
        {resolvedStats ? (
          <>
            <span className="opponent-header-name-stage">
              <motion.span className="opponent-header-name-layout" layoutId={reduceMotion ? undefined : opponentSharedLayoutId(layoutIdentity, "name")} transition={{ layout: { duration: 0.24, ease: easeOut } }}>
                <h1 className="opponent-header-name" ref={nameRef}>{opponentName(opponent)}</h1>
              </motion.span>
            </span>
            <span className="opponent-header-score-stage">
              <motion.span className="opponent-header-score-layout" layoutId={reduceMotion ? undefined : opponentSharedLayoutId(layoutIdentity, "score")} transition={{ layout: { duration: 0.24, ease: easeOut } }}>
                <span className="opponent-scoreline opponent-header-score" ref={scoreRef} aria-label={`Побед ${resolvedStats.wins}, поражений ${resolvedStats.losses}`}>
                  <ScorePair left={<strong><AnimatedNumber value={resolvedStats.wins} animateOnMount /></strong>} right={<strong><AnimatedNumber value={resolvedStats.losses} animateOnMount /></strong>} />
                </span>
              </motion.span>
            </span>
            <p className="opponent-header-summary" ref={summaryRef}><strong><AnimatedNumber value={winRate(resolvedStats)} animateOnMount />%</strong> побед · <AnimatedNumber value={gamesCount(resolvedStats)} animateOnMount /> партий</p>
          </>
        ) : <span className="opponent-header-name-stage"><motion.span className="opponent-header-name-layout" layoutId={reduceMotion ? undefined : opponentSharedLayoutId(layoutIdentity, "name")} transition={{ layout: { duration: 0.24, ease: easeOut } }}><h1 className="opponent-header-name" ref={nameRef}>{opponentName(opponent)}</h1></motion.span></span>}
      </header>
      <div className="opponent-header-spacer" aria-hidden="true" />
    </>
  );
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
        <div><dt>Текущая серия</dt><dd><AnimatedNumber value={stats.win_streak} animateOnMount /></dd></div>
        <div><dt>Овертаймы</dt><dd><ScorePair left={<AnimatedNumber value={stats.overtime_wins} animateOnMount />} right={<AnimatedNumber value={stats.overtime_losses} animateOnMount />} /></dd></div>
        <div><dt>Самая длинная партия</dt><dd>{stats.longest_own_score !== null ? <ScorePair left={<AnimatedNumber value={stats.longest_own_score} animateOnMount />} right={<AnimatedNumber value={stats.longest_opponent_score ?? "—"} animateOnMount />} /> : "—"}</dd></div>
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
