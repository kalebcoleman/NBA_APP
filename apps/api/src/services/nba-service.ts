import { Prisma } from '@prisma/client';

import { prisma } from '../db/prisma.js';

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

function playedRowPredicate(alias: string): Prisma.Sql {
  // Postgres version of minutes parsing (MM:SS or M)
  return Prisma.sql`(
    (
      CASE
        WHEN TRIM(COALESCE(${Prisma.raw(alias)}.minutes, '')) = '' THEN 0
        WHEN POSITION(':' IN ${Prisma.raw(alias)}.minutes) > 0 THEN
          COALESCE(CAST(SPLIT_PART(${Prisma.raw(alias)}.minutes, ':', 1) AS INTEGER), 0) * 60
          + COALESCE(CAST(SPLIT_PART(${Prisma.raw(alias)}.minutes, ':', 2) AS INTEGER), 0)
        ELSE
          CAST(COALESCE(${Prisma.raw(alias)}.minutes, '0') AS REAL) * 60
      END
    ) > 0
    OR COALESCE(${Prisma.raw(alias)}."fieldGoalsAttempted", 0) > 0
    OR COALESCE(${Prisma.raw(alias)}."freeThrowsAttempted", 0) > 0
    OR COALESCE(${Prisma.raw(alias)}.points, 0) > 0
    OR COALESCE(${Prisma.raw(alias)}."reboundsTotal", 0) > 0
    OR COALESCE(${Prisma.raw(alias)}.assists, 0) > 0
    OR COALESCE(${Prisma.raw(alias)}.steals, 0) > 0
    OR COALESCE(${Prisma.raw(alias)}.blocks, 0) > 0
    OR COALESCE(${Prisma.raw(alias)}.turnovers, 0) > 0
  )`;
}

export async function getLatestSeason(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ season: string }[]>`
    SELECT season FROM v_games ORDER BY season DESC LIMIT 1
  `;
  return rows[0]?.season ?? null;
}

async function resolveSeason(season?: string): Promise<string> {
  if (season && /^\d{4}-\d{2}$/.test(season)) {
    return season;
  }

  return (await getLatestSeason()) ?? '2025-26';
}

interface LeaderboardQualification {
  minGames: number;
  minFgMade: number;
  minFgAttempts: number;
  minThreeMade: number;
  minThreeAttempts: number;
  minScoringAttempts: number;
}

async function getLeaderboardQualification(season: string): Promise<LeaderboardQualification> {
  const rows = await prisma.$queryRaw<{ max_games: number }[]>`
    SELECT
      COALESCE(MAX(games), 0) AS max_games
    FROM app_player_season_stats
    WHERE season = ${season}
  `;

  const maxGames = Math.max(rows[0]?.max_games ?? 0, 1);

  return {
    minGames: Math.max(12, Math.floor(maxGames * 0.45)),
    minFgMade: Math.max(60, Math.floor(maxGames * 3.5)),
    minFgAttempts: Math.max(140, Math.floor(maxGames * 6.5)),
    minThreeMade: Math.max(35, Math.floor(maxGames * 1.0)),
    minThreeAttempts: Math.max(100, Math.floor(maxGames * 2.5)),
    minScoringAttempts: Math.max(170, Math.floor(maxGames * 8.5))
  };
}

export async function getPlayers(search: string | undefined, limit: number, offset: number, season?: string) {
  const searchValue = search?.trim() ?? '';
  const seasonFilter = await resolveSeason(season);
  const leadersMode = searchValue.length === 0 && offset === 0 && limit <= 10;

  // Use ILIKE for case-insensitive search in Postgres
  const data = await prisma.$queryRaw<any[]>`
    SELECT
      aps.player_id,
      aps.player_name AS full_name,
      aps.position,
      aps.team_id,
      aps.team_abbrev,
      aps.season AS last_season,
      aps.player_id AS "playerId",
      aps.player_name AS name,
      aps.team_id AS "teamId",
      aps.team_abbrev AS team,
      ROUND(COALESCE(aps.ppg, 0)::numeric, 1)::float AS ppg,
      ROUND(COALESCE(aps.rpg, 0)::numeric, 1)::float AS rpg,
      ROUND(COALESCE(aps.apg, 0)::numeric, 1)::float AS apg
    FROM app_player_season_stats aps
    WHERE aps.season = ${seasonFilter}
      AND (${searchValue} = '' OR aps.player_name ILIKE '%' || ${searchValue} || '%')
    ORDER BY
      CASE WHEN ${leadersMode} THEN aps.ppg END DESC,
      aps.player_name ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const totalRows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::integer AS total
    FROM app_player_season_stats aps
    WHERE aps.season = ${seasonFilter}
      AND (${searchValue} = '' OR aps.player_name ILIKE '%' || ${searchValue} || '%')
  `;

  return {
    data,
    total: Number(totalRows[0]?.total ?? 0)
  };
}

export async function getPlayerById(playerId: string) {
  const personId = toPersonId(playerId);

  const playerRows = await prisma.$queryRaw<any[]>`
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
      pb.season AS last_season,
      pb."jerseyNum" AS jersey_num,
      COALESCE(CAST(pb.player_id AS TEXT), CAST(pb."personId" AS TEXT)) AS "playerId",
      COALESCE(
        NULLIF(TRIM(COALESCE(pb."firstName", '') || ' ' || COALESCE(pb."familyName", '')), ''),
        NULLIF(pb."nameI", ''),
        'Unknown Player'
      ) AS name,
      CAST(pb.team_id AS TEXT) AS "teamId",
      pb."teamTricode" AS team
    FROM nba_stats_player_box_traditional pb
    WHERE pb.player_id = ${playerId}
       OR pb."personId" = ${personId}
    ORDER BY pb.season DESC, pb."gameId" DESC
    LIMIT 1
  `;

  const player = playerRows[0] as {
    player_id: string;
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    team_id: string | null;
    team_abbrev: string | null;
    last_season: string | null;
    jersey_num: string | null;
    playerId: string;
    name: string;
    teamId: string;
    team: string;
    jerseyNum: string | null;
  } | undefined;

  if (!player) {
    return null;
  }

  const season = await resolveSeason(player.last_season ?? undefined);
  const canonicalPlayerId = player.player_id;
  const canonicalPersonId = toPersonId(canonicalPlayerId);
  const playedPred = playedRowPredicate('pb');

  const seasonAveragesRows = await prisma.$queryRaw<any[]>`
    SELECT
      ${season} AS season,
      COUNT(*)::integer AS gp,
      ROUND((COALESCE(SUM(pb.points) * 1.0 / NULLIF(COUNT(*), 0), 0))::numeric, 1)::float AS ppg,
      ROUND((COALESCE(SUM(pb."reboundsTotal") * 1.0 / NULLIF(COUNT(*), 0), 0))::numeric, 1)::float AS rpg,
      ROUND((COALESCE(SUM(pb.assists) * 1.0 / NULLIF(COUNT(*), 0), 0))::numeric, 1)::float AS apg,
      ROUND((COALESCE(SUM(pb."fieldGoalsMade") * 1.0 / NULLIF(SUM(pb."fieldGoalsAttempted"), 0), 0))::numeric, 4)::float AS "fgPct",
      ROUND((COALESCE(SUM(pb."threePointersMade") * 1.0 / NULLIF(SUM(pb."threePointersAttempted"), 0), 0))::numeric, 4)::float AS "threePct",
      ROUND((COALESCE(SUM(pb."freeThrowsMade") * 1.0 / NULLIF(SUM(pb."freeThrowsAttempted"), 0), 0))::numeric, 4)::float AS "ftPct"
    FROM nba_stats_player_box_traditional pb
    WHERE (pb.player_id = ${canonicalPlayerId} OR pb."personId" = ${canonicalPersonId})
      AND pb.season = ${season}
      AND pb.season_type = 'regular'
      AND ${playedPred}
  `;
  const seasonAverages = seasonAveragesRows[0];

  const advancedMetricsRows = await prisma.$queryRaw<any[]>`
    SELECT
      ROUND(COALESCE(AVG(pba."offensiveRating"), 0)::numeric, 2)::float AS "offensiveRating",
      ROUND(COALESCE(AVG(pba."defensiveRating"), 0)::numeric, 2)::float AS "defensiveRating",
      ROUND(COALESCE(AVG(pba."netRating"), 0)::numeric, 2)::float AS "netRating",
      ROUND(COALESCE(AVG(pba."trueShootingPercentage"), 0)::numeric, 4)::float AS "trueShootingPct",
      ROUND(COALESCE(AVG(pba."usagePercentage"), 0)::numeric, 4)::float AS "usagePct",
      ROUND(COALESCE(AVG(pba."effectiveFieldGoalPercentage"), 0)::numeric, 4)::float AS "effectiveFgPct",
      ROUND(COALESCE(AVG(pba."assistPercentage"), 0)::numeric, 4)::float AS "assistPct",
      ROUND(COALESCE(AVG(pba."reboundPercentage"), 0)::numeric, 4)::float AS "reboundPct",
      ROUND(COALESCE(AVG(pba."PIE"), 0)::numeric, 4)::float AS pie
    FROM nba_stats_player_box_traditional pb
    LEFT JOIN nba_stats_player_box_advanced pba
      ON pba."gameId" = pb."gameId"
      AND pba.season = pb.season
      AND (
        (pb.player_id IS NOT NULL AND pba.player_id = pb.player_id)
        OR (pb."personId" IS NOT NULL AND pba."personId" = pb."personId")
      )
    WHERE (pb.player_id = ${canonicalPlayerId} OR pb."personId" = ${canonicalPersonId})
      AND pb.season = ${season}
      AND pb.season_type = 'regular'
      AND ${playedPred}
  `;
  const advancedMetrics = advancedMetricsRows[0];

  return {
    ...player,
    jerseyNum: player.jersey_num,
    seasonAverages,
    advancedMetrics,
    summary: {
      games: Number(seasonAverages?.gp ?? 0),
      ppg: Number(seasonAverages?.ppg ?? 0),
      rpg: Number(seasonAverages?.rpg ?? 0),
      apg: Number(seasonAverages?.apg ?? 0),
      tsp: Number(advancedMetrics?.trueShootingPct ?? 0)
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

async function getRecentPlayedGameIds(playerId: string, seasonFilter: string | null, recentGameWindow: number): Promise<string[]> {
  const query = Prisma.sql`
    SELECT game_id
    FROM v_player_game_logs_played
    WHERE player_id = ${playerId}
      ${seasonFilter ? Prisma.sql`AND season = ${seasonFilter}` : Prisma.empty}
    ORDER BY COALESCE(game_date, '1900-01-01') DESC, game_id DESC
    LIMIT ${recentGameWindow}
  `;

  const rows = await prisma.$queryRaw<{ game_id: string }[]>(query);
  return rows.map((row) => row.game_id);
}

export async function getPlayerGames(playerId: string, options: PlayerGameQueryOptions) {
  const personId = toPersonId(playerId);
  const seasonFilter = normalizeSeasonFilter(options.season);
  const playedClause = options.includeDnp ? Prisma.empty : Prisma.sql`AND ${playedRowPredicate('pb')}`;

  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      pb."gameId" AS game_id,
      g.game_date AS game_date,
      pb.season,
      pb.season_type,
      pb."teamTricode" AS team_abbrev,
      CASE
        WHEN pb."teamTricode" = g.home_team THEN g.away_team
        WHEN pb."teamTricode" = g.away_team THEN g.home_team
        ELSE NULL
      END AS opponent_team_abbrev,
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
      pb.minutes,
      pb.points,
      pb."reboundsTotal" AS rebounds_total,
      pb.assists,
      pb.steals,
      pb.blocks,
      pb.turnovers,
      pb."fieldGoalsMade" AS fg_made,
      pb."fieldGoalsAttempted" AS fg_attempted,
      pb."threePointersMade" AS fg3_made,
      pb."threePointersAttempted" AS fg3_attempted,
      pb."freeThrowsMade" AS ft_made,
      pb."freeThrowsAttempted" AS ft_attempted,
      pb."plusMinusPoints" AS plus_minus,
      pba."trueShootingPercentage" AS true_shooting_pct,
      pba."netRating" AS net_rating,
      pb."gameId" AS "gameId",
      g.game_date AS date,
      CASE
        WHEN pb."teamTricode" = g.home_team THEN g.away_team
        WHEN pb."teamTricode" = g.away_team THEN g.home_team
        ELSE NULL
      END AS opponent,
      CASE
        WHEN pb."teamTricode" = g.home_team AND g.home_score > g.away_score THEN 'W'
        WHEN pb."teamTricode" = g.away_team AND g.away_score > g.home_score THEN 'W'
        WHEN pb."teamTricode" = g.home_team AND g.home_score < g.away_score THEN 'L'
        WHEN pb."teamTricode" = g.away_team AND g.away_score < g.home_score THEN 'L'
        ELSE NULL
      END AS result,
      pb."reboundsTotal" AS rebounds,
      pb."fieldGoalsMade" AS fgm,
      pb."fieldGoalsAttempted" AS fga,
      pb."threePointersMade" AS "threePm",
      pb."threePointersAttempted" AS "threePa",
      pb."freeThrowsMade" AS ftm,
      pb."freeThrowsAttempted" AS fta,
      pb."plusMinusPoints" AS "plusMinus"
    FROM nba_stats_player_box_traditional pb
    LEFT JOIN nba_stats_player_box_advanced pba
      ON pba."gameId" = pb."gameId"
      AND pba.season = pb.season
      AND (
        (pb.player_id IS NOT NULL AND pba.player_id = pb.player_id)
        OR (pb."personId" IS NOT NULL AND pba."personId" = pb."personId")
      )
    LEFT JOIN nba_stats_games g ON g.game_id = pb."gameId"
    WHERE (pb.player_id = ${playerId} OR pb."personId" = ${personId})
      ${seasonFilter ? Prisma.sql`AND pb.season = ${seasonFilter}` : Prisma.empty}
      ${playedClause}
    ORDER BY COALESCE(g.game_date, '1900-01-01') DESC, pb."gameId" DESC
    LIMIT ${options.limit} OFFSET ${options.offset}
  `;

  const totalRow = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::integer AS total
    FROM nba_stats_player_box_traditional pb
    WHERE (pb.player_id = ${playerId} OR pb."personId" = ${personId})
      ${seasonFilter ? Prisma.sql`AND pb.season = ${seasonFilter}` : Prisma.empty}
      ${playedClause}
  `;

  return {
    rows,
    total: Number(totalRow[0]?.total ?? 0)
  };
}

export async function getPlayerShots(playerId: string, options: PlayerShotsQueryOptions) {
  const seasonFilter = normalizeSeasonFilter(options.season);
  const gameIdFilter = options.gameId?.trim() ? options.gameId.trim() : null;
  const scope = options.scope ?? 'all';
  const recentGameWindow = Math.max(options.recentGameWindow ?? 5, 1);

  const whereParts: Prisma.Sql[] = [Prisma.sql`s.player_id = ${playerId}`];

  if (seasonFilter) {
    whereParts.push(Prisma.sql`s.season = ${seasonFilter}`);
  }

  if (scope === 'recent') {
    const recentGameIds = await getRecentPlayedGameIds(playerId, seasonFilter, recentGameWindow);
    const scopedGameIds = gameIdFilter ? recentGameIds.filter((value) => value === gameIdFilter) : recentGameIds;

    if (scopedGameIds.length === 0) {
      return {
        rows: [],
        total: 0
      };
    }

    whereParts.push(Prisma.sql`s.game_id IN (${Prisma.join(scopedGameIds)})`);
  } else if (gameIdFilter) {
    whereParts.push(Prisma.sql`s.game_id = ${gameIdFilter}`);
  }

  // Helper to join Where parts with AND
  const whereSql = whereParts.length > 0
    ? Prisma.join(whereParts, ' AND ')
    : Prisma.sql`1=1`;

  const rows = await prisma.$queryRaw<any[]>`
    SELECT
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
      s.game_id AS "gameId",
      s.loc_x AS "locX",
      s.loc_y AS "locY",
      s.shot_distance AS "shotDistance",
      s.shot_type AS "shotType",
      s.shot_zone_basic AS "shotZoneBasic",
      s.action_type AS "actionType",
      CASE WHEN s.shot_made_flag = 1 THEN 1 ELSE 0 END AS made
    FROM v_shots s
    WHERE ${whereSql}
    ORDER BY COALESCE(s.game_date, '1900-01-01') DESC, s.game_id DESC, s.shot_id DESC
    LIMIT ${options.limit} OFFSET ${options.offset}
  `;

  const totalRow = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::integer AS total
    FROM v_shots s
    WHERE ${whereSql}
  `;

  return {
    rows,
    total: Number(totalRow[0]?.total ?? 0)
  };
}

export async function getTeams() {
  return prisma.$queryRaw<any[]>`
    SELECT
      team_id,
      name,
      abbreviation,
      city,
      wins::integer,
      losses::integer,
      ortg::float,
      drtg::float,
      net_rtg::float,
      team_name,
      team_abbrev,
      team_city,
      off_rating::float,
      def_rating::float,
      net_rating::float,
      last_season,
      last_game_date,
      team_id AS "teamId",
      name AS "teamName",
      abbreviation AS "teamAbbrev",
      city AS "teamCity",
      off_rating::float AS "offRating",
      def_rating::float AS "defRating",
      net_rating::float AS "netRating"
    FROM v_teams
    ORDER BY abbreviation ASC
  `;
}

export async function getTeamById(teamId: string) {
  const teamRows = await prisma.$queryRaw<any[]>`
    SELECT
      team_id,
      name,
      abbreviation,
      city,
      wins::integer,
      losses::integer,
      ortg::float,
      drtg::float,
      net_rtg::float,
      team_name,
      team_abbrev,
      team_city,
      off_rating::float,
      def_rating::float,
      net_rating::float,
      season,
      last_season,
      last_game_date,
      team_id AS "teamId",
      name AS "teamName",
      abbreviation AS "teamAbbrev",
      city AS "teamCity",
      off_rating::float AS "offRating",
      def_rating::float AS "defRating",
      net_rating::float AS "netRating"
    FROM v_teams
    WHERE team_id = ${teamId}
  `;
  const team = teamRows[0];

  if (!team) {
    return null;
  }

  const season = typeof team.last_season === 'string' ? team.last_season : await resolveSeason();

  const statsRows = await prisma.$queryRaw<any[]>`
    SELECT
      ROUND(AVG(CASE
        WHEN g.home_team_id = ${teamId} THEN g.home_score
        ELSE g.away_score
      END)::numeric, 2)::float AS ppg,
      ROUND(AVG(CASE
        WHEN g.home_team_id = ${teamId} THEN g.away_score
        ELSE g.home_score
      END)::numeric, 2)::float AS "oppPpg",
      ROUND(AVG(tba."offensiveRating")::numeric, 2)::float AS "offRating",
      ROUND(AVG(tba."defensiveRating")::numeric, 2)::float AS "defRating",
      ROUND(AVG(tba.pace)::numeric, 2)::float AS pace,
      ROUND(AVG(tbt."fieldGoalsPercentage")::numeric, 4)::float AS "fgPct",
      ROUND(AVG(tbt."threePointersPercentage")::numeric, 4)::float AS "threePct",
      ROUND(AVG(tbt."freeThrowsPercentage")::numeric, 4)::float AS "ftPct"
    FROM v_games g
    LEFT JOIN nba_stats_team_box_advanced tba
      ON tba."gameId" = g.game_id
      AND CAST(tba.team_id AS TEXT) = ${teamId}
    LEFT JOIN nba_stats_team_box_traditional tbt
      ON tbt."gameId" = g.game_id
      AND CAST(tbt.team_id AS TEXT) = ${teamId}
    WHERE (g.home_team_id = ${teamId} OR g.away_team_id = ${teamId})
      AND g.season = ${season}
      AND g.season_type = 'regular'
  `;
  const stats = statsRows[0];

  const roster = await prisma.$queryRaw<any[]>`
    WITH ranked AS (
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
      WHERE gl.team_id = ${teamId}
        AND gl.season = ${season}
    )
    SELECT
      player_id,
      player_name,
      position,
      jersey_num,
      player_id AS "playerId",
      player_name AS name,
      jersey_num AS "jerseyNum"
    FROM ranked
    WHERE rn = 1
    ORDER BY player_name ASC
  `;

  const recentGames = await prisma.$queryRaw<any[]>`
    SELECT
      game_id,
      game_date,
      CASE
        WHEN home_team_id = ${teamId} THEN away_team
        ELSE home_team
      END AS opponent,
      CASE
        WHEN home_team_id = ${teamId} AND home_score > away_score THEN 'W'
        WHEN away_team_id = ${teamId} AND away_score > home_score THEN 'W'
        ELSE 'L'
      END AS result,
      CASE
        WHEN home_team_id = ${teamId} THEN CAST(home_score AS INTEGER) || '-' || CAST(away_score AS INTEGER)
        ELSE CAST(away_score AS INTEGER) || '-' || CAST(home_score AS INTEGER)
      END AS score,
      game_id AS "gameId",
      game_date AS date
    FROM v_games
    WHERE (home_team_id = ${teamId} OR away_team_id = ${teamId})
      AND season = ${season}
    ORDER BY COALESCE(game_date, '1900-01-01') DESC, game_id DESC
    LIMIT 10
  `;

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

export async function getLeaderboards(metric: LeaderboardMetric, season: string | undefined, limit: number) {
  const metricColumn = LEADERBOARD_METRICS[metric];
  const resolvedSeason = await resolveSeason(season);
  const qualification = await getLeaderboardQualification(resolvedSeason);

  // Use unsafe raw query for dynamic metric column.
  // We validate metric is in ALLOWED_LEADERBOARD_METRICS, so limited injection risk.
  // Still, safer to use a switch or mapping if possible.
  // Or Prisma.sql literal if we trust the input (which we do via isLeaderboardMetric check).
  // But Prisma.sql doesn't support dynamic column identifiers unless we use Prisma.raw for column.
  // IMPORTANT: Prisma.raw escapes properly? No, raw injects raw string.
  // Since we validate, it's safe.

  const metricColSql = Prisma.raw(metricColumn);

  const rows = await prisma.$queryRaw<any[]>`
    WITH ordered AS (
      SELECT
        aps.player_id,
        aps.player_name,
        aps.team_abbrev,
        aps.games::integer,
        CASE
          WHEN ${metricColumn} IN ('ppg', 'rpg', 'apg') THEN ROUND(COALESCE(aps.${metricColSql}, 0)::numeric, 1)::float
          ELSE ROUND(COALESCE(aps.${metricColSql}, 0)::numeric, 4)::float
        END AS value,
        ROW_NUMBER() OVER (ORDER BY COALESCE(aps.${metricColSql}, 0) DESC, aps.player_name ASC) AS rank
      FROM app_player_season_stats aps
      WHERE aps.season = ${resolvedSeason}
        AND aps.games >= ${qualification.minGames}
        AND (
          ${metricColumn} NOT IN ('fg_pct', 'three_pct', 'ts_pct', 'usage_pct', 'pie')
          OR (${metricColumn} = 'fg_pct' AND aps.fg_made_total >= ${qualification.minFgMade} AND aps.fg_attempts_total >= ${qualification.minFgAttempts})
          OR (${metricColumn} = 'three_pct' AND aps.fg3_made_total >= ${qualification.minThreeMade} AND aps.fg3_attempts_total >= ${qualification.minThreeAttempts})
          OR (${metricColumn} IN ('ts_pct', 'usage_pct', 'pie') AND (aps.fg_attempts_total + (0.44 * aps.ft_attempts_total)) >= ${qualification.minScoringAttempts})
        )
    )
    SELECT
      rank,
      player_id,
      player_name,
      team_abbrev,
      games::integer,
      value,
      player_id AS "playerId",
      player_name AS name,
      team_abbrev AS team,
      games::integer AS "gamesPlayed"
    FROM ordered
    ORDER BY rank
    LIMIT ${limit}
  `;

  return {
    metric,
    season: resolvedSeason,
    rows
  };
}

async function resolvePlayerIdentifier(input: string): Promise<{ player_id: string; full_name: string } | null> {
  const exact = await prisma.$queryRaw<{ player_id: string; full_name: string }[]>`
    SELECT player_id, player_name AS full_name
    FROM app_player_season_stats
    WHERE player_id = ${input}
    ORDER BY season DESC
    LIMIT 1
  `;
  if (exact[0]) return exact[0];

  const byName = await prisma.$queryRaw<{ player_id: string; full_name: string }[]>`
    SELECT player_id, player_name AS full_name
    FROM app_player_season_stats
    WHERE player_name ILIKE '%' || ${input} || '%'
    ORDER BY season DESC, player_name ASC
    LIMIT 1
  `;
  return byName[0] ?? null;
}

export async function comparePlayers(identifiers: string[], season?: string) {
  const normalized = identifiers.map((value) => value.trim()).filter((value) => value.length > 0);
  const unique = Array.from(new Set(normalized));

  const resolvedPlayers: Array<{ player_id: string; full_name: string }> = [];
  for (const id of unique) {
    const p = await resolvePlayerIdentifier(id);
    if (p) resolvedPlayers.push(p);
  }

  if (resolvedPlayers.length < 2) {
    return null;
  }

  const resolvedSeason = await resolveSeason(season);
  const selected = resolvedPlayers.slice(0, Math.min(8, resolvedPlayers.length));
  const playerIds = selected.map((p) => p.player_id);

  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      aps.player_id,
      aps.player_name,
      aps.team_abbrev,
      aps.position,
      aps.games::integer,
      ROUND(COALESCE(aps.ppg, 0)::numeric, 1)::float AS ppg,
      ROUND(COALESCE(aps.rpg, 0)::numeric, 1)::float AS rpg,
      ROUND(COALESCE(aps.apg, 0)::numeric, 1)::float AS apg,
      ROUND((aps.ts_pct / 100.0)::numeric, 4)::float AS tsp,
      aps.net_rating,
      aps.player_id AS "playerId",
      aps.player_name AS name,
      aps.team_abbrev AS team
    FROM app_player_season_stats aps
    WHERE aps.season = ${resolvedSeason}
      AND aps.player_id IN (${Prisma.join(playerIds)})
    ORDER BY ppg DESC
  `;

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
