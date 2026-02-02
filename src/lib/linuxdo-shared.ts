export const LINUXDO_TRUST_LEVEL_MAPPING_KEY = "linuxdo_trust_level_mapping";

export type LinuxDoTrustLevelBucket = "tl0" | "tl1" | "tl2" | "tl34";

export type LinuxDoTrustLevelBucketRule =
  | { action: "assign"; userGroupId: string }
  | { action: "reject" };

export type LinuxDoTrustLevelMapping = Record<LinuxDoTrustLevelBucket, LinuxDoTrustLevelBucketRule>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeLinuxDoTrustLevel(input: unknown): number {
  const value = typeof input === "number" ? input : typeof input === "string" ? Number(input) : NaN;
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.floor(value);
  if (rounded <= 0) return 0;
  if (rounded >= 4) return 4;
  return rounded;
}

export function linuxDoTrustLevelBucket(trustLevel: number): LinuxDoTrustLevelBucket {
  const tl = normalizeLinuxDoTrustLevel(trustLevel);
  if (tl <= 0) return "tl0";
  if (tl === 1) return "tl1";
  if (tl === 2) return "tl2";
  return "tl34";
}

export function parseLinuxDoTrustLevelMapping(raw: string | null): LinuxDoTrustLevelMapping | null {
  const text = (raw || "").trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isObject(parsed)) return null;

    const buckets: LinuxDoTrustLevelBucket[] = ["tl0", "tl1", "tl2", "tl34"];
    const mapping: Partial<LinuxDoTrustLevelMapping> = {};

    for (const bucket of buckets) {
      const rule = parsed[bucket];
      if (!isObject(rule)) return null;
      const action = rule.action;
      if (action === "reject") {
        mapping[bucket] = { action: "reject" };
        continue;
      }
      if (action === "assign") {
        const userGroupId = typeof rule.userGroupId === "string" ? rule.userGroupId.trim() : "";
        if (!userGroupId) return null;
        mapping[bucket] = { action: "assign", userGroupId };
        continue;
      }
      return null;
    }

    return mapping as LinuxDoTrustLevelMapping;
  } catch {
    return null;
  }
}

