export type User = {
  telegram_id: number;
  first_name: string;
  username: string | null;
  created_at: string;
  rating: string | null;
  rating_is_fnt: boolean;
  display_name: string | null;
  avatar_value: string | null;
  elo_rating: number;
  elo_games: number;
};

export type Stats = {
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
};

export type ExtendedStats = {
  games: number;
  overtime_wins: number;
  overtime_losses: number;
  longest_own_score: number | null;
  longest_opponent_score: number | null;
  longest_points: number;
  win_streak: number;
  close_margin_games: number;
  most_common_score: string | null;
};

export type Opponent = {
  id: number;
  name: string;
  first_name: string | null;
  username: string | null;
  elo_rating: number | null;
  stats?: Stats;
};

export type Profile = {
  user: User;
  stats: Stats;
  extended_stats: ExtendedStats;
  player_level: string;
};

export type OpponentStats = {
  opponent_name: string;
  user_name: string;
  stats: Stats;
  extended_stats: ExtendedStats;
};

export type RecentGame = {
  played_at: string;
  own_score: number;
  opponent_score: number;
  game_id?: number | null;
  elo_change?: number | null;
};

export type GamesView = {
  games: RecentGame[];
  page: number;
  total_pages: number;
};

export type HistoryGame = RecentGame & {
  opponent_id: number;
  opponent_name: string;
};

export type HistoryView = {
  games: HistoryGame[];
  page: number;
  total_pages: number;
};

export type DailyStat = {
  played_on: string;
  wins: number;
  losses: number;
};

export type DailyView = {
  daily_stats: DailyStat[];
  page: number;
  total_pages: number;
};

export type ScoreResponse = {
  game_id: number;
  opponent_name: string;
  recent_games: RecentGame[];
  elo_rating: number | null;
  elo_change: number | null;
  opponent_elo_rating: number | null;
  profile: Profile;
  opponent_stats: OpponentStats;
};
