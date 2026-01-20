import prisma from "@/lib/prisma";

type CacheEntry = { value: string | null; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 30_000;

export async function getSystemSettingValue(key: string, options?: { ttlMs?: number }): Promise<string | null> {
  const ttlMs = typeof options?.ttlMs === "number" && options.ttlMs > 0 ? options.ttlMs : DEFAULT_TTL_MS;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const row = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });

  const value = row?.value ?? null;
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function clearSystemSettingCache(key?: string) {
  if (!key) {
    cache.clear();
    return;
  }
  cache.delete(key);
}

