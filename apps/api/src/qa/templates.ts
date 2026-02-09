import { prisma } from '../db/prisma.js';
import { getLatestSeason } from '../services/nba-service.js';

export interface QaResult {
  answer: string;
  table?: {
    columns: string[];
    rows: Array<Array<string | number | null>>;
  };
  chartSpec?: Record<string, unknown>;
}

export interface QaExecutionContext {
  rowLimit: number;
}

async function normalizeSeason(input: unknown): Promise<string> {
  if (typeof input === 'string' && /^\d{4}-\d{2}$/.test(input)) {
    return input;
  }
  return (await getLatestSeason()) ?? '2025-26';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function runTopScorersTemplate(params: Record<string, unknown>, context: QaExecutionContext): Promise<QaResult> {
  const season = await normalizeSeason(params.season);
  const requested = typeof params.limit === 'number' ? params.limit : 10;
  const limit = clamp(requested, 3, context.rowLimit);

  const rows = await prisma.$queryRaw<Array<{ player_id: string; player_name: string; team_abbrev: string; games: bigint; ppg: number }>>`
    SELECT
      player_id,
      player_name,
      MAX(team_abbrev) AS team_abbrev,
      COUNT(*)::integer AS games,
      ROUND(AVG(points)::numeric, 2)::float AS ppg
    FROM v_player_game_logs
    WHERE season = ${season}
      AND season_type = 'regular'
    GROUP BY player_id, player_name
    HAVING COUNT(*) >= 5
    ORDER BY ppg DESC
    LIMIT ${limit}
  `;

  if (rows.length === 0) {
    return {
      answer: `No scoring data was found for season ${season}.`
    };
  }

  return {
    answer: `Top scorers for ${season} are ranked by regular-season points per game.`,
    table: {
      columns: ['Player', 'Team', 'Games', 'PPG'],
      rows: rows.map((row) => [row.player_name, row.team_abbrev, Number(row.games), row.ppg])
    },
    chartSpec: {
      type: 'bar',
      x: rows.map((row) => row.player_name),
      y: rows.map((row) => row.ppg),
      title: `Top scorers (${season})`
    }
  };
}

async function runPlayerAveragePointsTemplate(params: Record<string, unknown>, context: QaExecutionContext): Promise<QaResult> {
  const playerName = typeof params.playerName === 'string' ? params.playerName.trim() : '';
  if (!playerName) {
    return {
      answer: 'Please include a player name for this question.'
    };
  }

  const season = await normalizeSeason(params.season);
  const lastNGamesRaw = typeof params.lastNGames === 'number' ? params.lastNGames : 10;
  const lastNGames = clamp(lastNGamesRaw, 3, Math.min(30, context.rowLimit));

  const playerRows = await prisma.$queryRaw<Array<{ player_id: string; full_name: string }>>`
    SELECT player_id, full_name
    FROM v_players
    WHERE full_name ILIKE '%' || ${playerName} || '%'
    ORDER BY full_name ASC
    LIMIT 1
  `;
  const player = playerRows[0];

  if (!player) {
    return {
      answer: `I couldn't find a player matching "${playerName}".`
    };
  }

  const games = await prisma.$queryRaw<Array<{ game_date: string; opponent_team_abbrev: string; points: number }>>`
    SELECT game_date, opponent_team_abbrev, points
    FROM v_player_game_logs
    WHERE player_id = ${player.player_id}
      AND season = ${season}
      AND season_type = 'regular'
    ORDER BY COALESCE(game_date, '1900-01-01') DESC, game_id DESC
    LIMIT ${lastNGames}
  `;

  if (games.length === 0) {
    return {
      answer: `No game logs were found for ${player.full_name} in ${season}.`
    };
  }

  const average = games.reduce((sum, game) => sum + game.points, 0) / games.length;

  return {
    answer: `${player.full_name} averaged ${average.toFixed(2)} points across the last ${games.length} regular-season games in ${season}.`,
    table: {
      columns: ['Game Date', 'Opponent', 'Points'],
      rows: games.map((game) => [game.game_date, game.opponent_team_abbrev, game.points])
    },
    chartSpec: {
      type: 'line',
      x: games.map((game) => game.game_date).reverse(),
      y: games.map((game) => game.points).reverse(),
      title: `${player.full_name} points trend`
    }
  };
}

async function runTeamNetRatingTrendTemplate(params: Record<string, unknown>, context: QaExecutionContext): Promise<QaResult> {
  const teamName = typeof params.teamName === 'string' ? params.teamName.trim() : '';
  if (!teamName) {
    return {
      answer: 'Please include a team name for this net rating question.'
    };
  }

  const season = await normalizeSeason(params.season);
  const requested = typeof params.limit === 'number' ? params.limit : 20;
  const limit = clamp(requested, 5, Math.min(40, context.rowLimit));

  const teamRows = await prisma.$queryRaw<Array<{ team_id: string; team_abbrev: string; team_name: string }>>`
    SELECT team_id, team_abbrev, team_name
    FROM v_teams
    WHERE team_name ILIKE '%' || ${teamName} || '%'
       OR team_abbrev = UPPER(${teamName})
    ORDER BY team_abbrev
    LIMIT 1
  `;
  const team = teamRows[0];

  if (!team) {
    return {
      answer: `I couldn't resolve a team matching "${teamName}".`
    };
  }

  const trendRows = await prisma.$queryRaw<Array<{ game_date: string; net_rating: number }>>`
    SELECT
      g.game_date,
      ROUND(tba."netRating"::numeric, 2)::float AS net_rating
    FROM nba_stats_team_box_advanced tba
    LEFT JOIN nba_stats_games g ON g.game_id = tba."gameId"
    WHERE tba.season = ${season}
      AND tba.season_type = 'regular'
      AND tba."teamTricode" = ${team.team_abbrev}
    ORDER BY COALESCE(g.game_date, '1900-01-01') DESC, tba."gameId" DESC
    LIMIT ${limit}
  `;

  if (trendRows.length === 0) {
    return {
      answer: `No net rating trend rows were found for ${team.team_name} in ${season}.`
    };
  }

  const avg = trendRows.reduce((sum, row) => sum + row.net_rating, 0) / trendRows.length;

  return {
    answer: `${team.team_name} posted an average net rating of ${avg.toFixed(2)} over the latest ${trendRows.length} regular-season games in ${season}.`,
    table: {
      columns: ['Game Date', 'Net Rating'],
      rows: trendRows.map((row) => [row.game_date, row.net_rating])
    },
    chartSpec: {
      type: 'line',
      x: trendRows.map((row) => row.game_date).reverse(),
      y: trendRows.map((row) => row.net_rating).reverse(),
      title: `${team.team_abbrev} net rating trend (${season})`
    }
  };
}

export async function executeTemplate(intentType: string, params: Record<string, unknown>, context: QaExecutionContext): Promise<QaResult> {
  switch (intentType) {
    case 'TOP_SCORERS_SEASON':
      return await runTopScorersTemplate(params, context);
    case 'PLAYER_AVG_POINTS_LAST_N_GAMES':
      return await runPlayerAveragePointsTemplate(params, context);
    case 'TEAM_NET_RATING_TREND':
      return await runTeamNetRatingTrendTemplate(params, context);
    default:
      return {
        answer:
          'I can currently answer: top scorers by season, player average points over last N games, and team net rating trends.'
      };
  }
}
