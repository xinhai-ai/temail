import "server-only";

import net from "node:net";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

type Bucket = { windowStart: number; count: number; lastSeen: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
const PRUNE_INTERVAL_MS = 60_000;
let lastPruneAt = 0;
const MAX_RATE_LIMIT_KEY_LENGTH = 200;

function maybePrune(now: number) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;

  // Drop stale buckets (not seen for 2 prune intervals).
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastSeen > PRUNE_INTERVAL_MS * 2) {
      buckets.delete(key);
    }
  }

  // Hard cap to avoid unbounded memory in worst-case attacks.
  if (buckets.size > MAX_BUCKETS) {
    // Best-effort: remove oldest entries first.
    const entries = Array.from(buckets.entries()).sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    const toRemove = buckets.size - MAX_BUCKETS;
    for (let i = 0; i < toRemove; i += 1) {
      buckets.delete(entries[i]?.[0] as string);
    }
  }
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const safeKey =
    typeof key === "string" && key.length > MAX_RATE_LIMIT_KEY_LENGTH
      ? key.slice(0, MAX_RATE_LIMIT_KEY_LENGTH)
      : key;
  const now = Date.now();
  maybePrune(now);

  const limit = Math.max(1, Math.floor(config.limit));
  const windowMs = Math.max(1, Math.floor(config.windowMs));

  const existing = buckets.get(safeKey);
  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(safeKey, { windowStart: now, count: 1, lastSeen: now });
    return { allowed: true };
  }

  existing.lastSeen = now;
  if (existing.count >= limit) {
    const retryAfterMs = Math.max(0, windowMs - (now - existing.windowStart));
    return { allowed: false, retryAfterMs };
  }

  existing.count += 1;
  return { allowed: true };
}

function normalizeIp(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 100) return null;

  const bracketMatch = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch) {
    const inside = bracketMatch[1]?.trim() || "";
    return net.isIP(inside) ? inside : null;
  }

  // Handle common IPv4:port format.
  const ipv4PortMatch = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4PortMatch) {
    const ip = ipv4PortMatch[1] || "";
    return net.isIP(ip) ? ip : null;
  }

  return net.isIP(trimmed) ? trimmed : null;
}

function firstForwardedIp(value: string) {
  const first = value.split(",")[0]?.trim();
  return first ? normalizeIp(first) : null;
}

export function getClientIp(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) {
    const parsed = normalizeIp(cf);
    if (parsed) return parsed;
  }

  const real = request.headers.get("x-real-ip");
  if (real) {
    const parsed = normalizeIp(real);
    if (parsed) return parsed;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return firstForwardedIp(forwarded);

  return null;
}
