import { describe, expect, it } from "vitest";

import { calculateOpponentHeaderCollapseState, opponentHeaderElementTransform } from "./collapsingHeader";

describe("calculateOpponentHeaderCollapseState", () => {
  it("preserves expanded, intermediate, compact, and reduced-motion states", () => {
    const expanded = calculateOpponentHeaderCollapseState(0, false);
    const intermediate = calculateOpponentHeaderCollapseState(84, false);
    const compact = calculateOpponentHeaderCollapseState(168, false);
    const reducedBeforeThreshold = calculateOpponentHeaderCollapseState(26, true);
    const reducedAfterThreshold = calculateOpponentHeaderCollapseState(27, true);

    expect(expanded).toMatchObject({ rawProgress: 0, progress: 0, remaining: 1, backdropOpacity: 0, scorePrimaryShare: 100 });
    expect(opponentHeaderElementTransform(expanded, 40, 66, 0.45)).toBe("translate3d(40px, 66px, 0) scale(1)");
    expect(intermediate).toMatchObject({ rawProgress: 0.5, progress: 0.5, remaining: 0.5, backdropOpacity: 0.75, scorePrimaryShare: 50 });
    expect(compact).toMatchObject({ rawProgress: 1, progress: 1, remaining: 0, backdropOpacity: 1, scorePrimaryShare: 0 });
    expect(opponentHeaderElementTransform(compact, 40, 66, 0.45)).toBe("translate3d(0px, 0px, 0) scale(0.44999999999999996)");
    expect(reducedBeforeThreshold.progress).toBe(0);
    expect(reducedAfterThreshold).toMatchObject({ progress: 1, summaryTranslateY: 0 });
  });
});
