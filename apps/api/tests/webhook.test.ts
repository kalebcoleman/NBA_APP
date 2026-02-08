import { describe, expect, it } from 'vitest';

import { derivePlanFromSubscriptionInputs } from '../src/billing/webhook-service.js';

describe('stripe webhook plan derivation', () => {
  it('keeps premium when status is active', () => {
    expect(derivePlanFromSubscriptionInputs('active', null)).toBe('PREMIUM');
  });

  it('downgrades when status is canceled and price is unknown', () => {
    expect(derivePlanFromSubscriptionInputs('canceled', null)).toBe('FREE');
  });
});
