-- Postgres Initialization Script
-- Run this to recreate Views and Indexes compatible with the PostgreSQL schema.
-- Assumes base tables (nba_stats_*) already exist and contain data.

-- ==============================================================================
-- 1. Canonical Views (Adapted for Postgres with Quoted Identifiers)
-- ==============================================================================

DROP VIEW IF EXISTS v_players CASCADE;
CREATE VIEW v_players AS
WITH base AS (
  SELECT
    COALESCE(CAST(pb.player_id AS TEXT), CAST(pb."personId" AS TEXT)) AS player_id,
    COALESCE(
      NULLIF(TRIM(COALESCE(pb."firstName", '') || ' ' || COALESCE(pb."familyName", '')), ''),
      NULLIF(pb."nameI", ''),
      'Unknown Player'
    ) AS full_name,
    pb."firstName" AS first_name,
    pb."familyName" AS last_name,
    pb.position AS position,
    CAST(pb.team_id AS TEXT) AS team_id,
    pb."teamTricode" AS team_abbrev,
    pb."gameId" AS game_id,
    g.game_date AS game_date,
    pb.season AS season,
    pb.season_type AS season_type
  FROM nba_stats_player_box_traditional pb
  LEFT JOIN nba_stats_games g ON g.game_id = pb."gameId"
  WHERE pb.player_id IS NOT NULL OR pb."personId" IS NOT NULL
),
ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY player_id
      ORDER BY COALESCE(game_date, '1900-01-01') DESC, season DESC, game_id DESC
    ) AS rn
  FROM base
)
SELECT
  player_id,
  full_name,
  first_name,
  last_name,
  position,
  team_id,
  team_abbrev,
  game_id AS last_game_id,
  game_date AS last_game_date,
  season AS last_season,
  season_type AS last_season_type
FROM ranked
WHERE rn = 1;

DROP VIEW IF EXISTS v_teams CASCADE;
CREATE VIEW v_teams AS
WITH latest_season AS (
  SELECT season
  FROM nba_stats_games
  WHERE season_type = 'regular'
  ORDER BY season DESC
  LIMIT 1
),
team_identity AS (
  SELECT
    CAST(tb.team_id AS TEXT) AS team_id,
    tb."teamName" AS team_name,
    tb."teamTricode" AS team_abbrev,
    tb."teamCity" AS team_city,
    tb.season,
    g.game_date,
    tb."gameId",
    ROW_NUMBER() OVER (
      PARTITION BY tb.team_id
      ORDER BY COALESCE(g.game_date, '1900-01-01') DESC, tb.season DESC, tb."gameId" DESC
    ) AS rn
  FROM nba_stats_team_box_traditional tb
  LEFT JOIN nba_stats_games g ON g.game_id = tb."gameId"
  WHERE tb.team_id IS NOT NULL
),
record_rows AS (
  SELECT
    CAST(g.home_team_id AS TEXT) AS team_id,
    CASE WHEN g.home_score > g.away_score THEN 1 ELSE 0 END AS win_flag,
    CASE WHEN g.home_score < g.away_score THEN 1 ELSE 0 END AS loss_flag
  FROM nba_stats_games g
  JOIN latest_season ls ON ls.season = g.season
  WHERE g.season_type = 'regular'

  UNION ALL

  SELECT
    CAST(g.away_team_id AS TEXT) AS team_id,
    CASE WHEN g.away_score > g.home_score THEN 1 ELSE 0 END AS win_flag,
    CASE WHEN g.away_score < g.home_score THEN 1 ELSE 0 END AS loss_flag
  FROM nba_stats_games g
  JOIN latest_season ls ON ls.season = g.season
  WHERE g.season_type = 'regular'
),
record_base AS (
  SELECT
    team_id,
    SUM(win_flag) AS wins,
    SUM(loss_flag) AS losses
  FROM record_rows
  GROUP BY team_id
),
ratings AS (
  SELECT
    CAST(tba.team_id AS TEXT) AS team_id,
    ROUND(AVG(tba."offensiveRating")::numeric, 2) AS ortg,
    ROUND(AVG(tba."defensiveRating")::numeric, 2) AS drtg,
    ROUND(AVG(tba."netRating")::numeric, 2) AS net_rtg
  FROM nba_stats_team_box_advanced tba
  JOIN latest_season ls ON ls.season = tba.season
  WHERE tba.season_type = 'regular'
  GROUP BY CAST(tba.team_id AS TEXT)
)
SELECT
  ti.team_id,
  ti.team_name AS name,
  ti.team_name,
  ti.team_abbrev AS abbreviation,
  ti.team_abbrev,
  ti.team_city AS city,
  ti.team_city,
  COALESCE(rb.wins, 0) AS wins,
  COALESCE(rb.losses, 0) AS losses,
  COALESCE(rt.ortg, 0) AS ortg,
  COALESCE(rt.drtg, 0) AS drtg,
  COALESCE(rt.net_rtg, 0) AS net_rtg,
  COALESCE(rt.ortg, 0) AS off_rating,
  COALESCE(rt.drtg, 0) AS def_rating,
  COALESCE(rt.net_rtg, 0) AS net_rating,
  (SELECT season FROM latest_season) AS season,
  ti.season AS last_season,
  ti.game_date AS last_game_date
FROM team_identity ti
LEFT JOIN record_base rb ON rb.team_id = ti.team_id
LEFT JOIN ratings rt ON rt.team_id = ti.team_id
WHERE ti.rn = 1 AND ti.team_id != '0';

DROP VIEW IF EXISTS v_games CASCADE;
CREATE VIEW v_games AS
SELECT
  g.game_id,
  g.game_date,
  g.season,
  g.season_type,
  g.home_team,
  g.away_team,
  CAST(g.home_team_id AS TEXT) AS home_team_id,
  CAST(g.away_team_id AS TEXT) AS away_team_id,
  g.home_score,
  g.away_score,
  g.home_margin,
  g.away_margin,
  g.winner,
  g.league,
  g.source
FROM nba_stats_games g;

DROP VIEW IF EXISTS v_player_game_logs CASCADE;
CREATE VIEW v_player_game_logs AS
SELECT
  pb."gameId" AS game_id,
  g.game_date AS game_date,
  pb.season,
  pb.season_type,
  COALESCE(CAST(pb.player_id AS TEXT), CAST(pb."personId" AS TEXT)) AS player_id,
  COALESCE(
    NULLIF(TRIM(COALESCE(pb."firstName", '') || ' ' || COALESCE(pb."familyName", '')), ''),
    NULLIF(pb."nameI", ''),
    'Unknown Player'
  ) AS player_name,
  pb."firstName" AS first_name,
  pb."familyName" AS last_name,
  pb."jerseyNum" AS jersey_num,
  CAST(pb.team_id AS TEXT) AS team_id,
  pb."teamTricode" AS team_abbrev,
  CASE
    WHEN pb."teamTricode" = g.home_team THEN g.away_team
    WHEN pb."teamTricode" = g.away_team THEN g.home_team
    ELSE NULL
  END AS opponent_team_abbrev,
  pb.position,
  pb.minutes,
  pb."fieldGoalsMade" AS fg_made,
  pb."fieldGoalsAttempted" AS fg_attempted,
  pb."threePointersMade" AS fg3_made,
  pb."threePointersAttempted" AS fg3_attempted,
  pb."freeThrowsMade" AS ft_made,
  pb."freeThrowsAttempted" AS ft_attempted,
  pb."reboundsOffensive" AS rebounds_offensive,
  pb."reboundsDefensive" AS rebounds_defensive,
  pb."reboundsTotal" AS rebounds_total,
  pb.assists,
  pb.steals,
  pb.blocks,
  pb.turnovers,
  pb."foulsPersonal" AS fouls_personal,
  pb.points,
  pb."plusMinusPoints" AS plus_minus,
  g.home_team,
  g.away_team,
  g.home_score,
  g.away_score,
  CASE
    WHEN pb."teamTricode" = g.home_team THEN CAST(g.home_score AS INTEGER)
    WHEN pb."teamTricode" = g.away_team THEN CAST(g.away_score AS INTEGER)
    ELSE NULL
  END AS team_score,
  CASE
    WHEN pb."teamTricode" = g.home_team THEN CAST(g.away_score AS INTEGER)
    WHEN pb."teamTricode" = g.away_team THEN CAST(g.home_score AS INTEGER)
    ELSE NULL
  END AS opponent_score,
  CASE
    WHEN pb."teamTricode" = g.home_team AND g.home_score > g.away_score THEN 'W'
    WHEN pb."teamTricode" = g.away_team AND g.away_score > g.home_score THEN 'W'
    WHEN pb."teamTricode" = g.home_team AND g.home_score < g.away_score THEN 'L'
    WHEN pb."teamTricode" = g.away_team AND g.away_score < g.home_score THEN 'L'
    ELSE NULL
  END AS game_result,
  CASE
    WHEN pb."teamTricode" = g.home_team THEN CAST(g.home_score AS INTEGER) || '-' || CAST(g.away_score AS INTEGER)
    WHEN pb."teamTricode" = g.away_team THEN CAST(g.away_score AS INTEGER) || '-' || CAST(g.home_score AS INTEGER)
    ELSE NULL
  END AS score,
  pba."offensiveRating" AS offensive_rating,
  pba."defensiveRating" AS defensive_rating,
  pba."netRating" AS net_rating,
  pba."trueShootingPercentage" AS true_shooting_pct,
  pba."effectiveFieldGoalPercentage" AS effective_field_goal_pct,
  pba."usagePercentage" AS usage_pct,
  pba."assistPercentage" AS assist_pct,
  pba."reboundPercentage" AS rebound_pct,
  pba.pace,
  pba."PIE" AS pie
FROM nba_stats_player_box_traditional pb
LEFT JOIN nba_stats_player_box_advanced pba
  ON pba."gameId" = pb."gameId"
  AND COALESCE(CAST(pba.player_id AS TEXT), CAST(pba."personId" AS TEXT)) = COALESCE(CAST(pb.player_id AS TEXT), CAST(pb."personId" AS TEXT))
LEFT JOIN nba_stats_games g ON g.game_id = pb."gameId";

DROP VIEW IF EXISTS v_shots CASCADE;
CREATE VIEW v_shots AS
SELECT
  s."GAME_ID" AS game_id,
  s."GAME_DATE" AS game_date,
  s.season,
  s.season_type,
  CAST(s."PLAYER_ID" AS TEXT) AS player_id,
  s."PLAYER_NAME" AS player_name,
  CAST(s."TEAM_ID" AS TEXT) AS team_id,
  s."TEAM_NAME" AS team_name,
  s."PERIOD" AS period,
  s."MINUTES_REMAINING" AS minutes_remaining,
  s."SECONDS_REMAINING" AS seconds_remaining,
  s."EVENT_TYPE" AS event_type,
  s."ACTION_TYPE" AS action_type,
  s."SHOT_TYPE" AS shot_type,
  s."SHOT_ZONE_BASIC" AS shot_zone_basic,
  s."SHOT_ZONE_AREA" AS shot_zone_area,
  s."SHOT_ZONE_RANGE" AS shot_zone_range,
  s."SHOT_DISTANCE" AS shot_distance,
  s."LOC_X" AS loc_x,
  s."LOC_Y" AS loc_y,
  s."SHOT_ATTEMPTED_FLAG" AS shot_attempted_flag,
  s."SHOT_MADE_FLAG" AS shot_made_flag,
  s.shot_id
FROM nba_stats_shots s;


-- ==============================================================================
-- 2. Indexes
-- ==============================================================================

-- Indexes skipped as they likely exist and cause errors on re-run
-- CREATE INDEX IF NOT EXISTS idx_player_box_trad_player_season_game
--   ON nba_stats_player_box_traditional(player_id, season, "gameId");

-- CREATE INDEX IF NOT EXISTS idx_player_box_trad_person_season_game
--   ON nba_stats_player_box_traditional("personId", season, "gameId");

-- CREATE INDEX IF NOT EXISTS idx_player_box_trad_team_season_game
--   ON nba_stats_player_box_traditional(team_id, season, "gameId");

-- CREATE INDEX IF NOT EXISTS idx_player_box_adv_player_season_game
--   ON nba_stats_player_box_advanced(player_id, season, "gameId");

-- CREATE INDEX IF NOT EXISTS idx_player_box_adv_person_season_game
--   ON nba_stats_player_box_advanced("personId", season, "gameId");

-- CREATE INDEX IF NOT EXISTS idx_team_box_trad_team_season_game
--   ON nba_stats_team_box_traditional(team_id, season, "gameId");

-- CREATE INDEX IF NOT EXISTS idx_team_box_adv_team_season_game
--   ON nba_stats_team_box_advanced(team_id, season, "gameId");

-- CREATE INDEX IF NOT EXISTS idx_team_box_adv_tricode_season_game
--   ON nba_stats_team_box_advanced("teamTricode", season, "gameId");

-- CREATE INDEX IF NOT EXISTS idx_shots_player_season_game
--   ON nba_stats_shots("PLAYER_ID", season, "GAME_ID");

-- CREATE INDEX IF NOT EXISTS idx_shots_player_game
--   ON nba_stats_shots("PLAYER_ID", "GAME_ID");

-- CREATE INDEX IF NOT EXISTS idx_shots_game_date
--   ON nba_stats_shots("GAME_DATE");

-- CREATE INDEX IF NOT EXISTS idx_games_game_id
--   ON nba_stats_games(game_id);

-- CREATE INDEX IF NOT EXISTS idx_games_season_type_date
--   ON nba_stats_games(season, season_type, game_date);

-- CREATE INDEX IF NOT EXISTS idx_games_home_team
--   ON nba_stats_games(home_team_id, season, game_date);

-- CREATE INDEX IF NOT EXISTS idx_games_away_team
--   ON nba_stats_games(away_team_id, season, game_date);


-- ==============================================================================
-- 3. Player Season Cache Table
-- ==============================================================================

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
  fg_made_total INTEGER NOT NULL DEFAULT 0,
  fg_attempts_total INTEGER NOT NULL DEFAULT 0,
  fg3_made_total INTEGER NOT NULL DEFAULT 0,
  fg3_attempts_total INTEGER NOT NULL DEFAULT 0,
  ft_attempts_total INTEGER NOT NULL DEFAULT 0,
  fg_pct REAL,
  three_pct REAL,
  ft_pct REAL,
  ts_pct REAL,
  usage_pct REAL,
  pie REAL,
  net_rating REAL,
  offensive_rating REAL,
  defensive_rating REAL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (season, player_id)
);

CREATE INDEX IF NOT EXISTS idx_app_player_season_stats_season
  ON app_player_season_stats(season);

CREATE INDEX IF NOT EXISTS idx_app_player_season_stats_ppg
  ON app_player_season_stats(season, ppg DESC);

CREATE INDEX IF NOT EXISTS idx_app_player_season_stats_name
  ON app_player_season_stats(player_name);


-- ==============================================================================
-- 4. Played Game Logs View (Using Postgres String Functions)
-- ==============================================================================

DROP VIEW IF EXISTS v_player_game_logs_played;
CREATE VIEW v_player_game_logs_played AS
SELECT *
FROM v_player_game_logs
WHERE (
  CASE
    WHEN TRIM(COALESCE(minutes, '')) = '' THEN 0
    WHEN POSITION(':' IN minutes) > 0 THEN
      COALESCE(CAST(SPLIT_PART(minutes, ':', 1) AS INTEGER), 0) * 60
      + COALESCE(CAST(SPLIT_PART(minutes, ':', 2) AS INTEGER), 0)
    ELSE
      CAST(COALESCE(minutes, '0') AS REAL) * 60
  END
) > 0
OR COALESCE(fg_attempted, 0) > 0
OR COALESCE(ft_attempted, 0) > 0
OR COALESCE(points, 0) > 0
OR COALESCE(rebounds_total, 0) > 0
OR COALESCE(assists, 0) > 0
OR COALESCE(steals, 0) > 0
OR COALESCE(blocks, 0) > 0
OR COALESCE(turnovers, 0) > 0;
