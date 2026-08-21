import { describe, expect, it } from "vitest";

import { calculateOpponentHeaderCollapseState, calculateOpponentHeaderSnapTarget } from "./collapsingHeader";

describe("calculateOpponentHeaderCollapseState", () => {
  it("preserves expanded, intermediate, compact, and reduced-motion states", () => {
    const expanded = calculateOpponentHeaderCollapseState(0, false);
    const intermediate = calculateOpponentHeaderCollapseState(84, false);
    const compact = calculateOpponentHeaderCollapseState(168, false);
    const reducedBeforeThreshold = calculateOpponentHeaderCollapseState(26, true);
    const reducedAfterThreshold = calculateOpponentHeaderCollapseState(27, true);

    expect(expanded).toMatchObject({ rawProgress: 0, progress: 0, remaining: 1, backdropOpacity: 0, avatarOpacity: 1, avatarTranslateY: 0, avatarScale: 1, nameTranslateY: 126, nameScale: 1.45, scoreTranslateY: 137, scoreScale: 1.45, scoreFontWeight: 550 });
    expect(intermediate).toMatchObject({ rawProgress: 0.5, progress: 0.5, remaining: 0.5, backdropOpacity: 0.75, avatarOpacity: 0.5, avatarTranslateY: -42, nameTranslateY: 63, scoreTranslateY: 68.5, scoreFontWeight: 475, summaryTranslateY: -50 });
    expect(intermediate.avatarScale).toBeCloseTo(0.725);
    expect(intermediate.nameScale).toBeCloseTo(1.225);
    expect(intermediate.scoreScale).toBeCloseTo(1.225);
    expect(compact).toMatchObject({ rawProgress: 1, progress: 1, remaining: 0, backdropOpacity: 1, avatarOpacity: 0, avatarTranslateY: -84, avatarScale: 0.45, nameTranslateY: 0, nameScale: 1, scoreTranslateY: 0, scoreScale: 1, scoreFontWeight: 400, summaryOpacity: 0, summaryTranslateY: -100 });
    expect(reducedBeforeThreshold.progress).toBe(0);
    expect(reducedAfterThreshold).toMatchObject({ progress: 1, avatarTranslateY: 0, avatarScale: 1, nameTranslateY: 0, nameScale: 1, scoreTranslateY: 0, scoreScale: 1, scoreFontWeight: 400, summaryTranslateY: 0 });
  });

  it("snaps an intentional partial collapse to the compact resting state", () => {
    expect(calculateOpponentHeaderSnapTarget(0)).toBeNull();
    expect(calculateOpponentHeaderSnapTarget(26)).toBe(0);
    expect(calculateOpponentHeaderSnapTarget(27)).toBe(168);
    expect(calculateOpponentHeaderSnapTarget(167)).toBe(168);
    expect(calculateOpponentHeaderSnapTarget(168)).toBeNull();
  });
});
