import { sqlite } from '../db/sqlite.js';

const LEADERBOARD_METRICS = {
  points: 'ppg',
  assists: 'apg',
  rebounds: 'rpg',
  threePointPct: 'three_pct',
  trueShooting: 'ts_pct',
  fgPct: 'fg_pct',
  threePct: 'three_pct',
  trueShootingPct: 'ts_pct',
  usagePct: 'usage_pct',
  pie: 'pie'
} as const;

export type LeaderboardMetric = keyof typeof LEADERBOARD_METRICS;

export const ALLOWED_LEADERBOARD_METRICS = Object.keys(LEADERBOARD_METRICS) as LeaderboardMetric[];

export function isLeaderboardMetric(value: string | undefined): value is LeaderboardMetric {
  if (!value) {
    return false;
  }
  return Object.hasOwn(LEADERBOARD_METRICS, value);
}

function toPersonId(playerId: string): number {
  const parsed = Number.parseInt(playerId, 10);
  return Number.isFinite(parsed) ? parsed : -1;
}

export function getLatestSeason(): string | null {
  const row = sqlite
    .prepare('SELECT season FROM v_games ORDER BY season DESC LIMIT 1')
    .get() as { season: string } | undefined;
  return row?.season ?? null;
}

function resolveSeason(season?: string): string {
  if (season && /^\d{4}-\d{2}$/.test(season)) {
    return season;
  }

  return getLatestSeason() ?? '2025-26';
}

interface LeaderboardQualification {
  minGames: number;
  minFgMade: number;
  minFgAttempts: number;
  minThreeMade: number;
  minThreeAttempts: number;
  minScoringAttempts: number;
}

function getLeaderboardQualification(season: string): LeaderboardQualification {
  const row = sqlite
    .prepare(
      `SELECT
         COALESCE(MAX(games), 0) AS max_games
       FROM app_player_season_stats
       WHERE season = ?`
    )
    .get(season) as { max_games: number } | undefined;

  const maxGames = Math.max(row?.max_games ?? 0, 1);

  return {
    minGames: Math.max(12, Math.floor(maxGames * 0.45)),
    minFgMade: Math.max(60, Math.floor(maxGames * 3.5)),
    minFgAttempts: Math.max(140, Math.floor(maxGames * 6.5)),
    minThreeMade: Math.max(35, Math.floor(maxGames * 1.0)),
    minThreeAttempts: Math.max(100, Math.floor(maxGames * 2.5)),
    minScoringAttempts: Math.max(170, Math.floor(maxGames * 8.5))
  };
}

export function getPlayers(search: string | undefined, limit: number, offset: number, season?: string) {
  const searchValue = search?.trim() ?? '';
  const seasonFilter = resolveSeason(season);
  const leadersMode = searchValue.length === 0 && offset === 0 && limit <= 10;

  const data = sqlite
    .prepare(
      `SELECT
         aps.player_id,
         aps.player_name AS full_name,
         aps.position,
         aps.team_id,
         aps.team_abbrev,
         aps.season AS last_season,
         aps.player_id AS playerId,
         aps.player_name AS name,
         aps.team_id AS teamId,
         aps.team_abbrev AS team,
         ROUND(COALESCE(aps.ppg, 0), 1) AS ppg,
         ROUND(COALESCE(aps.rpg, 0), 1) AS rpg,
         ROUND(COALESCE(aps.apg, 0), 1) AS apg
       FROM app_player_season_stats aps
       WHERE aps.season = ?
         AND (? = '' OR LOWER(aps.player_name) LIKE '%' || LOWER(?) || '%')
       ORDER BY
         CASE WHEN ? = 1 THEN aps.ppg END DESC,
         aps.player_name ASC
       LIMIT ? OFFSET ?`
    )
    .all(seasonFilter, searchValue, searchValue, leadersMode ? 1 : 0, limit, offset);

  const totalRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS total
       FROM app_player_season_stats aps
       WHERE aps.season = ?
         AND (? = '' OR LOWER(aps.player_name) LIKE '%' || LOWER(?) || '%')
       `
    )
    .get(seasonFilter, searchValue, searchValue) as { total: number };

  return {
    data,
    total: totalRow.total
  };
}

export function getPlayerById(playerId: string) {
  const personId = toPersonId(playerId);

  const player = sqlite
    .prepare(
      `SELECT
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
         pb.season AS last_season,
         pb.jerseyNum AS jersey_num,
         COALESCE(CAST(pb.player_id AS TEXT), CAST(pb.personId AS TEXT)) AS playerId,
         COALESCE(
           NULLIF(TRIM(COALESCE(pb.firstName, '') || ' ' || COALESCE(pb.familyName, '')), ''),
           NULLIF(pb.nameI, ''),
           'Unknown Player'
         ) AS name,
         CAST(pb.team_id AS TEXT) AS teamId,
         pb.teamTricode AS team
       FROM nba_stats_player_box_traditional pb
       WHERE pb.player_id = ?
          OR pb.personId = ?
       ORDER BY pb.season DESC, pb.gameId DESC
       LIMIT 1`
    )
    .get(playerId, personId) as
    | {
        player_id: string;
        full_name: string;
        first_name: string | null;
        last_name: string | null;
        position: string | null;
        team_id: string | null;
        team_abbrev: string | null;
        last_season: string | null;
        jersey_num: string | null;
      }
    | undefined;

  if (!player) {
    return null;
  }

  const season = resolveSeason(player.last_season ?? undefined);
  const canonicalPlayerId = player.player_id;

  const seasonAverages = sqlite
    .prepare(
      `SELECT
         ? AS season,
         COUNT(*) AS gp,
         ROUND(COALESCE(SUM(gl.points) * 1.0 / NULLIF(COUNT(*), 0), 0), 1) AS ppg,
         ROUND(COALESCE(SUM(gl.rebounds_total) * 1.0 / NULLIF(COUNT(*), 0), 0), 1) AS rpg,
         ROUND(COALESCE(SUM(gl.assists) * 1.0 / NULLIF(COUNT(*), 0), 0), 1) AS apg,
         ROUND(COALESCE(SUM(gl.fg_made) * 1.0 / NULLIF(SUM(gl.fg_attempted), 0), 0), 4) AS fgPct,
         ROUND(COALESCE(SUM(gl.fg3_made) * 1.0 / NULLIF(SUM(gl.fg3_attempted), 0), 0), 4) AS threePct,
         ROUND(COALESCE(SUM(gl.ft_made) * 1.0 / NULLIF(SUM(gl.ft_attempted), 0), 0), 4) AS ftPct
       FROM v_player_game_logs_played gl
       WHERE gl.player_id = ?
         AND gl.season = ?
         AND gl.season_type = 'regular'`
    )
    .get(season, canonicalPlayerId, season);

  const advancedMetrics = sqlite
    .prepare(
      `SELECT
         ROUND(COALESCE(AVG(gl.offensive_rating), 0), 2) AS offensiveRating,
         ROUND(COALESCE(AVG(gl.defensive_rating), 0), 2) AS defensiveRating,
         ROUND(COALESCE(AVG(gl.net_rating), 0), 2) AS netRating,
         ROUND(COALESCE(AVG(gl.true_shooting_pct), 0), 4) AS trueShootingPct,
         ROUND(COALESCE(AVG(gl.usage_pct), 0), 4) AS usagePct,
         ROUND(COALESCE(AVG(gl.effective_field_goal_pct), 0), 4) AS effectiveFgPct,
         ROUND(COALESCE(AVG(gl.assist_pct), 0), 4) AS assistPct,
         ROUND(COALESCE(AVG(gl.rebound_pct), 0), 4) AS reboundPct,
         ROUND(COALESCE(AVG(gl.pie), 0), 4) AS pie
       FROM v_player_game_logs_played gl
       WHERE gl.player_id = ?
         AND gl.season = ?
         AND gl.season_type = 'regular'`
    )
    .get(canonicalPlayerId, season);

  return {
    ...player,
    jerseyNum: player.jersey_num,
    seasonAverages,
    advancedMetrics,
    summary: {
      games: (seasonAverages as { gp?: number } | null)?.gp ?? 0,
      ppg: (seasonAverages as { ppg?: number } | null)?.ppg ?? 0,
      rpg: (seasonAverages as { rpg?: number } | null)?.rpg ?? 0,
      apg: (seasonAverages as { apg?: number } | null)?.apg ?? 0,
      tsp: (advancedMetrics as { trueShootingPct?: number } | null)?.trueShootingPct ?? 0
    }
  };
}

export type ShotScope = 'recent' | 'all';

interface PlayerGameQueryOptions {
  limit: number;
  offset: number;
  season?: string;
  includeDnp?: boolean;
}

interface PlayerShotsQueryOptions {
  season?: string;
  limit: number;
  offset: number;
  gameId?: string;
  scope?: ShotScope;
  recentGameWindow?: number;
}

function normalizeSeasonFilter(season?: string): string | null {
  return season && /^\d{4}-\d{2}$/.test(season) ? season : null;
}

function getRecentPlayedGameIds(playerId: string, seasonFilter: string | null, recentGameWindow: number): string[] {
  const seasonClause = seasonFilter ? 'AND season = ?' : '';
  const params = [playerId, ...(seasonFilter ? [seasonFilter] : []), recentGameWindow];

  const rows = sqlite
    .prepare(
      `SELECT game_id
       FROM v_player_game_logs_played
       WHERE player_id = ?
         ${seasonClause}
       ORDER BY COALESCE(game_date, '1900-01-01') DESC, game_id DESC
       LIMIT ?`
    )
    .all(...params) as Array<{ game_id: string }>;

  return rows.map((row) => row.game_id);
}

export function getPlayerGames(playerId: string, options: PlayerGameQueryOptions) {
  const seasonFilter = normalizeSeasonFilter(options.season);
  const seasonClause = seasonFilter ? 'AND gl.season = ?' : '';
  const viewName = options.includeDnp ? 'v_player_game_logs' : 'v_player_game_logs_played';
  const rowParams = [playerId, ...(seasonFilter ? [seasonFilter] : []), options.limit, options.offset];
  const totalParams = [playerId, ...(seasonFilter ? [seasonFilter] : [])];

  const rows = sqlite
    .prepare(
      `SELECT
         gl.game_id,
         gl.game_date,
         gl.season,
         gl.season_type,
         gl.team_abbrev,
         gl.opponent_team_abbrev,
         gl.game_result,
         gl.score,
         gl.minutes,
         gl.points,
         gl.rebounds_total,
         gl.assists,
         gl.steals,
         gl.blocks,
         gl.turnovers,
         gl.fg_made,
         gl.fg_attempted,
         gl.fg3_made,
         gl.fg3_attempted,
         gl.ft_made,
         gl.ft_attempted,
         gl.plus_minus,
         gl.true_shooting_pct,
         gl.net_rating,
         gl.game_id AS gameId,
         gl.game_date AS date,
         gl.opponent_team_abbrev AS opponent,
         gl.game_result AS result,
         gl.rebounds_total AS rebounds,
         gl.fg_made AS fgm,
         gl.fg_attempted AS fga,
         gl.fg3_made AS threePm,
         gl.fg3_attempted AS threePa,
         gl.ft_made AS ftm,
         gl.ft_attempted AS fta,
         gl.plus_minus AS plusMinus
       FROM ${viewName} gl
       WHERE gl.player_id = ?
         ${seasonClause}
       ORDER BY COALESCE(gl.game_date, '1900-01-01') DESC, gl.game_id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...rowParams);

  const totalRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS total
       FROM ${viewName} gl
       WHERE gl.player_id = ?
         ${seasonClause}`
    )
    .get(...totalParams) as { total: number };

  return {
    rows,
    total: totalRow.total
  };
}

export function getPlayerShots(playerId: string, options: PlayerShotsQueryOptions) {
  const seasonFilter = normalizeSeasonFilter(options.season);
  const gameIdFilter = options.gameId?.trim() ? options.gameId.trim() : null;
  const scope = options.scope ?? 'all';
  const recentGameWindow = Math.max(options.recentGameWindow ?? 5, 1);

  const whereClauses = ['s.player_id = ?'];
  const whereParams: Array<string | number> = [playerId];

  if (seasonFilter) {
    whereClauses.push('s.season = ?');
    whereParams.push(seasonFilter);
  }

  if (scope === 'recent') {
    const recentGameIds = getRecentPlayedGameIds(playerId, seasonFilter, recentGameWindow);
    const scopedGameIds = gameIdFilter ? recentGameIds.filter((value) => value === gameIdFilter) : recentGameIds;

    if (scopedGameIds.length === 0) {
      return {
        rows: [],
        total: 0
      };
    }

    whereClauses.push(`s.game_id IN (${scopedGameIds.map(() => '?').join(', ')})`);
    whereParams.push(...scopedGameIds);
  } else if (gameIdFilter) {
    whereClauses.push('s.game_id = ?');
    whereParams.push(gameIdFilter);
  }

  const whereSql = whereClauses.join('\n         AND ');
  const rowParams = [...whereParams, options.limit, options.offset];

  const rows = sqlite
    .prepare(
      `SELECT
         s.game_id,
         s.game_date,
         s.season,
         s.season_type,
         s.shot_id,
         s.period,
         s.minutes_remaining,
         s.seconds_remaining,
         s.event_type,
         s.action_type,
         s.shot_type,
         s.shot_zone_basic,
         s.shot_zone_area,
         s.shot_zone_range,
         s.shot_distance,
         s.loc_x,
         s.loc_y,
         s.shot_attempted_flag,
         s.shot_made_flag,
         s.game_id AS gameId,
         s.loc_x AS locX,
         s.loc_y AS locY,
         s.shot_distance AS shotDistance,
         s.shot_type AS shotType,
         s.shot_zone_basic AS shotZoneBasic,
         s.action_type AS actionType,
         CASE WHEN s.shot_made_flag = 1 THEN 1 ELSE 0 END AS made
       FROM v_shots s
       WHERE ${whereSql}
       ORDER BY COALESCE(s.game_date, '1900-01-01') DESC, s.game_id DESC, s.shot_id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...rowParams);

  const totalRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS total
       FROM v_shots s
       WHERE ${whereSql}`
    )
    .get(...whereParams) as { total: number };

  return {
    rows,
    total: totalRow.total
  };
}

export function getTeams() {
  return sqlite
    .prepare(
      `SELECT
         team_id,
         name,
         abbreviation,
         city,
         wins,
         losses,
         ortg,
         drtg,
         net_rtg,
         team_name,
         team_abbrev,
         team_city,
         off_rating,
         def_rating,
         net_rating,
         last_season,
         last_game_date,
         team_id AS teamId,
         name AS teamName,
         abbreviation AS teamAbbrev,
         city AS teamCity,
         off_rating AS offRating,
         def_rating AS defRating,
         net_rating AS netRating
       FROM v_teams
       ORDER BY abbreviation ASC`
    )
    .all();
}

export function getTeamById(teamId: string) {
  const team = sqlite
    .prepare(
      `SELECT
         team_id,
         name,
         abbreviation,
         city,
         wins,
         losses,
         ortg,
         drtg,
         net_rtg,
         team_name,
         team_abbrev,
         team_city,
         off_rating,
         def_rating,
         net_rating,
         season,
         last_season,
         last_game_date,
         team_id AS teamId,
         name AS teamName,
         abbreviation AS teamAbbrev,
         city AS teamCity,
         off_rating AS offRating,
         def_rating AS defRating,
         net_rating AS netRating
       FROM v_teams
       WHERE team_id = ?`
    )
    .get(teamId) as Record<string, unknown> | undefined;

  if (!team) {
    return null;
  }

  const season = typeof team.last_season === 'string' ? team.last_season : resolveSeason();

  const stats = sqlite
    .prepare(
      `SELECT
         ROUND(AVG(CASE
           WHEN g.home_team_id = ? THEN g.home_score
           ELSE g.away_score
         END), 2) AS ppg,
         ROUND(AVG(CASE
           WHEN g.home_team_id = ? THEN g.away_score
           ELSE g.home_score
         END), 2) AS oppPpg,
         ROUND(AVG(tba.offensiveRating), 2) AS offRating,
         ROUND(AVG(tba.defensiveRating), 2) AS defRating,
         ROUND(AVG(tba.pace), 2) AS pace,
         ROUND(AVG(tbt.fieldGoalsPercentage), 4) AS fgPct,
         ROUND(AVG(tbt.threePointersPercentage), 4) AS threePct,
         ROUND(AVG(tbt.freeThrowsPercentage), 4) AS ftPct
       FROM v_games g
       LEFT JOIN nba_stats_team_box_advanced tba
         ON tba.gameId = g.game_id
         AND CAST(tba.team_id AS TEXT) = ?
       LEFT JOIN nba_stats_team_box_traditional tbt
         ON tbt.gameId = g.game_id
         AND CAST(tbt.team_id AS TEXT) = ?
       WHERE (g.home_team_id = ? OR g.away_team_id = ?)
         AND g.season = ?
         AND g.season_type = 'regular'`
    )
    .get(teamId, teamId, teamId, teamId, teamId, teamId, season);

  const roster = sqlite
    .prepare(
      `WITH ranked AS (
         SELECT
           gl.player_id,
           gl.player_name,
           gl.position,
           gl.jersey_num,
           ROW_NUMBER() OVER (
             PARTITION BY gl.player_id
             ORDER BY COALESCE(gl.game_date, '1900-01-01') DESC, gl.game_id DESC
           ) AS rn
         FROM v_player_game_logs gl
         WHERE gl.team_id = ?
           AND gl.season = ?
       )
       SELECT
         player_id,
         player_name,
         position,
         jersey_num,
         player_id AS playerId,
         player_name AS name,
         jersey_num AS jerseyNum
       FROM ranked
       WHERE rn = 1
       ORDER BY player_name ASC`
    )
    .all(teamId, season);

  const recentGames = sqlite
    .prepare(
      `SELECT
         game_id,
         game_date,
         CASE
           WHEN home_team_id = ? THEN away_team
           ELSE home_team
         END AS opponent,
         CASE
           WHEN home_team_id = ? AND home_score > away_score THEN 'W'
           WHEN away_team_id = ? AND away_score > home_score THEN 'W'
           ELSE 'L'
         END AS result,
         CASE
           WHEN home_team_id = ? THEN CAST(home_score AS INTEGER) || '-' || CAST(away_score AS INTEGER)
           ELSE CAST(away_score AS INTEGER) || '-' || CAST(home_score AS INTEGER)
         END AS score,
         game_id AS gameId,
         game_date AS date
       FROM v_games
       WHERE (home_team_id = ? OR away_team_id = ?)
         AND season = ?
       ORDER BY COALESCE(game_date, '1900-01-01') DESC, game_id DESC
       LIMIT 10`
    )
    .all(teamId, teamId, teamId, teamId, teamId, teamId, season);

  return {
    ...team,
    season,
    record: {
      wins: (team.wins as number | undefined) ?? 0,
      losses: (team.losses as number | undefined) ?? 0
    },
    stats,
    roster,
    recent_games: recentGames,
    recentGames
  };
}

export function getLeaderboards(metric: LeaderboardMetric, season: string | undefined, limit: number) {
  const metricColumn = LEADERBOARD_METRICS[metric];
  const resolvedSeason = resolveSeason(season);
  const qualification = getLeaderboardQualification(resolvedSeason);

  const rows = sqlite
    .prepare(
      `WITH ordered AS (
         SELECT
           aps.player_id,
           aps.player_name,
           aps.team_abbrev,
           aps.games,
           CASE
             WHEN ? IN ('ppg', 'rpg', 'apg') THEN ROUND(COALESCE(aps.${metricColumn}, 0), 1)
             ELSE ROUND(COALESCE(aps.${metricColumn}, 0), 3)
           END AS value,
           ROW_NUMBER() OVER (ORDER BY COALESCE(aps.${metricColumn}, 0) DESC, aps.player_name ASC) AS rank
         FROM app_player_season_stats aps
         WHERE aps.season = ?
           AND aps.games >= ?
           AND (
             ? NOT IN ('fg_pct', 'three_pct', 'ts_pct', 'usage_pct', 'pie')
             OR (? = 'fg_pct' AND aps.fg_made_total >= ? AND aps.fg_attempts_total >= ?)
             OR (? = 'three_pct' AND aps.fg3_made_total >= ? AND aps.fg3_attempts_total >= ?)
             OR (? IN ('ts_pct', 'usage_pct', 'pie') AND (aps.fg_attempts_total + (0.44 * aps.ft_attempts_total)) >= ?)
           )
       )
       SELECT
         rank,
         player_id,
         player_name,
         team_abbrev,
         games,
         value,
         player_id AS playerId,
         player_name AS name,
         team_abbrev AS team,
         games AS gamesPlayed
       FROM ordered
       ORDER BY rank
       LIMIT ?`
    )
    .all(
      metricColumn,
      resolvedSeason,
      qualification.minGames,
      metricColumn,
      metricColumn,
      qualification.minFgMade,
      qualification.minFgAttempts,
      metricColumn,
      qualification.minThreeMade,
      qualification.minThreeAttempts,
      metricColumn,
      qualification.minScoringAttempts,
      limit
    );

  return {
    metric,
    season: resolvedSeason,
    rows
  };
}

function resolvePlayerIdentifier(input: string): { player_id: string; full_name: string } | null {
  const exact = sqlite
    .prepare(
      `SELECT player_id, player_name AS full_name
       FROM app_player_season_stats
       WHERE player_id = ?
       ORDER BY season DESC
       LIMIT 1`
    )
    .get(input) as { player_id: string; full_name: string } | undefined;

  if (exact) {
    return exact;
  }

  const byName = sqlite
    .prepare(
      `SELECT player_id, player_name AS full_name
       FROM app_player_season_stats
       WHERE LOWER(player_name) LIKE '%' || LOWER(?) || '%'
       ORDER BY season DESC, player_name ASC
       LIMIT 1`
    )
    .get(input) as { player_id: string; full_name: string } | undefined;

  return byName ?? null;
}

export function comparePlayers(identifiers: string[], season?: string) {
  const normalized = identifiers.map((value) => value.trim()).filter((value) => value.length > 0);
  const unique = Array.from(new Set(normalized));

  const resolvedPlayers = unique
    .map((value) => resolvePlayerIdentifier(value))
    .filter((value): value is { player_id: string; full_name: string } => value !== null);

  if (resolvedPlayers.length < 2) {
    return null;
  }

  const resolvedSeason = resolveSeason(season);
  const selected = resolvedPlayers.slice(0, Math.min(8, resolvedPlayers.length));
  const placeholders = selected.map(() => '?').join(', ');

  const rows = sqlite
    .prepare(
      `SELECT
         aps.player_id,
         aps.player_name,
         aps.team_abbrev,
         aps.position,
         aps.games,
         ROUND(COALESCE(aps.ppg, 0), 1) AS ppg,
         ROUND(COALESCE(aps.rpg, 0), 1) AS rpg,
         ROUND(COALESCE(aps.apg, 0), 1) AS apg,
         ROUND(aps.ts_pct / 100.0, 4) AS tsp,
         aps.net_rating,
         aps.player_id AS playerId,
         aps.player_name AS name,
         aps.team_abbrev AS team
       FROM app_player_season_stats aps
       WHERE aps.season = ?
         AND aps.player_id IN (${placeholders})
       ORDER BY ppg DESC`
    )
    .all(resolvedSeason, ...selected.map((player) => player.player_id)) as Array<Record<string, number | string | null>>;

  const players = rows.map((row) => ({
    playerId: String(row.playerId),
    name: String(row.name ?? ''),
    team: String(row.team ?? ''),
    position: String(row.position ?? ''),
    stats: {
      games: Number(row.games ?? 0),
      ppg: Number(row.ppg ?? 0),
      rpg: Number(row.rpg ?? 0),
      apg: Number(row.apg ?? 0),
      tsp: Number(row.tsp ?? 0),
      netRating: Number(row.net_rating ?? 0)
    }
  }));

  return {
    season: resolvedSeason,
    players: selected,
    rows,
    comparisonPlayers: players
  };
}
