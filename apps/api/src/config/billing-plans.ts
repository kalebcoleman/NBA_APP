import { env } from './env.js';

export type BillingInterval = 'monthly' | 'annual';

interface BillingPlanConfig {
  interval: BillingInterval;
  priceId?: string;
}

export const BILLING_PLANS: Record<BillingInterval, BillingPlanConfig> = {
  monthly: {
    interval: 'monthly',
    priceId: env.stripe.monthlyPriceId
  },
  annual: {
    interval: 'annual',
    priceId: env.stripe.annualPriceId
  }
};

export function getPriceIdForInterval(interval: BillingInterval): string | null {
  return BILLING_PLANS[interval].priceId ?? null;
}

export function intervalFromPriceId(priceId: string | null | undefined): BillingInterval | null {
  if (!priceId) {
    return null;
  }

  if (priceId === BILLING_PLANS.monthly.priceId) {
    return 'monthly';
  }

  if (priceId === BILLING_PLANS.annual.priceId) {
    return 'annual';
  }

  return null;
}
