import { Redis } from 'ioredis';

export interface RateLimitResult {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitResult>;
  close(): Promise<void>;
}

interface MemoryEntry {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<string, MemoryEntry>();

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.counters.get(key);

    if (!existing || existing.resetAt <= now) {
      const next: MemoryEntry = {
        count: 1,
        resetAt: now + windowMs
      };
      this.counters.set(key, next);
      return { ...next };
    }

    existing.count += 1;
    return { ...existing };
  }

  async close(): Promise<void> {
    this.counters.clear();
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const counterKey = `ratelimit:${key}`;
    const count = await this.redis.incr(counterKey);

    if (count === 1) {
      await this.redis.pexpire(counterKey, windowMs);
    }

    const ttl = await this.redis.pttl(counterKey);
    const resetAt = Date.now() + Math.max(ttl, 0);

    return {
      count,
      resetAt
    };
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export function buildRateLimitStore(redisUrl?: string): RateLimitStore {
  if (redisUrl) {
    return new RedisRateLimitStore(redisUrl);
  }
  return new InMemoryRateLimitStore();
}
