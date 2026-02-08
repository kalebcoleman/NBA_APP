import type { Plan } from '@prisma/client';

import { env } from './env.js';

export type PlanName = Plan | 'FREE' | 'PREMIUM';

export interface PlanLimits {
  qaDailyLimit: number;
  qaRowLimit: number;
  gamesMax: number | null;
  shotsScope: 'recent' | 'all';
  trendWindow: number | null;
}

const limitsByPlan: Record<'FREE' | 'PREMIUM', PlanLimits> = {
  FREE: {
    qaDailyLimit: env.freeQaDailyLimit,
    qaRowLimit: env.freeQaRowLimit,
    gamesMax: 5,
    shotsScope: 'recent',
    trendWindow: 5
  },
  PREMIUM: {
    qaDailyLimit: env.premiumQaDailyLimit,
    qaRowLimit: env.premiumQaRowLimit,
    gamesMax: null,
    shotsScope: 'all',
    trendWindow: null
  }
};

export function getPlanLimits(plan: PlanName | null | undefined): PlanLimits {
  if (plan === 'PREMIUM') {
    return limitsByPlan.PREMIUM;
  }
  return limitsByPlan.FREE;
}
