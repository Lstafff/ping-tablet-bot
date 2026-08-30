import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { memo, useMemo } from "react";

import type { HistoryGame, HistoryView, Opponent } from "../../api/types";
import { AppIcon } from "../../components/AppIcon";
import { MorphingHeading } from "../../components/PageHeader";
import { ProfileAvatarContent } from "../../components/ProfileAvatar";
import { ProgressiveLoadTrigger } from "../../components/ProgressiveLoadTrigger";
import { EloDeltaBadge, ScorePair } from "../../components/ScoreDisplay";
import { easeOut, opponentSharedLayoutId } from "../../lib/motion";
import { historyGameKey } from "../../lib/player";
import "./history.css";

const monthYearFormatter = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

function historyGroup(value: string, now: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Ранее";
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.floor((startToday.valueOf() - startDate.valueOf()) / 86400000);
  if (daysAgo === 0) return "Сегодня";

  const mondayOffset = (now.getDay() + 6) % 7;
  const startWeek = new Date(startToday);
  startWeek.setDate(startToday.getDate() - mondayOffset);
  if (startDate >= startWeek) return "На этой неделе";
  if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) return "В этом месяце";
  return monthYearFormatter.format(date);
}

function groupHistory(games: HistoryGame[]): Array<{ label: string; games: HistoryGame[] }> {
  const now = new Date();
  const groups = new Map<string, HistoryGame[]>();
  for (const game of games) {
    const label = historyGroup(game.played_at, now);
    const group = groups.get(label);
    if (group) group.push(game);
    else groups.set(label, [game]);
  }
  return [...groups].map(([label, groupedGames]) => ({ label, games: groupedGames }));
}

export const HistoryScreen = memo(function HistoryScreen({
  newestFirst,
  view,
  opponents,
  morphLayoutIdentity,
  loadingMore,
  loadError,
  onLoadMore,
  onOpenOpponent,
}: {
  newestFirst: boolean;
  view: HistoryView | null;
  opponents: Opponent[];
  morphLayoutIdentity?: string | number | null;
  loadingMore: boolean;
  loadError: string;
  onLoadMore(): void;
  onOpenOpponent(game: HistoryGame): void;
}) {
  const reduceMotion = useReducedMotion();
  const opponentById = useMemo(
    () => new Map(opponents.map((opponent) => [opponent.id, opponent])),
    [opponents],
  );
  const groups = useMemo(() => {
    const sortedGames = [...(view?.games ?? [])].sort((left, right) => {
      const delta = new Date(right.played_at).valueOf() - new Date(left.played_at).valueOf();
      return newestFirst ? delta : -delta;
    });
    return groupHistory(sortedGames);
  }, [newestFirst, view?.games]);
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
              const participatesInMorph = morphLayoutIdentity === layoutIdentity;
              const opponent = opponentById.get(game.opponent_id);
              return (
                <m.button
                  className="history-row"
                  type="button"
                  key={`${game.opponent_id}-${game.played_at}`}
                  layout="position"
                  layoutDependency={newestFirst}
                  transition={{ layout: reduceMotion ? { duration: 0 } : { duration: 0.25, ease: easeOut } }}
                  onClick={() => onOpenOpponent(game)}
                >
                  <m.span className="avatar history-avatar" aria-hidden="true" layoutId={reduceMotion || !participatesInMorph ? undefined : opponentSharedLayoutId(layoutIdentity, "avatar")} transition={{ layout: { duration: reduceMotion ? 0 : 0.25, ease: easeOut } }}>
                    <ProfileAvatarContent value={opponent?.avatar_value ?? null} defaultIconSize={22} />
                    <i className={won ? "history-badge history-badge-win" : "history-badge history-badge-loss"}>
                      {won ? <AppIcon name="crown" size={15} strokeWidth={2.5} /> : <AppIcon name="x" size={15} strokeWidth={3} />}
                    </i>
                  </m.span>
                  <span className="history-copy">
                    <small className={won ? "history-result-win" : "history-result-loss"}>{won ? "Победа" : "Поражение"}</small>
                    <m.strong layoutId={reduceMotion || !participatesInMorph ? undefined : opponentSharedLayoutId(layoutIdentity, "name")} transition={{ layout: { duration: reduceMotion ? 0 : 0.25, ease: easeOut } }}>{game.opponent_name}</m.strong>
                  </span>
                  <span className="history-result">
                    <m.strong className={won ? "history-score result-win" : "history-score result-loss"} layoutId={reduceMotion || !participatesInMorph ? undefined : opponentSharedLayoutId(layoutIdentity, "score")} transition={{ layout: { duration: reduceMotion ? 0 : 0.25, ease: easeOut } }}><ScorePair left={game.own_score} right={game.opponent_score} /></m.strong>
                    <EloDeltaBadge value={game.elo_change} />
                  </span>
                </m.button>
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
});
