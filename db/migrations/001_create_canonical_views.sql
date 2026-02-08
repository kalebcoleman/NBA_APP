-- Canonical read layer over raw NBA tables.
-- This normalizes naming so API code does not couple to mixed source schemas.

DROP VIEW IF EXISTS v_players;
CREATE VIEW v_players AS
WITH base AS (
  SELECT
    COALESCE(CAST(pb.player_id AS TEXT), CAST(pb.personId AS TEXT)) AS player_id,
    COALESCE(
      NULLIF(TRIM(COALESCE(pb.firstName, '') || ' ' || COALESCE(pb.familyName, '')), ''),
      NULLIF(pb.nameI, ''),
      'Unknown Player'
    ) AS full_name,
    pb.firstName AS first_name,
    pb.familyName AS last_name,
    pb.position AS position,
    CAST(pb.team_id AS TEXT) AS team_id,
    pb.teamTricode AS team_abbrev,
    pb.gameId AS game_id,
    g.game_date AS game_date,
    pb.season AS season,
    pb.season_type AS season_type
  FROM nba_stats_player_box_traditional pb
  LEFT JOIN nba_stats_games g ON g.game_id = pb.gameId
  WHERE COALESCE(pb.player_id, pb.personId) IS NOT NULL
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

DROP VIEW IF EXISTS v_teams;
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
    tb.teamName AS team_name,
    tb.teamTricode AS team_abbrev,
    tb.teamCity AS team_city,
    tb.season,
    g.game_date,
    tb.gameId,
    ROW_NUMBER() OVER (
      PARTITION BY tb.team_id
      ORDER BY COALESCE(g.game_date, '1900-01-01') DESC, tb.season DESC, tb.gameId DESC
    ) AS rn
  FROM nba_stats_team_box_traditional tb
  LEFT JOIN nba_stats_games g ON g.game_id = tb.gameId
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
    ROUND(AVG(tba.offensiveRating), 2) AS ortg,
    ROUND(AVG(tba.defensiveRating), 2) AS drtg,
    ROUND(AVG(tba.netRating), 2) AS net_rtg
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
WHERE ti.rn = 1;

DROP VIEW IF EXISTS v_games;
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

DROP VIEW IF EXISTS v_player_game_logs;
CREATE VIEW v_player_game_logs AS
SELECT
  pb.gameId AS game_id,
  g.game_date AS game_date,
  pb.season,
  pb.season_type,
  COALESCE(CAST(pb.player_id AS TEXT), CAST(pb.personId AS TEXT)) AS player_id,
  COALESCE(
    NULLIF(TRIM(COALESCE(pb.firstName, '') || ' ' || COALESCE(pb.familyName, '')), ''),
    NULLIF(pb.nameI, ''),
    'Unknown Player'
  ) AS player_name,
  pb.firstName AS first_name,
  pb.familyName AS last_name,
  pb.jerseyNum AS jersey_num,
  CAST(pb.team_id AS TEXT) AS team_id,
  pb.teamTricode AS team_abbrev,
  CASE
    WHEN pb.teamTricode = g.home_team THEN g.away_team
    WHEN pb.teamTricode = g.away_team THEN g.home_team
    ELSE NULL
  END AS opponent_team_abbrev,
  pb.position,
  pb.minutes,
  pb.fieldGoalsMade AS fg_made,
  pb.fieldGoalsAttempted AS fg_attempted,
  pb.threePointersMade AS fg3_made,
  pb.threePointersAttempted AS fg3_attempted,
  pb.freeThrowsMade AS ft_made,
  pb.freeThrowsAttempted AS ft_attempted,
  pb.reboundsOffensive AS rebounds_offensive,
  pb.reboundsDefensive AS rebounds_defensive,
  pb.reboundsTotal AS rebounds_total,
  pb.assists,
  pb.steals,
  pb.blocks,
  pb.turnovers,
  pb.foulsPersonal AS fouls_personal,
  pb.points,
  pb.plusMinusPoints AS plus_minus,
  g.home_team,
  g.away_team,
  g.home_score,
  g.away_score,
  CASE
    WHEN pb.teamTricode = g.home_team THEN CAST(g.home_score AS INTEGER)
    WHEN pb.teamTricode = g.away_team THEN CAST(g.away_score AS INTEGER)
    ELSE NULL
  END AS team_score,
  CASE
    WHEN pb.teamTricode = g.home_team THEN CAST(g.away_score AS INTEGER)
    WHEN pb.teamTricode = g.away_team THEN CAST(g.home_score AS INTEGER)
    ELSE NULL
  END AS opponent_score,
  CASE
    WHEN pb.teamTricode = g.home_team AND g.home_score > g.away_score THEN 'W'
    WHEN pb.teamTricode = g.away_team AND g.away_score > g.home_score THEN 'W'
    WHEN pb.teamTricode = g.home_team AND g.home_score < g.away_score THEN 'L'
    WHEN pb.teamTricode = g.away_team AND g.away_score < g.home_score THEN 'L'
    ELSE NULL
  END AS game_result,
  CASE
    WHEN pb.teamTricode = g.home_team THEN CAST(g.home_score AS INTEGER) || '-' || CAST(g.away_score AS INTEGER)
    WHEN pb.teamTricode = g.away_team THEN CAST(g.away_score AS INTEGER) || '-' || CAST(g.home_score AS INTEGER)
    ELSE NULL
  END AS score,
  pba.offensiveRating AS offensive_rating,
  pba.defensiveRating AS defensive_rating,
  pba.netRating AS net_rating,
  pba.trueShootingPercentage AS true_shooting_pct,
  pba.effectiveFieldGoalPercentage AS effective_field_goal_pct,
  pba.usagePercentage AS usage_pct,
  pba.assistPercentage AS assist_pct,
  pba.reboundPercentage AS rebound_pct,
  pba.pace,
  pba.PIE AS pie
FROM nba_stats_player_box_traditional pb
LEFT JOIN nba_stats_player_box_advanced pba
  ON pba.gameId = pb.gameId
  AND COALESCE(CAST(pba.player_id AS TEXT), CAST(pba.personId AS TEXT)) = COALESCE(CAST(pb.player_id AS TEXT), CAST(pb.personId AS TEXT))
LEFT JOIN nba_stats_games g ON g.game_id = pb.gameId;

DROP VIEW IF EXISTS v_shots;
CREATE VIEW v_shots AS
SELECT
  s.GAME_ID AS game_id,
  s.GAME_DATE AS game_date,
  s.season,
  s.season_type,
  CAST(s.PLAYER_ID AS TEXT) AS player_id,
  s.PLAYER_NAME AS player_name,
  CAST(s.TEAM_ID AS TEXT) AS team_id,
  s.TEAM_NAME AS team_name,
  s.PERIOD AS period,
  s.MINUTES_REMAINING AS minutes_remaining,
  s.SECONDS_REMAINING AS seconds_remaining,
  s.EVENT_TYPE AS event_type,
  s.ACTION_TYPE AS action_type,
  s.SHOT_TYPE AS shot_type,
  s.SHOT_ZONE_BASIC AS shot_zone_basic,
  s.SHOT_ZONE_AREA AS shot_zone_area,
  s.SHOT_ZONE_RANGE AS shot_zone_range,
  s.SHOT_DISTANCE AS shot_distance,
  s.LOC_X AS loc_x,
  s.LOC_Y AS loc_y,
  s.SHOT_ATTEMPTED_FLAG AS shot_attempted_flag,
  s.SHOT_MADE_FLAG AS shot_made_flag,
  s.shot_id
FROM nba_stats_shots s;
