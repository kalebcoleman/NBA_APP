import type { FastifyInstance } from 'fastify';

import { getUpcomingGamesSnapshot } from '../services/espn-upcoming-service.js';
import { clampInt, toInt } from '../utils/http.js';

export async function gamesRoutes(app: FastifyInstance) {
  app.get('/games/upcoming', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = clampInt(toInt(query.limit, 50), 1, 200);

    return getUpcomingGamesSnapshot({
      from: query.from,
      to: query.to,
      teamId: query.teamId,
      limit
    });
  });
}
