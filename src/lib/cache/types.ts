export type CacheMode = "memory" | "redis";

export type KvSetOptions = {
  ttlMs?: number;
};

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
  nowMs?: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export interface KvStore {
  readonly mode: CacheMode;

  get(key: string): Promise<string | null>;
  mget(keys: string[]): Promise<Array<string | null>>;
  set(key: string, value: string, options?: KvSetOptions): Promise<void>;
  del(key: string): Promise<void>;
  delMany(keys: string[]): Promise<void>;
  clearByPrefix(prefix: string): Promise<number>;
  rateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult>;
}
