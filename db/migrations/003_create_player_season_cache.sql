-- Pre-aggregated player season stats for fast dashboard/leaderboard queries.

CREATE TABLE IF NOT EXISTS app_player_season_stats (
  season TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT,
  team_id TEXT,
  team_abbrev TEXT,
  games INTEGER NOT NULL,
  ppg REAL NOT NULL,
  rpg REAL NOT NULL,
  apg REAL NOT NULL,
  fg_pct REAL,
  three_pct REAL,
  ft_pct REAL,
  ts_pct REAL,
  usage_pct REAL,
  pie REAL,
  net_rating REAL,
  offensive_rating REAL,
  defensive_rating REAL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (season, player_id)
);

CREATE INDEX IF NOT EXISTS idx_app_player_season_stats_season
  ON app_player_season_stats(season);

CREATE INDEX IF NOT EXISTS idx_app_player_season_stats_ppg
  ON app_player_season_stats(season, ppg DESC);

CREATE INDEX IF NOT EXISTS idx_app_player_season_stats_name
  ON app_player_season_stats(player_name);
