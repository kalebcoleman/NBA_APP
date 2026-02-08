import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

import { workspaceRoot } from '../utils/paths.js';

dotenv.config({ path: path.join(workspaceRoot, '.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_PATH: z.string().default('./db/local/nba.sqlite'),
  DATABASE_URL: z.string().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().optional(),
  API_BASE_URL: z.string().default('http://localhost:3001'),
  NEXT_PUBLIC_API_BASE_URL: z.string().default('http://localhost:3001'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  JWT_SECRET: z.string().default('dev-secret'),
  NEXTAUTH_SECRET: z.string().optional(),
  DEV_PREMIUM_BYPASS: z.string().optional().default('false'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ANNUAL: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().default('http://localhost:3000/billing/success'),
  STRIPE_CANCEL_URL: z.string().default('http://localhost:3000/billing/cancel'),
  REDIS_URL: z.string().optional(),
  REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(120),
  QA_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
  FREE_QA_DAILY_LIMIT: z.coerce.number().int().positive().default(5),
  PREMIUM_QA_DAILY_LIMIT: z.coerce.number().int().positive().default(5000),
  FREE_QA_ROW_LIMIT: z.coerce.number().int().positive().default(50),
  PREMIUM_QA_ROW_LIMIT: z.coerce.number().int().positive().default(500)
});

const parsed = envSchema.parse(process.env);

function resolveAbsolutePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(workspaceRoot, value);
}

function filePathFromDatabaseUrl(value: string): string | null {
  if (value.startsWith('file://')) {
    return fileURLToPath(value);
  }

  if (value.startsWith('file:')) {
    return resolveAbsolutePath(value.slice('file:'.length));
  }

  if (/^[a-zA-Z]+:/.test(value)) {
    return null;
  }

  return resolveAbsolutePath(value);
}

const explicitDatabaseUrl = parsed.DATABASE_URL?.trim();
const inferredDatabasePath = explicitDatabaseUrl ? filePathFromDatabaseUrl(explicitDatabaseUrl) : null;
const databasePath = inferredDatabasePath ?? resolveAbsolutePath(parsed.DATABASE_PATH);
const databaseUrl = explicitDatabaseUrl && explicitDatabaseUrl.length > 0
  ? (/^[a-zA-Z]+:/.test(explicitDatabaseUrl)
      ? explicitDatabaseUrl
      : `file:${resolveAbsolutePath(explicitDatabaseUrl)}`)
  : `file:${databasePath}`;

const apiPort = parsed.API_PORT ?? parsed.PORT ?? 3001;
const requestedDevPremiumBypass = parsed.DEV_PREMIUM_BYPASS.trim().toLowerCase() === 'true';
const devPremiumBypass = parsed.NODE_ENV === 'production' ? false : requestedDevPremiumBypass;
const corsAllowedOrigins = parsed.CORS_ALLOWED_ORIGINS
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

// Prisma expects DATABASE_URL.
process.env.DATABASE_URL = databaseUrl;

export const env = {
  nodeEnv: parsed.NODE_ENV,
  apiPort,
  apiBaseUrl: parsed.API_BASE_URL || parsed.NEXT_PUBLIC_API_BASE_URL,
  corsAllowedOrigins,
  databasePath,
  databaseUrl,
  jwtSecret: parsed.JWT_SECRET,
  nextAuthSecret: parsed.NEXTAUTH_SECRET,
  devPremiumBypass,
  redisUrl: parsed.REDIS_URL,
  requestRateLimitPerMinute: parsed.REQUESTS_PER_MINUTE,
  qaQueryTimeoutMs: parsed.QA_QUERY_TIMEOUT_MS,
  freeQaDailyLimit: parsed.FREE_QA_DAILY_LIMIT,
  premiumQaDailyLimit: parsed.PREMIUM_QA_DAILY_LIMIT,
  freeQaRowLimit: parsed.FREE_QA_ROW_LIMIT,
  premiumQaRowLimit: parsed.PREMIUM_QA_ROW_LIMIT,
  stripe: {
    secretKey: parsed.STRIPE_SECRET_KEY,
    webhookSecret: parsed.STRIPE_WEBHOOK_SECRET,
    monthlyPriceId: parsed.STRIPE_PRICE_MONTHLY,
    annualPriceId: parsed.STRIPE_PRICE_ANNUAL,
    successUrl: parsed.STRIPE_SUCCESS_URL,
    cancelUrl: parsed.STRIPE_CANCEL_URL
  }
} as const;
