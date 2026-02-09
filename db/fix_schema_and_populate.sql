-- 1. Fix ESPN Team Box Schema
DROP TABLE IF EXISTS espn_team_box;

CREATE TABLE espn_team_box (
  game_id TEXT,
  home_away TEXT,
  "Last Ten GamesMade" INTEGER,
  "Last Ten GamesAttempted" INTEGER
);

CREATE INDEX idx_espn_team_box_game ON espn_team_box(game_id);

-- 2. Populate Player Season Stats Cache
-- This table is critical for the Players page and Leaderboards.
-- We aggregate data from v_player_game_logs (regular season only).

DELETE FROM app_player_season_stats; -- clear existing content to be safe

INSERT INTO app_player_season_stats (
  season,
  player_id,
  player_name,
  position,
  team_id,
  team_abbrev,
  games,
  ppg,
  rpg,
  apg,
  fg_made_total,
  fg_attempts_total,
  fg3_made_total,
  fg3_attempts_total,
  ft_attempts_total,
  fg_pct,
  three_pct,
  ft_pct,
  ts_pct,
  usage_pct,
  pie,
  net_rating,
  offensive_rating,
  defensive_rating,
  updated_at
)
SELECT
  season,
  player_id,
  MAX(player_name) as player_name,
  MAX(position) as position,
  MAX(team_id) as team_id,
  MAX(team_abbrev) as team_abbrev,
  COUNT(*)::integer as games,
  ROUND(AVG(points)::numeric, 1) as ppg,
  ROUND(AVG(rebounds_total)::numeric, 1) as rpg,
  ROUND(AVG(assists)::numeric, 1) as apg,
  SUM(fg_made)::integer as fg_made_total,
  SUM(fg_attempted)::integer as fg_attempts_total,
  SUM(fg3_made)::integer as fg3_made_total,
  SUM(fg3_attempted)::integer as fg3_attempts_total,
  SUM(ft_attempted)::integer as ft_attempts_total,
  
  -- Percentages
  CASE WHEN SUM(fg_attempted) > 0 THEN ROUND((SUM(fg_made)::numeric / SUM(fg_attempted)), 4) ELSE 0 END as fg_pct,
  CASE WHEN SUM(fg3_attempted) > 0 THEN ROUND((SUM(fg3_made)::numeric / SUM(fg3_attempted)), 4) ELSE 0 END as three_pct,
  CASE WHEN SUM(ft_attempted) > 0 THEN ROUND((SUM(ft_made)::numeric / SUM(ft_attempted)), 4) ELSE 0 END as ft_pct,
  
  -- Advanced Metrics (averaging season averages)
  ROUND(AVG(true_shooting_pct)::numeric, 4) as ts_pct,
  ROUND(AVG(usage_pct)::numeric, 4) as usage_pct,
  ROUND(AVG(pie)::numeric, 4) as pie,
  ROUND(AVG(net_rating)::numeric, 2) as net_rating,
  ROUND(AVG(offensive_rating)::numeric, 2) as offensive_rating,
  ROUND(AVG(defensive_rating)::numeric, 2) as defensive_rating,
  
  CURRENT_TIMESTAMP as updated_at
FROM v_player_game_logs
WHERE season_type = 'regular'
GROUP BY season, player_id;
