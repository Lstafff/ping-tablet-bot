import { describe, expect, it } from "vitest";

import { calculateOpponentHeaderCollapseState } from "./collapsingHeader";

describe("calculateOpponentHeaderCollapseState", () => {
  it("preserves expanded, intermediate, compact, and reduced-motion states", () => {
    const expanded = calculateOpponentHeaderCollapseState(0, false);
    const intermediate = calculateOpponentHeaderCollapseState(84, false);
    const compact = calculateOpponentHeaderCollapseState(168, false);
    const reducedBeforeThreshold = calculateOpponentHeaderCollapseState(26, true);
    const reducedAfterThreshold = calculateOpponentHeaderCollapseState(27, true);

    expect(expanded).toMatchObject({ rawProgress: 0, progress: 0, remaining: 1, backdropOpacity: 0, titlePrimaryShare: 100, avatarOpacity: 1, avatarTranslateY: 66, avatarScale: 1, nameTranslateY: 142, nameScale: 1, scoreTranslateY: 160, scoreScale: 1, scoreFontWeight: 550 });
    expect(intermediate).toMatchObject({ rawProgress: 0.5, progress: 0.5, remaining: 0.5, backdropOpacity: 0.75, titlePrimaryShare: 50, avatarOpacity: 0.5, avatarTranslateY: 13, avatarScale: 0.675, nameTranslateY: 71, scoreTranslateY: 80, scoreFontWeight: 475, summaryTranslateY: -4 });
    expect(intermediate.nameScale).toBeCloseTo(0.857);
    expect(intermediate.scoreScale).toBeCloseTo(0.635);
    expect(compact).toMatchObject({ rawProgress: 1, progress: 1, remaining: 0, backdropOpacity: 1, titlePrimaryShare: 0, avatarOpacity: 0, avatarTranslateY: -40, avatarScale: 0.35, nameTranslateY: 0, nameScale: 0.714, scoreTranslateY: 0, scoreScale: 0.27, scoreFontWeight: 400, summaryOpacity: 0, summaryTranslateY: -8 });
    expect(reducedBeforeThreshold.progress).toBe(0);
    expect(reducedAfterThreshold).toMatchObject({ progress: 1, avatarTranslateY: 0, avatarScale: 1, nameTranslateY: 0, nameScale: 1, scoreTranslateY: 0, scoreScale: 1, scoreFontWeight: 400, summaryTranslateY: 0 });
  });
});
