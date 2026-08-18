const collapseDistance = 168;
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
  titleTranslateY: number;
  titleScale: number;
  summaryOpacity: number;
  summaryTranslateY: number;
};

export function calculateOpponentHeaderCollapseState(
  scrollY: number,
  reduceMotion: boolean,
): OpponentHeaderCollapseState {
  const rawProgress = Math.min(1, Math.max(0, scrollY / collapseDistance));
  const progress = reduceMotion ? (rawProgress >= reducedMotionThreshold ? 1 : 0) : rawProgress;
  const remaining = 1 - progress;
  return {
    rawProgress,
    progress,
    remaining,
    backdropOpacity: Math.min(1, rawProgress * 1.5),
    titlePrimaryShare: Math.round(100 * remaining),
    avatarOpacity: remaining,
    avatarTranslateY: reduceMotion ? 0 : -84 * progress,
    avatarScale: reduceMotion ? 1 : 0.45 + 0.55 * remaining,
    titleTranslateY: reduceMotion ? 0 : 126 * remaining,
    titleScale: reduceMotion ? 1 : 1 + 0.45 * remaining,
    summaryOpacity: remaining,
    summaryTranslateY: reduceMotion ? 0 : -64 * progress,
  };
}
