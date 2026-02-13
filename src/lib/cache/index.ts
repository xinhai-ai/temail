import "server-only";

import { MemoryKvStore } from "./memory-store";
import { RedisKvStore } from "./redis-store";
import type { CacheMode, KvSetOptions, KvStore, RateLimitConfig, RateLimitResult } from "./types";

const DEFAULT_CACHE_PREFIX = "temail";
const DEFAULT_MEMORY_MAX_ENTRIES = 10_000;
const SINGLEFLIGHT_MAX_KEY_LENGTH = 500;

const cacheMode = parseCacheMode(process.env.CACHE_MODE);
const cachePrefix = normalizeSegment(process.env.CACHE_PREFIX, DEFAULT_CACHE_PREFIX, "CACHE_PREFIX");
const memoryMaxEntries = parsePositiveInteger(
  process.env.CACHE_MEMORY_MAX_ENTRIES,
  DEFAULT_MEMORY_MAX_ENTRIES,
  "CACHE_MEMORY_MAX_ENTRIES"
);

let storePromise: Promise<KvStore> | null = null;
const namespaceCache = new Map<string, ScopedCache>();
const singleflightMap = new Map<string, Promise<unknown>>();

export type { CacheMode, KvSetOptions, RateLimitConfig, RateLimitResult } from "./types";

class ScopedCache {
  private readonly rootPrefix: string;

  constructor(private readonly namespace: string) {
    this.rootPrefix = `${cachePrefix}:${namespace}:`;
  }

  async getText(key: string): Promise<string | null> {
    const store = await getStore();
    return store.get(this.buildKey(key));
  }

  async mgetText(keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) return [];
    const store = await getStore();
    const fullKeys = keys.map((key) => this.buildKey(key));
    return store.mget(fullKeys);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.getText(key);
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      await this.del(key);
      return null;
    }
  }

  async setText(key: string, value: string, options?: KvSetOptions): Promise<void> {
    const store = await getStore();
    await store.set(this.buildKey(key), value, options);
  }

  async setJson<T>(key: string, value: T, options?: KvSetOptions): Promise<void> {
    await this.setText(key, JSON.stringify(value), options);
  }

  async setBuffer(key: string, value: Buffer, options?: KvSetOptions): Promise<void> {
    await this.setText(key, value.toString("base64"), options);
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    const raw = await this.getText(key);
    if (raw === null) return null;
    try {
      return Buffer.from(raw, "base64");
    } catch {
      await this.del(key);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    const store = await getStore();
    await store.del(this.buildKey(key));
  }

  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const store = await getStore();
    const fullKeys = keys.map((key) => this.buildKey(key));
    await store.delMany(fullKeys);
  }

  async clear(): Promise<number> {
    const store = await getStore();
    return store.clearByPrefix(this.rootPrefix);
  }

  async withSingleflight<T>(key: string, resolver: () => Promise<T>): Promise<T> {
    const scopedKey = this.buildSingleflightKey(key);
    const existing = singleflightMap.get(scopedKey) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = resolver().finally(() => {
      if (singleflightMap.get(scopedKey) === promise) {
        singleflightMap.delete(scopedKey);
      }
    });

    singleflightMap.set(scopedKey, promise);
    return promise;
  }

  async rateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const store = await getStore();
    return store.rateLimit(this.buildKey(key), config);
  }

  private buildKey(key: string): string {
    if (!key) {
      throw new Error(`[cache] empty key for namespace ${this.namespace}`);
    }
    return `${this.rootPrefix}${key}`;
  }

  private buildSingleflightKey(key: string): string {
    const full = this.buildKey(key);
    if (full.length <= SINGLEFLIGHT_MAX_KEY_LENGTH) return full;
    return full.slice(0, SINGLEFLIGHT_MAX_KEY_LENGTH);
  }
}

export function getCacheMode(): CacheMode {
  return cacheMode;
}

export function getCacheNamespace(namespace: string) {
  const value = normalizeSegment(namespace, "", "cache namespace");
  const existing = namespaceCache.get(value);
  if (existing) return existing;
  const created = new ScopedCache(value);
  namespaceCache.set(value, created);
  return created;
}

export async function initializeCache(): Promise<void> {
  await getStore();
}

async function getStore(): Promise<KvStore> {
  if (!storePromise) {
    storePromise = createStore().catch((error) => {
      storePromise = null;
      throw error;
    });
  }
  return storePromise;
}

async function createStore(): Promise<KvStore> {
  if (cacheMode === "memory") {
    return new MemoryKvStore({ maxEntries: memoryMaxEntries });
  }

  const redisUrl = process.env.CACHE_REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error("[cache] CACHE_REDIS_URL is required when CACHE_MODE=redis");
  }

  const store = new RedisKvStore({ url: redisUrl });
  await store.connect();
  return store;
}

function parseCacheMode(raw: string | undefined): CacheMode {
  const mode = (raw || "memory").trim().toLowerCase();
  if (mode === "memory" || mode === "redis") {
    return mode;
  }
  throw new Error(`[cache] invalid CACHE_MODE value: ${raw}`);
}

function parsePositiveInteger(raw: string | undefined, fallback: number, key: string): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`[cache] ${key} must be a positive number`);
  }
  return Math.floor(parsed);
}

function normalizeSegment(raw: string | undefined, fallback: string, key: string): string {
  const value = (raw ?? fallback).trim();
  if (!value) {
    throw new Error(`[cache] ${key} cannot be empty`);
  }
  if (value.includes(":")) {
    throw new Error(`[cache] ${key} cannot contain ":"`);
  }
  return value;
}
