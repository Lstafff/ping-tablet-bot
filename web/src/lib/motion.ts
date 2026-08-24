export const easeOut = [0.23, 1, 0.32, 1] as const;
export const easeInOut = [0.77, 0, 0.175, 1] as const;
export function opponentSharedLayoutId(identity: string | number, part: "avatar" | "name" | "score"): string {
  return `opponent-${identity}-${part}`;
}
