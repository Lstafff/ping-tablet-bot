import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HistoryView, Opponent } from "../../api/types";
import { HistoryScreen } from "./HistoryScreen";

const { avatarRender } = vi.hoisted(() => ({
  avatarRender: vi.fn(() => null),
}));

vi.mock("../../components/ProfileAvatar", () => ({
  ProfileAvatarContent: avatarRender,
}));

describe("HistoryScreen render isolation", () => {
  it("skips the long list when only its parent rerenders", () => {
    const view: HistoryView = {
      games: [
        {
          opponent_id: 7,
          opponent_name: "Мария",
          own_score: 11,
          opponent_score: 8,
          played_at: "2026-08-28T12:00:00Z",
        },
      ],
      page: 1,
      total_pages: 1,
    };
    const opponents: Opponent[] = [{
      id: 7,
      name: "Мария",
      first_name: "Мария",
      username: null,
      display_name: null,
      avatar_value: "🏓",
      elo_rating: null,
    }];
    const onLoadMore = vi.fn();
    const onOpenOpponent = vi.fn();
    const props = {
      view,
      opponents,
      loadingMore: false,
      loadError: "",
      onLoadMore,
      onOpenOpponent,
    };

    const screen = render(<HistoryScreen {...props} newestFirst />);
    expect(avatarRender).toHaveBeenCalledTimes(1);

    screen.rerender(<HistoryScreen {...props} newestFirst />);
    expect(avatarRender).toHaveBeenCalledTimes(1);

    screen.rerender(<HistoryScreen {...props} newestFirst={false} />);
    expect(avatarRender).toHaveBeenCalledTimes(2);
  });
});
