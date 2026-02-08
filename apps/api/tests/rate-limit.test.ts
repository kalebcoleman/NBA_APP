import { describe, expect, it } from 'vitest';

import { InMemoryRateLimitStore } from '../src/services/rate-limit-store.js';

describe('in-memory rate limiter', () => {
  it('increments counts within a window', async () => {
    const store = new InMemoryRateLimitStore();

    const first = await store.increment('user:1', 1000);
    const second = await store.increment('user:1', 1000);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);

    await store.close();
  });

  it('resets after window expiration', async () => {
    const store = new InMemoryRateLimitStore();

    await store.increment('user:2', 5);

    await new Promise((resolve) => setTimeout(resolve, 15));

    const next = await store.increment('user:2', 5);
    expect(next.count).toBe(1);

    await store.close();
  });
});
