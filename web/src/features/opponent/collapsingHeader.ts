export const opponentHeaderCollapseDistance = 168;
const reducedMotionThreshold = 0.16;

export type OpponentHeaderCollapseState = {
  rawProgress: number;
  progress: number;
  remaining: number;
  backdropOpacity: number;
  titlePrimaryShare: number;
  avatarOpacity: number;
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
    titlePrimaryShare: Math.round(100 * remaining),
    avatarOpacity: remaining,
    avatarTranslateY: reduceMotion ? 0 : 66 * remaining - 40 * progress,
    avatarScale: reduceMotion ? 1 : 0.35 + 0.65 * remaining,
    nameTranslateY: reduceMotion ? 0 : 142 * remaining,
    nameScale: reduceMotion ? 1 : 0.714 + 0.286 * remaining,
    scoreTranslateY: reduceMotion ? 0 : 160 * remaining,
    scoreScale: reduceMotion ? 1 : 0.27 + 0.73 * remaining,
    scoreFontWeight: Math.round(400 + 150 * remaining),
    summaryOpacity: remaining,
    summaryTranslateY: reduceMotion ? 0 : -8 * progress,
  };
}
