import type { FastifyInstance } from 'fastify';

import { getPlanLimits } from '../config/plans.js';
import { getUserEntitlement } from '../services/entitlement-service.js';
import { getUserById } from '../services/user-service.js';
import { getDailyUsage, getTodayKey } from '../services/usage-service.js';

export async function meRoutes(app: FastifyInstance) {
  app.get('/me', async (request, reply) => {
    if (!request.auth.userId) {
      reply.code(401);
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: 'No user context was found for this request.'
        }
      };
    }

    const user = await getUserById(request.auth.userId);
    if (!user) {
      reply.code(404);
      return {
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User context no longer exists.'
        }
      };
    }

    const entitlement = await getUserEntitlement(user.id, user.plan);
    const planLimits = getPlanLimits(entitlement.plan);
    const usageDate = getTodayKey();
    const usage = await getDailyUsage(user.id, usageDate);

    return {
      user: {
        id: user.id,
        actorKey: user.externalKey,
        plan: entitlement.plan,
        isAuthenticated: request.auth.isAuthenticated
      },
      limits: {
        qaDailyLimit: entitlement.qaDailyLimit,
        qaRowLimit: entitlement.qaRowLimit,
        gamesMax: planLimits.gamesMax,
        shotsScope: planLimits.shotsScope,
        trendWindow: planLimits.trendWindow
      },
      usage: {
        date: usageDate,
        qaQueries: usage?.qaQueries ?? 0,
        apiRequests: usage?.apiRequests ?? 0,
        qaRemaining: Math.max(entitlement.qaDailyLimit - (usage?.qaQueries ?? 0), 0)
      }
    };
  });
}
