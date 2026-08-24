export const opponentHeaderCollapseDistance = 196;
const reducedMotionThreshold = 0.16;
const opponentHeaderSnapThreshold = opponentHeaderCollapseDistance * reducedMotionThreshold;

export type OpponentHeaderCollapseState = {
  rawProgress: number;
  progress: number;
  remaining: number;
  backdropOpacity: number;
  avatarTranslateY: number;
  avatarScale: number;
  nameTranslateY: number;
  nameScale: number;
  scoreTranslateY: number;
  scoreScale: number;
  scoreFontWeight: number;
  summaryOpacity: number;
  summaryTranslateY: number;
};

export function calculateOpponentHeaderCollapseState(
  scrollY: number,
  reduceMotion: boolean,
): OpponentHeaderCollapseState {
  const rawProgress = Math.min(1, Math.max(0, scrollY / opponentHeaderCollapseDistance));
  const progress = reduceMotion ? (rawProgress >= reducedMotionThreshold ? 1 : 0) : rawProgress;
  const remaining = 1 - progress;
  return {
    rawProgress,
    progress,
    remaining,
    backdropOpacity: Math.min(1, rawProgress * 1.5),
    avatarTranslateY: reduceMotion || progress === 0 ? 0 : -140 * progress,
    avatarScale: reduceMotion ? 1 : 0.45 + 0.55 * remaining,

    nameTranslateY: reduceMotion || progress === 0 ? 0 : -127 * progress,
    nameScale: reduceMotion ? 1 : 0.7142857 + 0.2857143 * remaining,

    scoreTranslateY: reduceMotion || progress === 0 ? 0 : -139 * progress,
    scoreScale: reduceMotion ? 1 : 0.3125 + 0.6875 * remaining,
    scoreFontWeight: Math.round(400 + 200 * remaining),

    summaryOpacity: remaining,
    summaryTranslateY: reduceMotion ? 0 : -80 * progress,
  };
}

export function calculateOpponentHeaderSnapTarget(scrollY: number): number | null {
  if (scrollY <= 0 || scrollY >= opponentHeaderCollapseDistance) return null;
  return scrollY >= opponentHeaderSnapThreshold ? opponentHeaderCollapseDistance : 0;
}
