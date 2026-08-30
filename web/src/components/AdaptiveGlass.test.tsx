import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdaptiveGlass, shouldUseAndroidGlassFallback } from "./AdaptiveGlass";

const { glassRender } = vi.hoisted(() => ({
  glassRender: vi.fn(({ children }: { children?: React.ReactNode }) => <div data-testid="full-glass">{children}</div>),
}));

vi.mock("@samasante/liquid-glass", () => ({
  Glass: glassRender,
}));

const originalUserAgent = window.navigator.userAgent;

function setUserAgent(value: string): void {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value });
}

afterEach(() => {
  setUserAgent(originalUserAgent);
  glassRender.mockClear();
});

describe("shouldUseAndroidGlassFallback", () => {
  it("uses the lightweight material on Android Chromium and WebView", () => {
    expect(
      shouldUseAndroidGlassFallback(
        "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/135.0 Mobile Safari/537.36",
      ),
    ).toBe(true);
    expect(
      shouldUseAndroidGlassFallback(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A) AppleWebKit/537.36 Version/4.0 Chrome/122.0 Mobile Safari/537.36 wv",
      ),
    ).toBe(true);
  });

  it("keeps the full material on iPhone and desktop", () => {
    expect(
      shouldUseAndroidGlassFallback(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      ),
    ).toBe(false);
    expect(
      shouldUseAndroidGlassFallback(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/135.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("does not mount the displacement material on Android", () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/135.0 Mobile Safari/537.36");

    const { container } = render(<AdaptiveGlass radius={30}>Меню</AdaptiveGlass>);

    expect(container.querySelector('[data-liquid-glass="android-fallback"]')).not.toBeNull();
    expect(screen.queryByTestId("full-glass")).toBeNull();
    expect(glassRender).not.toHaveBeenCalled();
  });

  it("keeps the full displacement material outside Android", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148");

    render(<AdaptiveGlass radius={30}>Меню</AdaptiveGlass>);

    expect(screen.getByTestId("full-glass")).toHaveTextContent("Меню");
    expect(glassRender).toHaveBeenCalledTimes(1);
  });
});
