import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getCacheNamespace } from "@/lib/cache";

export const runtime = "nodejs";

type Provider = "google" | "im";
type ProviderMode = Provider | "auto";

type CacheEntry =
  | {
      ok: true;
      buffer: Buffer;
      contentType: string;
      provider: Provider;
    }
  | { ok: false };

type CachedEntry =
  | {
      ok: true;
      contentType: string;
      provider: Provider;
      bodyBase64: string;
    }
  | { ok: false };

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ICON_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 5_000;

const faviconCache = getCacheNamespace("favicons");
const inflight = new Map<string, Promise<CacheEntry>>();

const querySchema = z.object({
  domain: z.string().trim().min(1).max(253),
  size: z.coerce.number().int().min(16).max(256).optional().default(64),
  provider: z.enum(["auto", "google", "im"]).optional().default("auto"),
});

function normalizeDomain(input: string): string | null {
  const value = input.trim().toLowerCase().replace(/\.$/, "");
  if (!value) return null;
  if (value.includes("/") || value.includes("\\") || value.includes("@")) return null;
  if (!/^[a-z0-9.-]+$/.test(value)) return null;
  if (value.length > 253) return null;
  return value;
}

async function getCache(key: string): Promise<CacheEntry | null> {
  const entry = await faviconCache.getJson<CachedEntry>(key);
  if (!entry) return null;
  if (!entry.ok) return { ok: false };

  const buffer = Buffer.from(entry.bodyBase64, "base64");
  if (buffer.length === 0 || buffer.length > MAX_ICON_BYTES) {
    await faviconCache.del(key);
    return null;
  }

  return {
    ok: true,
    buffer,
    contentType: entry.contentType,
    provider: entry.provider,
  };
}

async function setCache(key: string, entry: CacheEntry) {
  if (!entry.ok) {
    await faviconCache.setJson(key, entry, { ttlMs: NEGATIVE_CACHE_TTL_MS });
    return;
  }

  await faviconCache.setJson<CachedEntry>(
    key,
    {
      ok: true,
      contentType: entry.contentType,
      provider: entry.provider,
      bodyBase64: entry.buffer.toString("base64"),
    },
    { ttlMs: CACHE_TTL_MS }
  );
}

function buildCacheControl(maxAgeSeconds: number) {
  const staleSeconds = Math.min(30 * 24 * 60 * 60, maxAgeSeconds * 4);
  return `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleSeconds}`;
}

function buildGoogleUrl(domain: string, size: number) {
  const url = new URL("https://www.google.com/s2/favicons");
  url.searchParams.set("domain", domain);
  url.searchParams.set("sz", String(size));
  return url.toString();
}

function buildFaviconImUrl(domain: string, size: number) {
  const url = new URL(`https://favicon.im/${domain}`);
  if (size > 16) {
    url.searchParams.set("larger", "true");
  }
  return url.toString();
}

async function fetchFromProvider(provider: Provider, domain: string, size: number, signal: AbortSignal) {
  const url = provider === "google" ? buildGoogleUrl(domain, size) : buildFaviconImUrl(domain, size);
  const res = await fetch(url, {
    signal,
    headers: { Accept: "image/*" },
  });

  if (!res.ok) {
    return null;
  }

  const contentType = res.headers.get("content-type") || "image/png";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return null;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_ICON_BYTES) {
    return null;
  }

  return { buffer, contentType };
}

async function resolveFavicon(domain: string, size: number, mode: ProviderMode): Promise<CacheEntry> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const order: Provider[] =
      mode === "auto"
        ? size >= 64
          ? ["im", "google"]
          : ["google", "im"]
        : [mode];

    for (const provider of order) {
      try {
        const result = await fetchFromProvider(provider, domain, size, controller.signal);
        if (!result) continue;
        return {
          ok: true,
          buffer: result.buffer,
          contentType: result.contentType,
          provider,
        };
      } catch {
        // ignore and fall back
      }
    }

    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function getOrFetch(key: string, fetcher: () => Promise<CacheEntry>) {
  const cached = await getCache(key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetcher()
    .then(async (entry) => {
      await setCache(key, entry);
      return entry;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    domain: searchParams.get("domain") || "",
    size: searchParams.get("size") || undefined,
    provider: searchParams.get("provider") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const domain = normalizeDomain(parsed.data.domain);
  if (!domain) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const size = parsed.data.size;
  const provider = parsed.data.provider;
  const key = `${provider}:${size}:${domain}`;

  const entry = await getOrFetch(key, () => resolveFavicon(domain, size, provider));

  if (!entry.ok) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": buildCacheControl(Math.floor(NEGATIVE_CACHE_TTL_MS / 1000)),
      },
    });
  }

  const body = new Uint8Array(entry.buffer);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": entry.contentType,
      "Cache-Control": buildCacheControl(Math.floor(CACHE_TTL_MS / 1000)),
      "X-Favicon-Provider": entry.provider,
    },
  });
}
