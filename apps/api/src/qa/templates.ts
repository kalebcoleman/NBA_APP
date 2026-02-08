import { sqlite } from '../db/sqlite.js';
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

function normalizeSeason(input: unknown): string {
  if (typeof input === 'string' && /^\d{4}-\d{2}$/.test(input)) {
    return input;
  }
  return getLatestSeason() ?? '2025-26';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function runTopScorersTemplate(params: Record<string, unknown>, context: QaExecutionContext): QaResult {
  const season = normalizeSeason(params.season);
  const requested = typeof params.limit === 'number' ? params.limit : 10;
  const limit = clamp(requested, 3, context.rowLimit);

  const rows = sqlite
    .prepare(
      `SELECT
         player_id,
         player_name,
         MAX(team_abbrev) AS team_abbrev,
         COUNT(*) AS games,
         ROUND(AVG(points), 2) AS ppg
       FROM v_player_game_logs
       WHERE season = ?
         AND season_type = 'regular'
       GROUP BY player_id, player_name
       HAVING COUNT(*) >= 5
       ORDER BY ppg DESC
       LIMIT ?`
    )
    .all(season, limit) as Array<{
      player_id: string;
      player_name: string;
      team_abbrev: string;
      games: number;
      ppg: number;
    }>;

  if (rows.length === 0) {
    return {
      answer: `No scoring data was found for season ${season}.`
    };
  }

  return {
    answer: `Top scorers for ${season} are ranked by regular-season points per game.` ,
    table: {
      columns: ['Player', 'Team', 'Games', 'PPG'],
      rows: rows.map((row) => [row.player_name, row.team_abbrev, row.games, row.ppg])
    },
    chartSpec: {
      type: 'bar',
      x: rows.map((row) => row.player_name),
      y: rows.map((row) => row.ppg),
      title: `Top scorers (${season})`
    }
  };
}

function runPlayerAveragePointsTemplate(params: Record<string, unknown>, context: QaExecutionContext): QaResult {
  const playerName = typeof params.playerName === 'string' ? params.playerName.trim() : '';
  if (!playerName) {
    return {
      answer: 'Please include a player name for this question.'
    };
  }

  const season = normalizeSeason(params.season);
  const lastNGamesRaw = typeof params.lastNGames === 'number' ? params.lastNGames : 10;
  const lastNGames = clamp(lastNGamesRaw, 3, Math.min(30, context.rowLimit));

  const player = sqlite
    .prepare(
      `SELECT player_id, full_name
       FROM v_players
       WHERE full_name LIKE '%' || ? || '%'
       ORDER BY full_name ASC
       LIMIT 1`
    )
    .get(playerName) as { player_id: string; full_name: string } | undefined;

  if (!player) {
    return {
      answer: `I couldn't find a player matching "${playerName}".`
    };
  }

  const games = sqlite
    .prepare(
      `SELECT game_date, opponent_team_abbrev, points
       FROM v_player_game_logs
       WHERE player_id = ?
         AND season = ?
         AND season_type = 'regular'
       ORDER BY COALESCE(game_date, '1900-01-01') DESC, game_id DESC
       LIMIT ?`
    )
    .all(player.player_id, season, lastNGames) as Array<{
      game_date: string;
      opponent_team_abbrev: string;
      points: number;
    }>;

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

function runTeamNetRatingTrendTemplate(params: Record<string, unknown>, context: QaExecutionContext): QaResult {
  const teamName = typeof params.teamName === 'string' ? params.teamName.trim() : '';
  if (!teamName) {
    return {
      answer: 'Please include a team name for this net rating question.'
    };
  }

  const season = normalizeSeason(params.season);
  const requested = typeof params.limit === 'number' ? params.limit : 20;
  const limit = clamp(requested, 5, Math.min(40, context.rowLimit));

  const team = sqlite
    .prepare(
      `SELECT team_id, team_abbrev, team_name
       FROM v_teams
       WHERE team_name LIKE '%' || ? || '%'
          OR team_abbrev = UPPER(?)
       ORDER BY team_abbrev
       LIMIT 1`
    )
    .get(teamName, teamName) as { team_id: string; team_abbrev: string; team_name: string } | undefined;

  if (!team) {
    return {
      answer: `I couldn't resolve a team matching "${teamName}".`
    };
  }

  const trendRows = sqlite
    .prepare(
      `SELECT
         g.game_date,
         ROUND(tba.netRating, 2) AS net_rating
       FROM nba_stats_team_box_advanced tba
       LEFT JOIN nba_stats_games g ON g.game_id = tba.gameId
       WHERE tba.season = ?
         AND tba.season_type = 'regular'
         AND tba.teamTricode = ?
       ORDER BY COALESCE(g.game_date, '1900-01-01') DESC, tba.gameId DESC
       LIMIT ?`
    )
    .all(season, team.team_abbrev, limit) as Array<{
      game_date: string;
      net_rating: number;
    }>;

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

export function executeTemplate(intentType: string, params: Record<string, unknown>, context: QaExecutionContext): QaResult {
  switch (intentType) {
    case 'TOP_SCORERS_SEASON':
      return runTopScorersTemplate(params, context);
    case 'PLAYER_AVG_POINTS_LAST_N_GAMES':
      return runPlayerAveragePointsTemplate(params, context);
    case 'TEAM_NET_RATING_TREND':
      return runTeamNetRatingTrendTemplate(params, context);
    default:
      return {
        answer:
          'I can currently answer: top scorers by season, player average points over last N games, and team net rating trends.'
      };
  }
}
