import { describe, expect, it } from "vitest";

import { calculateOpponentHeaderCollapseState, calculateOpponentHeaderSnapTarget } from "./collapsingHeader";

describe("calculateOpponentHeaderCollapseState", () => {
  it("preserves expanded, intermediate, compact, and reduced-motion states", () => {
    const expanded = calculateOpponentHeaderCollapseState(0, false);
    const intermediate = calculateOpponentHeaderCollapseState(98, false);
    const compact = calculateOpponentHeaderCollapseState(196, false);
    const reducedBeforeThreshold = calculateOpponentHeaderCollapseState(31, true);
    const reducedAfterThreshold = calculateOpponentHeaderCollapseState(32, true);

    expect(expanded).toMatchObject({ rawProgress: 0, progress: 0, remaining: 1, backdropOpacity: 0, avatarTranslateY: 0, avatarScale: 1, nameTranslateY: 0, nameScale: 1, scoreTranslateY: 0, scoreScale: 1, scoreFontWeight: 600 });
    expect(intermediate).toMatchObject({ rawProgress: 0.5, progress: 0.5, remaining: 0.5, backdropOpacity: 0.75, avatarTranslateY: -70, nameTranslateY: -70.5, scoreTranslateY: -77.5, scoreFontWeight: 500, summaryTranslateY: -98 });
    expect(intermediate.summaryOpacity).toBeCloseTo(0.2);
    expect(intermediate.avatarScale).toBeCloseTo(0.725);
    expect(intermediate.nameScale).toBeCloseTo(0.85714285);
    expect(intermediate.scoreScale).toBeCloseTo(0.65625);
    expect(compact).toMatchObject({ rawProgress: 1, progress: 1, remaining: 0, backdropOpacity: 1, avatarTranslateY: -140, avatarScale: 0.45, nameTranslateY: -141, nameScale: 0.7142857, scoreTranslateY: -155, scoreScale: 0.3125, scoreFontWeight: 400, summaryOpacity: 0, summaryTranslateY: -196 });
    expect(reducedBeforeThreshold.progress).toBe(0);
    expect(reducedAfterThreshold).toMatchObject({ progress: 1, avatarTranslateY: 0, avatarScale: 1, nameTranslateY: 0, nameScale: 1, scoreTranslateY: 0, scoreScale: 1, scoreFontWeight: 400, summaryTranslateY: 0 });
  });

  it("snaps an intentional partial collapse to the compact resting state", () => {
    expect(calculateOpponentHeaderSnapTarget(0)).toBeNull();
    expect(calculateOpponentHeaderSnapTarget(31)).toBe(0);
    expect(calculateOpponentHeaderSnapTarget(32)).toBe(196);
    expect(calculateOpponentHeaderSnapTarget(195)).toBe(196);
    expect(calculateOpponentHeaderSnapTarget(196)).toBeNull();
  });
});
