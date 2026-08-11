import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProgressiveLoadTrigger } from "./ProgressiveLoadTrigger";

let intersectionCallback: IntersectionObserverCallback | null = null;

class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
  unobserve() {}
  root = null;
  rootMargin = "320px 0px";
  thresholds = [0];
}

describe("ProgressiveLoadTrigger", () => {
  afterEach(() => {
    intersectionCallback = null;
    vi.unstubAllGlobals();
  });

  it("loads the next page before the user reaches the end", () => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    const onLoadMore = vi.fn();
    render(<ProgressiveLoadTrigger error="" hasMore loading={false} onLoadMore={onLoadMore} />);

    act(() => {
      intersectionCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("keeps a recoverable error next to the list", () => {
    const onLoadMore = vi.fn();
    render(<ProgressiveLoadTrigger error="Не удалось загрузить" hasMore loading={false} onLoadMore={onLoadMore} />);

    screen.getByRole("button", { name: "Повторить" }).click();

    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить");
    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
