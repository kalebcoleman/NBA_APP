import { describe, expect, it } from 'vitest';

import { getPlanLimits } from '../src/config/plans.js';
import { resolvePlanFromSubscriptionStatus } from '../src/services/entitlement-service.js';

describe('entitlement limits', () => {
  it('returns free limits by default', () => {
    const limits = getPlanLimits('FREE');
    expect(limits.qaDailyLimit).toBeGreaterThan(0);
    expect(limits.qaRowLimit).toBeGreaterThan(0);
  });

  it('premium is higher than free', () => {
    const free = getPlanLimits('FREE');
    const premium = getPlanLimits('PREMIUM');

    expect(premium.qaDailyLimit).toBeGreaterThanOrEqual(free.qaDailyLimit);
    expect(premium.qaRowLimit).toBeGreaterThanOrEqual(free.qaRowLimit);
  });

  it('maps active subscription to premium', () => {
    expect(resolvePlanFromSubscriptionStatus('active')).toBe('PREMIUM');
  });

  it('maps canceled subscription to free', () => {
    expect(resolvePlanFromSubscriptionStatus('canceled')).toBe('FREE');
  });
});
