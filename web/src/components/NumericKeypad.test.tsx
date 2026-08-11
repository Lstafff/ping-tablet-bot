import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NumericKeypad } from "./NumericKeypad";

describe("NumericKeypad", () => {
  it("sends digits and erase as explicit keypad actions", () => {
    const onDigit = vi.fn();
    const onErase = vi.fn();
    render(<NumericKeypad ariaLabel="Клавиатура" onDigit={onDigit} onErase={onErase} />);

    fireEvent.click(screen.getByRole("button", { name: "7" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить цифру" }));

    expect(onDigit).toHaveBeenCalledWith("7");
    expect(onErase).toHaveBeenCalledOnce();
  });
});
