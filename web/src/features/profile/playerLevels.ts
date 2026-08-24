import type { Profile } from "../../api/types";

export const playerLevels = [
  { name: "Новичок", detail: "До 649 elo", threshold: 0, emoji: "👶" },
  { name: "Любитель", detail: "От 650 elo", threshold: 650, emoji: "🏓" },
  { name: "Бывалый", detail: "От 850 elo", threshold: 850, emoji: "🤘" },
  { name: "Робот", detail: "От 1100 elo", threshold: 1100, emoji: "🦾" },
  { name: "Профик", detail: "От 1500 elo или рейтинг ФНТР", threshold: 1500, emoji: "💀" },
] as const;

export function levelIndexFor(profile: Profile): number {
  if (profile.user.rating_is_fnt) return playerLevels.length - 1;
  return playerLevels.reduce(
    (index, level, levelIndex) => profile.user.elo_rating >= level.threshold ? levelIndex : index,
    0,
  );
}
