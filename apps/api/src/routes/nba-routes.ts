import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  ALLOWED_LEADERBOARD_METRICS,
  comparePlayers,
  getLeaderboards,
  getPlayerById,
  getPlayerGames,
  getPlayers,
  getPlayerShots,
  getTeamById,
  getTeams,
  isLeaderboardMetric,
  type ShotScope
} from '../services/nba-service.js';
import { clampInt, toInt } from '../utils/http.js';

const FREE_GAMES_MAX = 5;
const PREMIUM_GAMES_MAX = 200;
const FREE_SHOTS_MAX = 1500;
const PREMIUM_SHOTS_MAX = 5000;
const FREE_TREND_WINDOW = 5;

function parseCompareIds(query: Record<string, string | undefined>): string[] {
  if (query.playerIds) {
    return query.playerIds
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  if (query.playerA && query.playerB) {
    return [query.playerA, query.playerB];
  }

  return [];
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseShotScope(value: string | undefined, fallback: ShotScope): ShotScope {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'recent' || normalized === 'all') {
    return normalized;
  }
  return fallback;
}

export async function nbaRoutes(app: FastifyInstance) {
  app.get('/players', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = clampInt(toInt(query.limit, 25), 1, 100);
    const page = clampInt(toInt(query.page, 1), 1, 100_000);
    const offset = query.offset ? clampInt(toInt(query.offset, 0), 0, 100_000) : (page - 1) * limit;

    const result = getPlayers(query.search, limit, offset, query.season);

    return {
      data: result.data,
      meta: {
        limit,
        offset,
        total: result.total
      },
      pagination: {
        page,
        limit,
        total: result.total
      }
    };
  });

  app.get('/players/:playerId', async (request, reply) => {
    const params = request.params as { playerId: string };
    const player = getPlayerById(params.playerId);

    if (!player) {
      reply.code(404);
      return {
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: `No player found for id ${params.playerId}`
        }
      };
    }

    return {
      ...player,
      data: player
    };
  });

  const playerGamesHandler = async (request: FastifyRequest) => {
    const params = request.params as { playerId: string };
    const query = request.query as Record<string, string | undefined>;
    const includeDnp = parseBooleanFlag(query.includeDNP ?? query.includeDnp, false);
    const isPremium = request.auth.plan === 'PREMIUM';

    const requestedLimit = clampInt(toInt(query.limit, 20), 1, PREMIUM_GAMES_MAX);
    const limit = isPremium ? requestedLimit : Math.min(requestedLimit, FREE_GAMES_MAX);
    const offset = isPremium ? clampInt(toInt(query.offset, 0), 0, 100_000) : 0;

    const result = getPlayerGames(params.playerId, {
      limit,
      offset,
      season: query.season,
      includeDnp
    });

    return {
      data: result.rows,
      meta: {
        limit,
        offset,
        total: result.total,
        includeDNP: includeDnp
      }
    };
  };

  app.get('/players/:playerId/games', playerGamesHandler);
  app.get('/players/:playerId/gamelog', playerGamesHandler);

  app.get('/players/:playerId/shots', async (request) => {
    const params = request.params as { playerId: string };
    const query = request.query as Record<string, string | undefined>;
    const isPremium = request.auth.plan === 'PREMIUM';
    const shotLimitMax = isPremium ? PREMIUM_SHOTS_MAX : FREE_SHOTS_MAX;
    const limit = clampInt(toInt(query.limit, 500), 1, shotLimitMax);
    const offset = clampInt(toInt(query.offset, 0), 0, 100_000);
    const requestedScope = parseShotScope(query.scope, isPremium ? 'all' : 'recent');
    const scope: ShotScope = isPremium ? requestedScope : 'recent';

    const result = getPlayerShots(params.playerId, {
      season: query.season,
      limit,
      offset,
      gameId: query.gameId,
      scope,
      recentGameWindow: FREE_TREND_WINDOW
    });

    return {
      data: result.rows,
      meta: {
        limit,
        offset,
        total: result.total,
        scope
      }
    };
  });

  app.get('/teams', async () => {
    return {
      data: getTeams()
    };
  });

  app.get('/teams/:teamId', async (request, reply) => {
    const params = request.params as { teamId: string };
    const team = getTeamById(params.teamId);

    if (!team) {
      reply.code(404);
      return {
        error: {
          code: 'TEAM_NOT_FOUND',
          message: `No team found for id ${params.teamId}`
        }
      };
    }

    return {
      ...team,
      data: team
    };
  });

  app.get('/leaderboards', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = clampInt(toInt(query.limit, 10), 1, 100);
    const requestedMetric = (query.metric ?? query.stat ?? 'points').trim();

    if (!isLeaderboardMetric(requestedMetric)) {
      reply.code(400);
      return {
        error: {
          code: 'INVALID_METRIC',
          message: `metric must be one of: ${ALLOWED_LEADERBOARD_METRICS.join(', ')}`
        }
      };
    }

    const board = getLeaderboards(requestedMetric, query.season, limit);

    return {
      data: board.rows,
      meta: {
        metric: requestedMetric,
        season: board.season,
        limit
      }
    };
  });

  app.get('/compare', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const compareIds = parseCompareIds(query);

    if (compareIds.length < 2) {
      reply.code(400);
      return {
        error: {
          code: 'INVALID_COMPARE_REQUEST',
          message: 'Provide playerIds=a,b or playerA and playerB query parameters.'
        }
      };
    }

    const result = comparePlayers(compareIds, query.season);

    if (!result) {
      reply.code(404);
      return {
        error: {
          code: 'COMPARE_PLAYERS_NOT_FOUND',
          message: 'Could not resolve enough players for comparison.'
        }
      };
    }

    return {
      data: result.rows,
      players: result.comparisonPlayers,
      meta: {
        season: result.season,
        players: result.players
      }
    };
  });
}
