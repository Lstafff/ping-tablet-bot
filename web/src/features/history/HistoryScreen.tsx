import { motion, useReducedMotion } from "motion/react";

import type { HistoryGame, HistoryView, Opponent } from "../../api/types";
import { AppIcon } from "../../components/AppIcon";
import { MorphingHeading } from "../../components/PageHeader";
import { ProfileAvatarContent } from "../../components/ProfileAvatar";
import { ProgressiveLoadTrigger } from "../../components/ProgressiveLoadTrigger";
import { EloDeltaBadge, ScorePair } from "../../components/ScoreDisplay";
import { easeOut, opponentSharedLayoutId } from "../../lib/motion";
import { historyGameKey } from "../../lib/player";
import "./history.css";

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

export function HistoryScreen({
  newestFirst,
  view,
  opponents,
  loadingMore,
  loadError,
  onLoadMore,
  onOpenOpponent,
}: {
  newestFirst: boolean;
  view: HistoryView | null;
  opponents: Opponent[];
  loadingMore: boolean;
  loadError: string;
  onLoadMore(): void;
  onOpenOpponent(game: HistoryGame): void;
}) {
  const reduceMotion = useReducedMotion();
  const opponentById = new Map(opponents.map((opponent) => [opponent.id, opponent]));
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
              const layoutIdentity = `history-${historyGameKey(game)}`;
              const opponent = opponentById.get(game.opponent_id);
              return (
                <motion.button
                  className="history-row"
                  type="button"
                  key={`${game.opponent_id}-${game.played_at}`}
                  layout="position"
                  layoutDependency={newestFirst}
                  transition={{ layout: reduceMotion ? { duration: 0 } : { duration: 0.25, ease: easeOut } }}
                  onClick={() => onOpenOpponent(game)}
                >
                  <motion.span className="avatar history-avatar" aria-hidden="true" layoutId={reduceMotion ? undefined : opponentSharedLayoutId(layoutIdentity, "avatar")} transition={{ layout: { duration: reduceMotion ? 0 : 0.25, ease: easeOut } }}>
                    <ProfileAvatarContent value={opponent?.avatar_value ?? null} defaultIconSize={22} />
                    <i className={won ? "history-badge history-badge-win" : "history-badge history-badge-loss"}>
                      {won ? <AppIcon name="crown" size={15} strokeWidth={2.5} /> : <AppIcon name="x" size={15} strokeWidth={3} />}
                    </i>
                  </motion.span>
                  <span className="history-copy">
                    <small className={won ? "history-result-win" : "history-result-loss"}>{won ? "Победа" : "Поражение"}</small>
                    <motion.strong layoutId={reduceMotion ? undefined : opponentSharedLayoutId(layoutIdentity, "name")} transition={{ layout: { duration: reduceMotion ? 0 : 0.25, ease: easeOut } }}>{game.opponent_name}</motion.strong>
                  </span>
                  <span className="history-result">
                    <motion.strong className={won ? "history-score result-win" : "history-score result-loss"} layoutId={reduceMotion ? undefined : opponentSharedLayoutId(layoutIdentity, "score")} transition={{ layout: { duration: reduceMotion ? 0 : 0.25, ease: easeOut } }}><ScorePair left={game.own_score} right={game.opponent_score} /></motion.strong>
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
