import { describe, expect, it } from "vitest";

import { calculateOpponentHeaderCollapseState, calculateOpponentHeaderSnapTarget } from "./collapsingHeader";

describe("calculateOpponentHeaderCollapseState", () => {
  it("preserves expanded, intermediate, compact, and reduced-motion states", () => {
    const expanded = calculateOpponentHeaderCollapseState(0, false);
    const intermediate = calculateOpponentHeaderCollapseState(130, false);
    const compact = calculateOpponentHeaderCollapseState(260, false);
    const reducedBeforeThreshold = calculateOpponentHeaderCollapseState(41, true);
    const reducedAfterThreshold = calculateOpponentHeaderCollapseState(42, true);

    expect(expanded).toMatchObject({ rawProgress: 0, progress: 0, remaining: 1, backdropOpacity: 0, avatarTranslateY: 0, avatarScale: 1, nameTranslateY: 132, nameScale: 1.45, scoreTranslateY: 143, scoreScale: 1.45, scoreFontWeight: 550 });
    expect(intermediate).toMatchObject({ rawProgress: 0.5, progress: 0.5, remaining: 0.5, backdropOpacity: 0.75, avatarTranslateY: -54, nameTranslateY: 66, scoreTranslateY: 71.5, scoreFontWeight: 475, summaryTranslateY: -50 });
    expect(intermediate.avatarScale).toBeCloseTo(0.71);
    expect(intermediate.nameScale).toBeCloseTo(1.225);
    expect(intermediate.scoreScale).toBeCloseTo(1.225);
    expect(compact).toMatchObject({ rawProgress: 1, progress: 1, remaining: 0, backdropOpacity: 1, avatarTranslateY: -108, avatarScale: 0.42, nameTranslateY: 0, nameScale: 1, scoreTranslateY: 0, scoreScale: 1, scoreFontWeight: 400, summaryOpacity: 0, summaryTranslateY: -100 });
    expect(reducedBeforeThreshold.progress).toBe(0);
    expect(reducedAfterThreshold).toMatchObject({ progress: 1, avatarTranslateY: 0, avatarScale: 1, nameTranslateY: 0, nameScale: 1, scoreTranslateY: 0, scoreScale: 1, scoreFontWeight: 400, summaryTranslateY: 0 });
  });

  it("snaps an intentional partial collapse to the compact resting state", () => {
    expect(calculateOpponentHeaderSnapTarget(0)).toBeNull();
    expect(calculateOpponentHeaderSnapTarget(41)).toBe(0);
    expect(calculateOpponentHeaderSnapTarget(42)).toBe(260);
    expect(calculateOpponentHeaderSnapTarget(259)).toBe(260);
    expect(calculateOpponentHeaderSnapTarget(260)).toBeNull();
  });
});
