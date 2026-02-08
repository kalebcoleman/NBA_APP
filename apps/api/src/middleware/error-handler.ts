import type { FastifyInstance } from 'fastify';

export function installErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    const normalized = error instanceof Error ? error : new Error('Unexpected error');
    const withStatus = normalized as Error & { statusCode?: number };
    const statusCode = withStatus.statusCode && withStatus.statusCode >= 400 ? withStatus.statusCode : 500;

    app.log.error({ err: normalized }, 'request_failed');

    reply.code(statusCode).send({
      error: {
        code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message: normalized.message
      }
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`
      }
    });
  });
}
