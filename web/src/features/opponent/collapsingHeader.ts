export const opponentHeaderCollapseDistance = 260;
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
    avatarTranslateY: reduceMotion || progress === 0 ? 0 : -108 * progress,
    avatarScale: reduceMotion ? 1 : 0.42 + 0.58 * remaining,

    nameTranslateY: reduceMotion ? 0 : 132 * remaining,
    nameScale: reduceMotion ? 1 : 1 + 0.45 * remaining,

    scoreTranslateY: reduceMotion ? 0 : 143 * remaining,
    scoreScale: reduceMotion ? 1 : 1 + 0.45 * remaining,
    scoreFontWeight: Math.round(400 + 150 * remaining),

    summaryOpacity: remaining,
    summaryTranslateY: reduceMotion ? 0 : -100 * progress,
  };
}

export function calculateOpponentHeaderSnapTarget(scrollY: number): number | null {
  if (scrollY <= 0 || scrollY >= opponentHeaderCollapseDistance) return null;
  return scrollY >= opponentHeaderSnapThreshold ? opponentHeaderCollapseDistance : 0;
}
