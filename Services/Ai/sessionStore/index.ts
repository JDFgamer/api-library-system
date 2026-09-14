import type { RateLimitResult, SessionStore } from './types.js';

export type { RateLimitResult, SessionStore };

const RATE_LIMIT_MAP_MAX = 10_000;
const rateLimitCounters = new Map<string, { count: number; expiresAt: number }>();

const isExpired = (entry: { count: number; expiresAt: number }): boolean =>
  Date.now() >= entry.expiresAt;

const sweepExpired = (): number => {
  let swept = 0;
  for (const [key, entry] of rateLimitCounters) {
    if (isExpired(entry)) {
      rateLimitCounters.delete(key);
      swept += 1;
    }
  }
  return swept;
};

export const memorySessionStore: SessionStore = {
  async incrementRateLimit(key, windowMs) {
    if (rateLimitCounters.size >= RATE_LIMIT_MAP_MAX) {
      sweepExpired();
    }
    const entry = rateLimitCounters.get(key);
    if (entry && !isExpired(entry)) {
      entry.count += 1;
      return entry.count;
    }
    rateLimitCounters.set(key, { count: 1, expiresAt: Date.now() + windowMs });
    return 1;
  },

  async sweepExpired() {
    return sweepExpired();
  },
};
