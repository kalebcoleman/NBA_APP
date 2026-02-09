import type { FastifyInstance } from 'fastify';

import { prisma } from '../db/prisma.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      return {
        ok: true,
        service: 'nba-api',
        timestamp: new Date().toISOString(),
        checks: {
          postgres: 'ok'
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown health check error';
      reply.code(503);
      return {
        ok: false,
        service: 'nba-api',
        timestamp: new Date().toISOString(),
        checks: {
          postgres: 'error'
        },
        error: message
      };
    }
  });
}
