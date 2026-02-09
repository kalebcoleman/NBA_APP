-- Create missing ESPN source tables inferred from API usage.
-- These tables are expected to be populated by an external scraper/pipeline.

CREATE TABLE IF NOT EXISTS espn_games (
  game_id TEXT PRIMARY KEY,
  game_date TIMESTAMPTZ,
  status TEXT,
  season TEXT,
  season_type TEXT,
  home_team_id TEXT,
  home_team TEXT,
  away_team_id TEXT,
  away_team TEXT,
  home_record_total TEXT,
  away_record_total TEXT,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_espn_games_date ON espn_games(game_date);

CREATE TABLE IF NOT EXISTS espn_team_box (
  game_id TEXT,
  home_away TEXT,
  "Last Ten GamesMade" INTEGER,
  "Last Ten GamesAttempted" INTEGER
  -- Add other columns as needed by the scraper
);

CREATE INDEX IF NOT EXISTS idx_espn_team_box_game ON espn_team_box(game_id);
