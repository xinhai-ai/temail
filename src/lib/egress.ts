import "server-only";

import { lookup } from "node:dns/promises";
import net from "node:net";

type EgressUrlValidationSuccess = { ok: true; url: URL };
type EgressUrlValidationFailure = { ok: false; error: string };
export type EgressUrlValidationResult =
  | EgressUrlValidationSuccess
  | EgressUrlValidationFailure;

const HOSTNAME_CACHE_TTL_MS = 5 * 60_000;
const hostnameCache = new Map<
  string,
  { ok: boolean; reason?: string; expiresAt: number }
>();

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT

  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true; // unspecified / loopback
  const mappedIpv4 = extractMappedIpv4(normalized);
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 unique local
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true; // fe80::/10 link-local
  }
  return false;
}

function extractMappedIpv4(ipv6: string): string | null {
  // Support IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1 or ::ffff:7f00:1
  const dottedMatch = ipv6.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (dottedMatch) {
    const candidate = dottedMatch[1] || "";
    const parts = candidate.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    return parts.join(".");
  }

  const hexMatch = ipv6.match(/(?:^|:)ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexMatch) {
    const hi = Number.parseInt(hexMatch[1] || "", 16);
    const lo = Number.parseInt(hexMatch[2] || "", 16);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
    const a = (hi >> 8) & 0xff;
    const b = hi & 0xff;
    const c = (lo >> 8) & 0xff;
    const d = lo & 0xff;
    return `${a}.${b}.${c}.${d}`;
  }

  return null;
}

function isPrivateIpAddress(ip: string) {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateIpv4(ip);
  if (kind === 6) return isPrivateIpv6(ip);
  return true;
}

async function isAllowedHostname(hostname: string): Promise<{ ok: boolean; reason?: string }> {
  const now = Date.now();
  const cached = hostnameCache.get(hostname);
  if (cached && cached.expiresAt > now) {
    return { ok: cached.ok, reason: cached.reason };
  }

  const lowered = hostname.toLowerCase();
  if (lowered === "localhost" || lowered.endsWith(".localhost") || lowered.endsWith(".local")) {
    hostnameCache.set(hostname, { ok: false, reason: "Local hostnames are not allowed", expiresAt: now + HOSTNAME_CACHE_TTL_MS });
    return { ok: false, reason: "Local hostnames are not allowed" };
  }

  if (net.isIP(lowered)) {
    const ok = !isPrivateIpAddress(lowered);
    const reason = ok ? undefined : "Private or loopback IPs are not allowed";
    hostnameCache.set(hostname, { ok, reason, expiresAt: now + HOSTNAME_CACHE_TTL_MS });
    return { ok, reason };
  }

  try {
    const addresses = await lookup(lowered, { all: true, verbatim: true });
    if (!addresses.length) {
      hostnameCache.set(hostname, { ok: false, reason: "Hostname did not resolve", expiresAt: now + HOSTNAME_CACHE_TTL_MS });
      return { ok: false, reason: "Hostname did not resolve" };
    }

    for (const entry of addresses) {
      if (isPrivateIpAddress(entry.address)) {
        hostnameCache.set(hostname, { ok: false, reason: "Hostname resolves to a private IP", expiresAt: now + HOSTNAME_CACHE_TTL_MS });
        return { ok: false, reason: "Hostname resolves to a private IP" };
      }
    }
  } catch {
    hostnameCache.set(hostname, { ok: false, reason: "Hostname resolution failed", expiresAt: now + HOSTNAME_CACHE_TTL_MS });
    return { ok: false, reason: "Hostname resolution failed" };
  }

  hostnameCache.set(hostname, { ok: true, expiresAt: now + HOSTNAME_CACHE_TTL_MS });
  return { ok: true };
}

export async function validateEgressUrl(input: unknown): Promise<EgressUrlValidationResult> {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "URL must be a non-empty string" };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Only http/https URLs are allowed" };
  }

  if (url.protocol === "http:" && process.env.NODE_ENV === "production") {
    return { ok: false, error: "HTTP is not allowed in production" };
  }

  const { ok, reason } = await isAllowedHostname(url.hostname);
  if (!ok) {
    return { ok: false, error: reason || "Hostname is not allowed" };
  }

  return { ok: true, url };
}

export const DEFAULT_EGRESS_TIMEOUT_MS = 10_000;
