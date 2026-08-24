import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "./SegmentedControl";

const options = [
  { value: "summary", label: "Общая" },
  { value: "days", label: "По дням" },
  { value: "games", label: "По играм" },
] as const;

function TabsHarness() {
  const [value, setValue] = useState<(typeof options)[number]["value"]>("summary");
  return <SegmentedControl<(typeof options)[number]["value"]> ariaLabel="Статистика" idPrefix="stats" value={value} options={options} onChange={setValue} />;
}

function ChoiceHarness() {
  const [value, setValue] = useState<"own" | "opponent">("own");
  return (
    <SegmentedControl<"own" | "opponent">
      ariaLabel="Игрок"
      semantic="choice"
      value={value}
      options={[{ value: "own", label: "Ты" }, { value: "opponent", label: "Противник" }]}
      onChange={setValue}
    />
  );
}

describe("SegmentedControl", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("moves tab selection and focus with arrow keys", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    render(<TabsHarness />);
    const current = screen.getByRole("tab", { name: "Общая" });
    current.focus();

    fireEvent.keyDown(current, { key: "ArrowRight" });

    const next = screen.getByRole("tab", { name: "По дням" });
    expect(next).toHaveAttribute("aria-selected", "true");
    expect(next).toHaveAttribute("aria-controls", "stats-panel-days");
    expect(next).toHaveFocus();
  });

  it("exposes a two-way choice as a radio group", () => {
    render(<ChoiceHarness />);

    fireEvent.click(screen.getByRole("radio", { name: "Противник" }));

    expect(screen.getByRole("radio", { name: "Противник" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Ты" })).toHaveAttribute("aria-checked", "false");
  });
});
