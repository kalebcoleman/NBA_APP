import type { FastifyRequest } from 'fastify';

import { incrementUsage } from '../services/usage-service.js';

export function createUsageTrackingHook() {
  return async function usageTrackingHook(request: FastifyRequest) {
    if (
      request.url.startsWith('/health')
      || request.url.startsWith('/billing/webhook')
      || request.url.startsWith('/auth/')
    ) {
      return;
    }

    if (!request.auth?.isAuthenticated || !request.auth.userId) {
      return;
    }

    await incrementUsage(request.auth.userId, { apiRequests: 1 });
  };
}
