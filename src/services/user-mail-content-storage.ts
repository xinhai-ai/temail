import prisma from "@/lib/prisma";

type CacheEntry = {
  value: boolean;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<boolean>>();
const versions = new Map<string, number>();

function normalizeTtl(ttlMs?: number): number {
  if (typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0) {
    return Math.floor(ttlMs);
  }
  return DEFAULT_TTL_MS;
}

function nextVersion(userId: string): number {
  const value = (versions.get(userId) || 0) + 1;
  versions.set(userId, value);
  return value;
}

function currentVersion(userId: string): number {
  return versions.get(userId) || 0;
}

export async function getUserMailContentStoragePreference(userId: string, options?: { ttlMs?: number }): Promise<boolean> {
  const id = userId.trim();
  if (!id) return true;

  const ttlMs = normalizeTtl(options?.ttlMs);
  const now = Date.now();
  const cached = cache.get(id);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const existing = inFlight.get(id);
  if (existing) {
    return existing;
  }

  const requestVersion = currentVersion(id);
  const promise = prisma.user
    .findUnique({
      where: { id },
      select: { storeRawAndAttachments: true },
    })
    .then((row) => {
      const value = row?.storeRawAndAttachments ?? true;
      if (currentVersion(id) === requestVersion) {
        cache.set(id, { value, expiresAt: Date.now() + ttlMs });
      }
      return value;
    })
    .finally(() => {
      if (inFlight.get(id) === promise) {
        inFlight.delete(id);
      }
    });

  inFlight.set(id, promise);
  return promise;
}

export function setUserMailContentStoragePreferenceCache(userId: string, value: boolean, options?: { ttlMs?: number }) {
  const id = userId.trim();
  if (!id) return;

  nextVersion(id);
  cache.set(id, { value, expiresAt: Date.now() + normalizeTtl(options?.ttlMs) });
  inFlight.delete(id);
}

export function clearUserMailContentStoragePreferenceCache(userId?: string) {
  if (!userId) {
    cache.clear();
    inFlight.clear();
    versions.clear();
    return;
  }

  const id = userId.trim();
  if (!id) return;

  nextVersion(id);
  cache.delete(id);
  inFlight.delete(id);
}
