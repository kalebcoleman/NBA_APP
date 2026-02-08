import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Plan } from '@prisma/client';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { syncAuthenticatedUserPlan } from './entitlement-service.js';
import { createUserWithPassword, getUserByEmail, normalizeEmail } from './user-service.js';

const MIN_PASSWORD_LENGTH = 8;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

export interface AuthUserPayload {
  id: string;
  email: string;
  plan: Plan | 'FREE' | 'PREMIUM';
}

export interface AuthResult {
  token: string;
  user: AuthUserPayload;
}

export function validatePassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION
  });

  return `scrypt$${salt}$${derived.toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, expectedHex] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) {
    return false;
  }

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION
  });

  if (actual.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
}

function createAuthToken(userId: string, email: string): string {
  return jwt.sign(
    {
      sub: userId,
      email
    },
    env.jwtSecret,
    {
      expiresIn: '7d'
    }
  );
}

async function buildAuthResult(userId: string, email: string): Promise<AuthResult> {
  const entitlement = await syncAuthenticatedUserPlan(userId);
  const token = createAuthToken(userId, email);

  return {
    token,
    user: {
      id: userId,
      email,
      plan: entitlement?.plan ?? Plan.FREE
    }
  };
}

export async function registerWithEmailPassword(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email);

  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = hashPassword(password);
  const user = await createUserWithPassword(normalizedEmail, passwordHash);

  return buildAuthResult(user.id, normalizedEmail);
}

export async function loginWithEmailPassword(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = normalizeEmail(email);
  const user = await getUserByEmail(normalizedEmail);

  if (!user?.passwordHash) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const passwordOk = verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return buildAuthResult(user.id, normalizedEmail);
}

export async function getAuthenticatedProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.email) {
    return null;
  }

  const entitlement = await syncAuthenticatedUserPlan(userId);

  return {
    id: user.id,
    email: user.email,
    plan: entitlement?.plan ?? Plan.FREE
  };
}
