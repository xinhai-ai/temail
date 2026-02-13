import "server-only";

import net from "node:net";
import { getCacheNamespace } from "@/lib/cache";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

const rateLimitCache = getCacheNamespace("api-rate-limit");
const MAX_RATE_LIMIT_KEY_LENGTH = 200;

export async function rateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const safeKey =
    typeof key === "string" && key.length > MAX_RATE_LIMIT_KEY_LENGTH
      ? key.slice(0, MAX_RATE_LIMIT_KEY_LENGTH)
      : key;
  return rateLimitCache.rateLimit(safeKey, config);
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
