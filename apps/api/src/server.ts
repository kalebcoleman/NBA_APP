import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rawBody from 'fastify-raw-body';
import Fastify from 'fastify';

import { authContextHook } from './auth/auth-context.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { installErrorHandler } from './middleware/error-handler.js';
import { createRequestRateLimitHook } from './middleware/request-rate-limit.js';
import { createUsageTrackingHook } from './middleware/usage-tracker.js';
import { gamesRoutes } from './routes/games-routes.js';
import { billingRoutes } from './routes/billing-routes.js';
import { authRoutes } from './routes/auth-routes.js';
import { healthRoutes } from './routes/health-routes.js';
import { meRoutes } from './routes/me-routes.js';
import { nbaRoutes } from './routes/nba-routes.js';
import { qaRoutes } from './routes/qa-routes.js';
import { startUpcomingGamesSyncScheduler } from './services/espn-upcoming-service.js';
import { buildRateLimitStore } from './services/rate-limit-store.js';

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: 'info'
    }
  });

  const rateLimitStore = buildRateLimitStore(env.redisUrl);
  const allowedOrigins = new Set(env.corsAllowedOrigins);

  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has('*')) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.has(origin));
    }
  });

  app.register(helmet);

  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true
  });

  app.addHook('onRequest', authContextHook);
  app.addHook('preHandler', createRequestRateLimitHook(rateLimitStore, env.requestRateLimitPerMinute));
  app.addHook('preHandler', createUsageTrackingHook());

  await app.register(healthRoutes);
  await app.register(gamesRoutes);
  await app.register(authRoutes);
  await app.register(nbaRoutes);
  await app.register(meRoutes);
  await app.register(billingRoutes);
  await app.register(qaRoutes);

  const stopEspnSyncScheduler = startUpcomingGamesSyncScheduler(app.log);
  installErrorHandler(app);

  app.addHook('onClose', async () => {
    stopEspnSyncScheduler();
    await rateLimitStore.close();
    await prisma.$disconnect();
  });

  return app;
}
