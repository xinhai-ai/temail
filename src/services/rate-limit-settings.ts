import "server-only";

import type { RateLimitConfig, RateLimitResult } from "@/lib/api-rate-limit";
import { rateLimit } from "@/lib/api-rate-limit";
import {
  API_RATE_LIMIT_POLICY_MAP,
  IMAP_SYNC_DEFAULTS,
  RATE_LIMIT_SETTING_KEYS,
  RATE_LIMIT_VALIDATION,
  normalizeRateLimitInteger,
  parseApiRateLimitOverridesLoose,
} from "@/lib/rate-limit-policies";
import { getSystemSettingValue } from "@/services/system-settings";

const IMAP_CONFIG_TTL_MS = 10_000;
const API_OVERRIDE_TTL_MS = 10_000;

export type ImapSyncRateLimitConfig = {
  cooldownMs: number;
  maxSyncDurationMs: number;
};

export async function getImapSyncRateLimitConfig(): Promise<ImapSyncRateLimitConfig> {
  const [cooldownRaw, maxDurationRaw] = await Promise.all([
    getSystemSettingValue(RATE_LIMIT_SETTING_KEYS.imapSyncCooldownMs, { ttlMs: IMAP_CONFIG_TTL_MS }),
    getSystemSettingValue(RATE_LIMIT_SETTING_KEYS.imapSyncMaxDurationMs, { ttlMs: IMAP_CONFIG_TTL_MS }),
  ]);

  const cooldownMs =
    normalizeRateLimitInteger(cooldownRaw, RATE_LIMIT_VALIDATION.imapSyncCooldownMs) ?? IMAP_SYNC_DEFAULTS.cooldownMs;
  const maxSyncDurationMs =
    normalizeRateLimitInteger(maxDurationRaw, RATE_LIMIT_VALIDATION.imapSyncMaxDurationMs) ??
    IMAP_SYNC_DEFAULTS.maxSyncDurationMs;

  return {
    cooldownMs,
    maxSyncDurationMs,
  };
}

async function getApiRateLimitOverrideMap() {
  const raw = await getSystemSettingValue(RATE_LIMIT_SETTING_KEYS.apiOverrides, { ttlMs: API_OVERRIDE_TTL_MS });
  return parseApiRateLimitOverridesLoose(raw);
}

export async function rateLimitByPolicy(
  policyId: string,
  runtimeKey: string,
  defaults: RateLimitConfig
): Promise<RateLimitResult> {
  const policy = API_RATE_LIMIT_POLICY_MAP.get(policyId);
  const fallback = policy
    ? { limit: policy.defaultLimit, windowMs: policy.defaultWindowMs }
    : { ...defaults };

  const overrides = await getApiRateLimitOverrideMap();
  const override = overrides[policyId];

  const config: RateLimitConfig = {
    limit: override?.limit ?? fallback.limit,
    windowMs: override?.windowMs ?? fallback.windowMs,
  };

  return rateLimit(runtimeKey, config);
}
