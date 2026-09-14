export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RateLimitResult {
  count: number;
}

export interface SessionStore {
  incrementRateLimit: (key: string, windowMs: number) => Promise<number>;
  sweepExpired: () => Promise<number>;
}
