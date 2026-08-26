import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileAvatarContent, profileAvatarKind } from "./ProfileAvatar";

describe("ProfileAvatarContent", () => {
  it.each([
    [null, "default"],
    ["🏓", "emoji"],
    ["data:image/png;base64,AAAA", "image"],
  ] as const)("classifies %s as %s", (value, kind) => {
    expect(profileAvatarKind(value)).toBe(kind);
  });

  it("does not render the default icon together with an emoji", () => {
    const { container } = render(<ProfileAvatarContent value="🏓" />);

    expect(container.querySelector(".profile-avatar-emoji")).toHaveTextContent("🏓");
    expect(container.querySelector(".app-icon")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("uses the table-tennis emoji as the default avatar", () => {
    const { container } = render(<ProfileAvatarContent value={null} />);

    expect(container.querySelector(".profile-avatar-default-emoji")).toHaveTextContent("🏓");
    expect(container.querySelector(".app-icon")).not.toBeInTheDocument();
  });

  it("does not render the default icon together with an image", () => {
    const { container } = render(<ProfileAvatarContent value="data:image/png;base64,AAAA" />);

    expect(container.querySelector("img")).toBeInTheDocument();
    expect(container.querySelector(".app-icon")).not.toBeInTheDocument();
    expect(container.querySelector(".profile-avatar-emoji")).not.toBeInTheDocument();
  });
});
