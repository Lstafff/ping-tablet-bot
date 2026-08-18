import { describe, expect, it } from "vitest";

import { calculateOpponentHeaderCollapseState } from "./collapsingHeader";

describe("calculateOpponentHeaderCollapseState", () => {
  it("preserves expanded, intermediate, compact, and reduced-motion states", () => {
    const expanded = calculateOpponentHeaderCollapseState(0, false);
    const intermediate = calculateOpponentHeaderCollapseState(84, false);
    const compact = calculateOpponentHeaderCollapseState(168, false);
    const reducedBeforeThreshold = calculateOpponentHeaderCollapseState(26, true);
    const reducedAfterThreshold = calculateOpponentHeaderCollapseState(27, true);

    expect(expanded).toMatchObject({ rawProgress: 0, progress: 0, remaining: 1, backdropOpacity: 0, titlePrimaryShare: 100, avatarOpacity: 1, avatarScale: 1, titleTranslateY: 126, titleScale: 1.45 });
    expect(intermediate).toMatchObject({ rawProgress: 0.5, progress: 0.5, remaining: 0.5, backdropOpacity: 0.75, titlePrimaryShare: 50, avatarOpacity: 0.5, avatarTranslateY: -42, titleTranslateY: 63, titleScale: 1.225, summaryTranslateY: -32 });
    expect(intermediate.avatarScale).toBeCloseTo(0.725);
    expect(compact).toMatchObject({ rawProgress: 1, progress: 1, remaining: 0, backdropOpacity: 1, titlePrimaryShare: 0, avatarOpacity: 0, avatarTranslateY: -84, avatarScale: 0.45, titleTranslateY: 0, titleScale: 1, summaryOpacity: 0, summaryTranslateY: -64 });
    expect(reducedBeforeThreshold.progress).toBe(0);
    expect(reducedAfterThreshold).toMatchObject({ progress: 1, avatarTranslateY: 0, avatarScale: 1, titleTranslateY: 0, titleScale: 1, summaryTranslateY: 0 });
  });
});
