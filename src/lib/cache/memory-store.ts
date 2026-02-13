import type { KvSetOptions, KvStore, RateLimitConfig, RateLimitResult } from "./types";

type CacheEntry = {
  value: string;
  expiresAt: number | null;
};

type RateLimitBucket = {
  windowStart: number;
  count: number;
  lastSeen: number;
  expiresAt: number;
};

type MemoryKvStoreOptions = {
  maxEntries: number;
  maxRateLimitBuckets?: number;
};

export class MemoryKvStore implements KvStore {
  readonly mode = "memory" as const;

  private readonly data = new Map<string, CacheEntry>();
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly maxEntries: number;
  private readonly maxRateLimitBuckets: number;

  constructor(options: MemoryKvStoreOptions) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries));
    this.maxRateLimitBuckets = Math.max(
      1_000,
      Math.floor(options.maxRateLimitBuckets ?? Math.max(options.maxEntries, 10_000))
    );
  }

  async get(key: string): Promise<string | null> {
    const now = Date.now();
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      this.data.delete(key);
      return null;
    }

    // Refresh insertion order for lightweight LRU behavior.
    this.data.delete(key);
    this.data.set(key, entry);
    return entry.value;
  }

  async mget(keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) return [];
    const values = await Promise.all(keys.map((key) => this.get(key)));
    return values;
  }

  async set(key: string, value: string, options?: KvSetOptions): Promise<void> {
    const ttlMs = normalizeTtl(options?.ttlMs);
    this.data.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
    this.evictExpiredKeys();
    this.enforceEntryLimit();
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }

  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    for (const key of keys) {
      this.data.delete(key);
    }
  }

  async clearByPrefix(prefix: string): Promise<number> {
    if (!prefix) return 0;
    let removed = 0;
    for (const key of this.data.keys()) {
      if (!key.startsWith(prefix)) continue;
      this.data.delete(key);
      removed += 1;
    }
    return removed;
  }

  async rateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = normalizeNow(config.nowMs);
    const limit = normalizeRateLimitValue(config.limit, 1);
    const windowMs = normalizeRateLimitValue(config.windowMs, 1);
    const bucketTtlMs = windowMs * 2;

    this.pruneRateLimitBuckets(now);

    const existing = this.buckets.get(key);
    if (!existing || now - existing.windowStart >= windowMs) {
      this.buckets.set(key, {
        windowStart: now,
        count: 1,
        lastSeen: now,
        expiresAt: now + bucketTtlMs,
      });
      this.enforceRateLimitBucketLimit();
      return { allowed: true };
    }

    existing.lastSeen = now;
    existing.expiresAt = now + bucketTtlMs;

    if (existing.count >= limit) {
      const retryAfterMs = Math.max(0, windowMs - (now - existing.windowStart));
      return { allowed: false, retryAfterMs };
    }

    existing.count += 1;
    return { allowed: true };
  }

  private evictExpiredKeys() {
    const now = Date.now();
    for (const [key, entry] of this.data) {
      if (entry.expiresAt === null || entry.expiresAt > now) continue;
      this.data.delete(key);
    }
  }

  private enforceEntryLimit() {
    while (this.data.size > this.maxEntries) {
      const oldestKey = this.data.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.data.delete(oldestKey);
    }
  }

  private pruneRateLimitBuckets(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.expiresAt > now) continue;
      this.buckets.delete(key);
    }
  }

  private enforceRateLimitBucketLimit() {
    if (this.buckets.size <= this.maxRateLimitBuckets) return;
    const entries = Array.from(this.buckets.entries()).sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    const toRemove = this.buckets.size - this.maxRateLimitBuckets;
    for (let i = 0; i < toRemove; i += 1) {
      const key = entries[i]?.[0];
      if (!key) continue;
      this.buckets.delete(key);
    }
  }
}

function normalizeTtl(ttlMs: number | undefined): number | null {
  if (typeof ttlMs !== "number" || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    return null;
  }
  return Math.floor(ttlMs);
}

function normalizeNow(nowMs: number | undefined): number {
  if (typeof nowMs === "number" && Number.isFinite(nowMs)) {
    return Math.floor(nowMs);
  }
  return Date.now();
}

function normalizeRateLimitValue(value: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(fallback, Math.floor(value));
}
