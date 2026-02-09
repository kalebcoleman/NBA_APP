import type { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { getUserByExternalKey, getUserById } from '../services/user-service.js';
import { extractBearerToken, sha256 } from '../utils/security.js';

interface JwtClaims {
  sub: string;
}

function actorKeyFromIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  const sourceIp = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() ?? request.ip : request.ip;
  return `anon:${sha256(sourceIp)}`;
}

export async function authContextHook(request: FastifyRequest): Promise<void> {
  if (request.url.startsWith('/billing/webhook') || request.url.startsWith('/health')) {
    request.auth = {
      actorKey: request.url.startsWith('/billing/webhook') ? 'system:stripe-webhook' : 'system:healthcheck',
      userId: null,
      isAuthenticated: false,
      plan: 'FREE'
    };
    return;
  }

  const token = extractBearerToken(request.headers.authorization);
  let actorKey = actorKeyFromIp(request);
  let isAuthenticated = false;
  let userId: string | null = null;
  let plan: 'FREE' | 'PREMIUM' = 'FREE';

  if (token) {
    try {
      const claims = jwt.verify(token, env.jwtSecret) as JwtClaims;
      if (claims.sub) {
        const byId = await getUserById(claims.sub);
        const byLegacyActor = !byId
          ? await getUserByExternalKey(`auth:${claims.sub}`)
          : null;
        const authenticatedUser = byId ?? byLegacyActor;

        if (authenticatedUser) {
          actorKey = `user:${authenticatedUser.id}`;
          userId = authenticatedUser.id;
          isAuthenticated = true;
          plan = authenticatedUser.plan;
        }
      }
    } catch {
      // Invalid tokens fall back to anonymous identity.
    }
  }

  request.auth = {
    actorKey,
    userId,
    isAuthenticated,
    plan
  };
}
