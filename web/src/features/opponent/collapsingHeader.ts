const collapseDistance = 168;
const reducedMotionThreshold = 0.16;

export type OpponentHeaderCollapseState = {
  rawProgress: number;
  progress: number;
  remaining: number;
  backdropOpacity: number;
  scorePrimaryShare: number;
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
    scorePrimaryShare: Math.round(100 * remaining),
    summaryOpacity: remaining,
    summaryTranslateY: reduceMotion ? 0 : -8 * progress,
  };
}

export function opponentHeaderElementTransform(
  state: OpponentHeaderCollapseState,
  expandedX: number,
  expandedY: number,
  compactScale: number,
): string {
  const translateX = expandedX * state.remaining;
  const translateY = expandedY * state.remaining;
  const scale = 1 + (compactScale - 1) * state.progress;
  return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
}
