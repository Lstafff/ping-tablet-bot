DAILY_STATS_PAGE_SIZE = 14

SESSION_INVITE_CODE = "await_invite_code"
SESSION_RATING = "await_rating"
SESSION_SCORE = "await_score"
SESSION_EDIT_GAMES = "await_edit_games"
SESSION_EDIT_POINTS = "await_edit_points"

KNOWN_SESSION_MODES = frozenset(
    {
        SESSION_INVITE_CODE,
        SESSION_RATING,
        SESSION_SCORE,
        SESSION_EDIT_GAMES,
        SESSION_EDIT_POINTS,
    }
)
