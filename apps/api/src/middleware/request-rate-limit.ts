import type { FastifyReply, FastifyRequest } from 'fastify';

import type { RateLimitStore } from '../services/rate-limit-store.js';

const WINDOW_MS = 60_000;

export function createRequestRateLimitHook(store: RateLimitStore, maxRequestsPerMinute: number) {
  return async function requestRateLimitHook(request: FastifyRequest, reply: FastifyReply) {
    if (request.url.startsWith('/health') || request.url.startsWith('/billing/webhook')) {
      return;
    }

    const key = request.auth?.actorKey ?? `ip:${request.ip}`;
    const result = await store.increment(key, WINDOW_MS);

    reply.header('x-ratelimit-limit', maxRequestsPerMinute);
    reply.header('x-ratelimit-remaining', Math.max(maxRequestsPerMinute - result.count, 0));
    reply.header('x-ratelimit-reset', Math.floor(result.resetAt / 1000));

    if (result.count > maxRequestsPerMinute) {
      return reply.code(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests, please try again shortly.'
        }
      });
    }
  };
}
