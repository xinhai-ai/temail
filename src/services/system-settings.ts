import prisma from "@/lib/prisma";
import { getCacheNamespace } from "@/lib/cache";

type CacheEntry = { value: string | null };

const DEFAULT_TTL_MS = 30_000;
const cache = getCacheNamespace("system-settings");

export async function getSystemSettingValue(key: string, options?: { ttlMs?: number }): Promise<string | null> {
  const ttlMs = typeof options?.ttlMs === "number" && options.ttlMs > 0 ? options.ttlMs : DEFAULT_TTL_MS;
  const cached = await cache.getJson<CacheEntry>(key);
  if (cached) return cached.value;

  const row = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });

  const value = row?.value ?? null;
  await cache.setJson(key, { value }, { ttlMs });
  return value;
}

export async function clearSystemSettingCache(key?: string) {
  if (!key) {
    await cache.clear();
    return;
  }
  await cache.del(key);
}
