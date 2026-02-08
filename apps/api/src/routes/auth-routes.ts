import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { getAuthenticatedProfile, loginWithEmailPassword, registerWithEmailPassword, validatePassword } from '../services/auth-service.js';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Body must include valid email and password (min 8 chars).'
        }
      };
    }

    if (!validatePassword(parsed.data.password)) {
      reply.code(400);
      return {
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters.'
        }
      };
    }

    try {
      return await registerWithEmailPassword(parsed.data.email, parsed.data.password);
    } catch (error) {
      if (
        (error instanceof Error && error.message === 'EMAIL_ALREADY_EXISTS')
        || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      ) {
        reply.code(409);
        return {
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email already exists.'
          }
        };
      }

      throw error;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Body must include valid email and password.'
        }
      };
    }

    try {
      return await loginWithEmailPassword(parsed.data.email, parsed.data.password);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
        reply.code(401);
        return {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email or password is incorrect.'
          }
        };
      }

      throw error;
    }
  });

  app.get('/auth/me', async (request, reply) => {
    if (!request.auth.userId || !request.auth.isAuthenticated) {
      reply.code(401);
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.'
        }
      };
    }

    const profile = await getAuthenticatedProfile(request.auth.userId);
    if (!profile) {
      reply.code(404);
      return {
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Authenticated user no longer exists.'
        }
      };
    }

    return {
      user: {
        id: profile.id,
        email: profile.email,
        plan: profile.plan,
        actorKey: request.auth.actorKey,
        isAuthenticated: true
      }
    };
  });
}
