import { createClient } from "redis";
import type { KvSetOptions, KvStore, RateLimitConfig, RateLimitResult } from "./types";

type RedisKvStoreOptions = {
  url: string;
};

type RedisClient = ReturnType<typeof createClient>;

const RATE_LIMIT_LUA = `
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local bucketTtlMs = windowMs * 2

if not limit or limit < 1 then
  limit = 1
end
if not windowMs or windowMs < 1 then
  windowMs = 1
  bucketTtlMs = 2
end

local existingWindowStart = redis.call("HGET", KEYS[1], "windowStart")
local existingCount = redis.call("HGET", KEYS[1], "count")

if (not existingWindowStart) or (not existingCount) then
  redis.call("HSET", KEYS[1], "windowStart", now, "count", 1, "lastSeen", now)
  redis.call("PEXPIRE", KEYS[1], bucketTtlMs)
  return {1, 0}
end

local windowStart = tonumber(existingWindowStart)
local count = tonumber(existingCount)

if (not windowStart) or (not count) or ((now - windowStart) >= windowMs) then
  redis.call("HSET", KEYS[1], "windowStart", now, "count", 1, "lastSeen", now)
  redis.call("PEXPIRE", KEYS[1], bucketTtlMs)
  return {1, 0}
end

redis.call("HSET", KEYS[1], "lastSeen", now)
redis.call("PEXPIRE", KEYS[1], bucketTtlMs)

if count >= limit then
  local retryAfterMs = windowMs - (now - windowStart)
  if retryAfterMs < 0 then
    retryAfterMs = 0
  end
  return {0, retryAfterMs}
end

count = count + 1
redis.call("HSET", KEYS[1], "count", count)
return {1, 0}
`;

export class RedisKvStore implements KvStore {
  readonly mode = "redis" as const;
  private readonly url: string;
  private client: RedisClient | null = null;
  private connectPromise: Promise<void> | null = null;

  constructor(options: RedisKvStoreOptions) {
    this.url = options.url;
  }

  async connect(): Promise<void> {
    if (this.client?.isReady) return;
    if (this.connectPromise) {
      await this.connectPromise;
      return;
    }

    this.connectPromise = (async () => {
      const client = createClient({ url: this.url });
      client.on("error", (error) => {
        console.error("[cache] redis client error:", error);
      });
      await client.connect();
      this.client = client;
    })().finally(() => {
      this.connectPromise = null;
    });

    await this.connectPromise;
  }

  async get(key: string): Promise<string | null> {
    const client = await this.getClient();
    return client.get(key);
  }

  async mget(keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) return [];
    const client = await this.getClient();
    return client.mGet(keys);
  }

  async set(key: string, value: string, options?: KvSetOptions): Promise<void> {
    const client = await this.getClient();
    const ttlMs = normalizeTtl(options?.ttlMs);
    if (ttlMs === null) {
      await client.set(key, value);
      return;
    }
    await client.set(key, value, { PX: ttlMs });
  }

  async del(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(key);
  }

  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const client = await this.getClient();
    await client.del(keys);
  }

  async clearByPrefix(prefix: string): Promise<number> {
    if (!prefix) return 0;
    const client = await this.getClient();
    let cursor = "0";
    let removed = 0;

    do {
      const result = await client.scan(cursor, {
        MATCH: `${prefix}*`,
        COUNT: 200,
      });
      cursor = result.cursor;
      if (!result.keys.length) continue;
      removed += await client.del(result.keys);
    } while (cursor !== "0");

    return removed;
  }

  async rateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = normalizeNow(config.nowMs);
    const limit = normalizeRateLimitValue(config.limit, 1);
    const windowMs = normalizeRateLimitValue(config.windowMs, 1);
    const client = await this.getClient();

    const raw = await client.eval(RATE_LIMIT_LUA, {
      keys: [key],
      arguments: [String(now), String(limit), String(windowMs)],
    });

    if (!Array.isArray(raw)) {
      throw new Error("[cache] unexpected redis rate-limit response");
    }

    const allowed = Number(raw[0]) === 1;
    if (allowed) {
      return { allowed: true };
    }

    const retryAfterMs = Number(raw[1]);
    return {
      allowed: false,
      retryAfterMs: Number.isFinite(retryAfterMs) ? Math.max(0, Math.floor(retryAfterMs)) : 0,
    };
  }

  private async getClient(): Promise<RedisClient> {
    if (!this.client?.isReady) {
      await this.connect();
    }
    if (!this.client?.isReady) {
      throw new Error("[cache] redis client is not ready");
    }
    return this.client;
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
