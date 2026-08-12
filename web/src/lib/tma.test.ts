import { afterEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
  HapticFeedback: undefined,
  colorScheme: "light" as const,
  contentSafeAreaInset: {},
  expand: vi.fn(),
  initData: "signed-data",
  initDataUnsafe: {},
  isVersionAtLeast: vi.fn(() => true),
  offEvent: vi.fn(),
  onEvent: vi.fn(),
  ready: vi.fn(),
  requestFullscreen: vi.fn(),
  safeAreaInset: {},
  setHeaderColor: vi.fn(),
  themeParams: {},
  viewportHeight: 800,
  viewportStableHeight: 800,
}));

vi.mock("../../mini-app/lib/twa/webApp", () => ({ default: runtime }));
vi.mock("../../mini-app/lib/twa/env", () => ({ isTelegram: () => true }));

import { tma } from "./tma";

describe("tma.prepare", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("expands the Mini App without requesting fullscreen", () => {
    const cleanup = tma.prepare();

    expect(runtime.ready).toHaveBeenCalledOnce();
    expect(runtime.expand).toHaveBeenCalledOnce();
    expect(runtime.requestFullscreen).not.toHaveBeenCalled();
    expect(runtime.onEvent).not.toHaveBeenCalledWith("fullscreenChanged", expect.any(Function));

    cleanup();
    expect(runtime.offEvent).not.toHaveBeenCalledWith("fullscreenChanged", expect.any(Function));
  });
});
