import { fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { useEventCallback } from "./useEventCallback";

function Harness({ value, onCallback }: { value: number; onCallback(callback: () => number): void }) {
  const readLatest = useEventCallback(() => value);

  useLayoutEffect(() => {
    onCallback(readLatest);
  }, [onCallback, readLatest]);

  return <button type="button" onClick={() => readLatest()}>Проверить</button>;
}

describe("useEventCallback", () => {
  it("keeps its identity and reads the latest render", () => {
    const callbacks: Array<() => number> = [];
    const onCallback = vi.fn((callback: () => number) => callbacks.push(callback));
    const view = render(<Harness value={1} onCallback={onCallback} />);

    view.rerender(<Harness value={2} onCallback={onCallback} />);
    fireEvent.click(screen.getByRole("button", { name: "Проверить" }));

    expect(onCallback).toHaveBeenCalledTimes(1);
    expect(callbacks[0]()).toBe(2);
  });
});
