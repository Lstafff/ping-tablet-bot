import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnimatedNumber } from "./AnimatedNumber";

describe("AnimatedNumber", () => {
  it("keeps the first render still and animates a later value change", () => {
    const { container, rerender } = render(<AnimatedNumber value={12} />);

    expect(container.querySelector(".rolling-number")).not.toHaveClass("is-animating");
    expect(container.querySelector('[aria-label="12"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);

    rerender(<AnimatedNumber value={13} />);

    expect(container.querySelector(".rolling-number")).toHaveClass("is-animating");
    expect(container.querySelector('[aria-label="13"]')).toBeInTheDocument();
  });

  it("can animate the initial value when the screen reveal calls for it", () => {
    const { container } = render(<AnimatedNumber value="8:6" animateOnMount />);

    expect(container.querySelector(".rolling-number")).toHaveClass("is-animating");
  });
});
