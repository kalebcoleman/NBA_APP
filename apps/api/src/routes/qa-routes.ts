import type { FastifyInstance } from 'fastify';

import { askQuestion } from '../services/qa-service.js';

export async function qaRoutes(app: FastifyInstance) {
  app.post('/qa/ask', async (request, reply) => {
    const body = request.body as { question?: string };

    if (!body?.question || body.question.trim().length === 0) {
      reply.code(400);
      return {
        error: {
          code: 'INVALID_QUESTION',
          message: 'Request body must include a non-empty question.'
        }
      };
    }

    if (!request.auth.userId) {
      reply.code(401);
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing user context for Q&A request.'
        }
      };
    }

    const result = await askQuestion({
      question: body.question,
      userId: request.auth.userId,
      fallbackPlan: request.auth.plan
    });

    return result;
  });
}
