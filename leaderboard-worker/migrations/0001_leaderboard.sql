CREATE TABLE IF NOT EXISTS leaderboard_scores (
  game_id TEXT NOT NULL,
  resident_id TEXT NOT NULL,
  resident_name TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (game_id, resident_id)
);

CREATE INDEX IF NOT EXISTS leaderboard_game_score
  ON leaderboard_scores (game_id, score, updated_at);

CREATE INDEX IF NOT EXISTS leaderboard_resident
  ON leaderboard_scores (resident_id, game_id);
