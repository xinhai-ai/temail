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
  const now = Date.now();
  maybePrune(now);

  const limit = Math.max(1, Math.floor(config.limit));
  const windowMs = Math.max(1, Math.floor(config.windowMs));

  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1, lastSeen: now });
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

function firstForwardedIp(value: string) {
  const first = value.split(",")[0]?.trim();
  return first || null;
}

export function getClientIp(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim() || null;

  const real = request.headers.get("x-real-ip");
  if (real) return real.trim() || null;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return firstForwardedIp(forwarded);

  return null;
}

