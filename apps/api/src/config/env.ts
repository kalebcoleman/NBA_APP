import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

import { workspaceRoot } from '../utils/paths.js';

dotenv.config({ path: path.join(workspaceRoot, '.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
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
  PREMIUM_QA_ROW_LIMIT: z.coerce.number().int().positive().default(500),
  ESPN_SYNC_ENABLED: z.string().optional().default(''),
  ESPN_SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60)
});

const parsed = envSchema.parse(process.env);

function resolveAbsolutePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(workspaceRoot, value);
}

const apiPort = parsed.API_PORT ?? parsed.PORT ?? 3001;
const requestedDevPremiumBypass = parsed.DEV_PREMIUM_BYPASS.trim().toLowerCase() === 'true';
const devPremiumBypass = parsed.NODE_ENV === 'production' ? false : requestedDevPremiumBypass;
const corsAllowedOrigins = parsed.CORS_ALLOWED_ORIGINS
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const espnSyncEnabled = (() => {
  if (!parsed.ESPN_SYNC_ENABLED) {
    return parsed.NODE_ENV !== 'test';
  }

  const normalized = parsed.ESPN_SYNC_ENABLED.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
})();

// Prisma expects DATABASE_URL.
process.env.DATABASE_URL = parsed.DATABASE_URL;

export const env = {
  nodeEnv: parsed.NODE_ENV,
  apiPort,
  apiBaseUrl: parsed.API_BASE_URL || parsed.NEXT_PUBLIC_API_BASE_URL,
  corsAllowedOrigins,
  databaseUrl: parsed.DATABASE_URL,
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
  espnSyncEnabled,
  espnSyncIntervalMinutes: parsed.ESPN_SYNC_INTERVAL_MINUTES,
  stripe: {
    secretKey: parsed.STRIPE_SECRET_KEY,
    webhookSecret: parsed.STRIPE_WEBHOOK_SECRET,
    monthlyPriceId: parsed.STRIPE_PRICE_MONTHLY,
    annualPriceId: parsed.STRIPE_PRICE_ANNUAL,
    successUrl: parsed.STRIPE_SUCCESS_URL,
    cancelUrl: parsed.STRIPE_CANCEL_URL
  }
} as const;
