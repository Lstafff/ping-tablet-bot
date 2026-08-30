import * as m from "motion/react-m";
import { memo } from "react";

import type { Opponent, Profile } from "../../api/types";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { AppIcon } from "../../components/AppIcon";
import { MorphingHeading } from "../../components/PageHeader";
import { ProfileAvatarContent } from "../../components/ProfileAvatar";
import { ScorePair } from "../../components/ScoreDisplay";
import { easeOut, opponentSharedLayoutId } from "../../lib/motion";
import { gamesCount, opponentName, winRate } from "../../lib/player";
import "./home.css";

function winRateTone(rate: number): "win-rate-low" | "win-rate-medium" | "win-rate-high" {
  if (rate < 50) return "win-rate-low";
  if (rate > 60) return "win-rate-high";
  return "win-rate-medium";
}

export const HomeScreen = memo(function HomeScreen({ profile, opponents, morphLayoutIdentity, onOpenOpponent }: { profile: Profile; opponents: Opponent[]; morphLayoutIdentity?: string | number | null; onOpenOpponent(opponent: Opponent): void }) {
  const rate = winRate(profile.stats);
  return (
    <>
      <section className="home-summary family-balance">
        <div className="scoreline" aria-label={`Побед ${profile.stats.wins}, поражений ${profile.stats.losses}`}>
          <ScorePair
            left={<AnimatedNumber value={profile.stats.wins} animateOnMount />}
            right={<AnimatedNumber value={profile.stats.losses} animateOnMount />}
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
          {opponents.map((opponent) => {
            const participatesInMorph = morphLayoutIdentity === opponent.id;
            return <button
              className="opponent-card"
              type="button"
              key={opponent.id}
              onClick={() => onOpenOpponent(opponent)}
            >
              <m.span
                className="avatar"
                layoutId={participatesInMorph ? opponentSharedLayoutId(opponent.id, "avatar") : undefined}
                transition={{ layout: { duration: 0.25, ease: easeOut } }}
                aria-hidden="true"
              >
                <ProfileAvatarContent value={opponent.avatar_value ?? null} defaultIconSize={22} />
              </m.span>
              <span className="opponent-card-copy">
                <m.strong layoutId={participatesInMorph ? opponentSharedLayoutId(opponent.id, "name") : undefined} transition={{ layout: { duration: 0.25, ease: easeOut } }}>{opponentName(opponent)}</m.strong>
                <m.small layoutId={participatesInMorph && opponent.stats ? opponentSharedLayoutId(opponent.id, "score") : undefined} transition={{ layout: { duration: 0.25, ease: easeOut } }}>
                  {opponent.stats ? <ScorePair left={opponent.stats.wins} right={opponent.stats.losses} /> : "Счёт пока не добавлен"}
                </m.small>
              </span>
              <AppIcon className="card-arrow" name="chevron-right" aria-hidden="true" size={25} />
            </button>;
          })}
        </div>
      ) : (
        <section className="empty-state">
          <MorphingHeading as="h2">Добавь первого соперника</MorphingHeading>
          <p className="muted-copy">Отправь ему код вызова, чтобы начать вести общий счёт.</p>
        </section>
      )}
    </>
  );
});
