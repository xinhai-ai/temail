export const RATE_LIMIT_SETTING_KEYS = {
  imapSyncCooldownMs: "rate_limit_imap_sync_cooldown_ms",
  imapSyncMaxDurationMs: "rate_limit_imap_sync_max_duration_ms",
  apiOverrides: "rate_limit_api_overrides_v1",
} as const;

export const IMAP_SYNC_DEFAULTS = {
  cooldownMs: 30_000,
  maxSyncDurationMs: 5 * 60_000,
} as const;

export const RATE_LIMIT_VALIDATION = {
  imapSyncCooldownMs: { min: 1_000, max: 3_600_000 },
  imapSyncMaxDurationMs: { min: 10_000, max: 7_200_000 },
  apiLimit: { min: 1, max: 100_000 },
  apiWindowMs: { min: 1_000, max: 86_400_000 },
} as const;

export type ApiRateLimitPolicy = {
  id: string;
  defaultLimit: number;
  defaultWindowMs: number;
};

export type ApiRateLimitOverride = {
  limit?: number;
  windowMs?: number;
};

export type ApiRateLimitOverrideMap = Record<string, ApiRateLimitOverride>;

export const API_RATE_LIMIT_POLICIES: ApiRateLimitPolicy[] = [
  { id: "admin.smtp.test", defaultLimit: 10, defaultWindowMs: 60_000 },
  { id: "admin.users.read", defaultLimit: 120, defaultWindowMs: 60_000 },
  { id: "admin.users.update", defaultLimit: 60, defaultWindowMs: 60_000 },
  { id: "admin.users.delete", defaultLimit: 10, defaultWindowMs: 60_000 },
  { id: "admin.users.bulk", defaultLimit: 30, defaultWindowMs: 60_000 },
  { id: "admin.users.list", defaultLimit: 60, defaultWindowMs: 60_000 },
  { id: "auth.login", defaultLimit: 30, defaultWindowMs: 10 * 60_000 },
  { id: "auth.otp", defaultLimit: 20, defaultWindowMs: 10 * 60_000 },
  { id: "auth.passkey.begin", defaultLimit: 30, defaultWindowMs: 10 * 60_000 },
  { id: "auth.passkey.finish", defaultLimit: 30, defaultWindowMs: 10 * 60_000 },
  { id: "auth.password.forgot", defaultLimit: 10, defaultWindowMs: 10 * 60_000 },
  { id: "auth.password.forgot.email", defaultLimit: 1, defaultWindowMs: 60_000 },
  { id: "auth.password.reset", defaultLimit: 30, defaultWindowMs: 10 * 60_000 },
  { id: "auth.register", defaultLimit: 20, defaultWindowMs: 10 * 60_000 },
  { id: "auth.verifyEmail", defaultLimit: 60, defaultWindowMs: 10 * 60_000 },
  { id: "auth.verifyEmail.resend.ip", defaultLimit: 20, defaultWindowMs: 10 * 60_000 },
  { id: "auth.verifyEmail.resend.email", defaultLimit: 1, defaultWindowMs: 60_000 },
  { id: "emailChange.confirm.ip", defaultLimit: 60, defaultWindowMs: 10 * 60_000 },
  { id: "emailChange.request.user", defaultLimit: 5, defaultWindowMs: 10 * 60_000 },
  { id: "emailChange.request.ip", defaultLimit: 20, defaultWindowMs: 10 * 60_000 },
  { id: "emailChange.request.email", defaultLimit: 1, defaultWindowMs: 60_000 },
  { id: "openApi.keys.list", defaultLimit: 120, defaultWindowMs: 60_000 },
  { id: "openApi.keys.create", defaultLimit: 30, defaultWindowMs: 60_000 },
  { id: "openApi.keys.update", defaultLimit: 60, defaultWindowMs: 60_000 },
  { id: "openApi.keys.delete", defaultLimit: 30, defaultWindowMs: 60_000 },
  { id: "telegram.bindCode", defaultLimit: 20, defaultWindowMs: 10 * 60_000 },
  { id: "telegram.linkCode", defaultLimit: 20, defaultWindowMs: 10 * 60_000 },
  { id: "telegram.webhook", defaultLimit: 3_000, defaultWindowMs: 60_000 },
  { id: "users.me.update", defaultLimit: 30, defaultWindowMs: 60_000 },
  { id: "users.otp.setup", defaultLimit: 10, defaultWindowMs: 10 * 60_000 },
  { id: "users.otp.disable", defaultLimit: 10, defaultWindowMs: 10 * 60_000 },
  { id: "users.otp.confirm", defaultLimit: 20, defaultWindowMs: 10 * 60_000 },
  { id: "users.passkey.registration.begin", defaultLimit: 20, defaultWindowMs: 10 * 60_000 },
  { id: "users.passkey.registration.finish", defaultLimit: 30, defaultWindowMs: 10 * 60_000 },
  { id: "webhook.incoming.ip", defaultLimit: 600, defaultWindowMs: 60_000 },
  { id: "webhook.incoming.domain", defaultLimit: 3_000, defaultWindowMs: 60_000 },
  { id: "workflows.testForward", defaultLimit: 60, defaultWindowMs: 60_000 },
];

const API_RATE_LIMIT_POLICY_ID_SET = new Set(API_RATE_LIMIT_POLICIES.map((item) => item.id));

export const API_RATE_LIMIT_POLICY_MAP = new Map(API_RATE_LIMIT_POLICIES.map((item) => [item.id, item]));

type NumberRange = { min: number; max: number };

export function normalizeRateLimitInteger(value: unknown, range: NumberRange): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const intValue = Math.floor(parsed);
  if (intValue < range.min || intValue > range.max) return null;
  return intValue;
}

export function parseApiRateLimitOverridesLoose(raw: string | null | undefined): ApiRateLimitOverrideMap {
  if (!raw || !raw.trim()) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: ApiRateLimitOverrideMap = {};
    for (const [policyId, candidate] of Object.entries(parsed as Record<string, unknown>)) {
      if (!API_RATE_LIMIT_POLICY_ID_SET.has(policyId)) continue;
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;

      const overrideSource = candidate as Record<string, unknown>;
      const override: ApiRateLimitOverride = {};

      const limit = normalizeRateLimitInteger(overrideSource.limit, RATE_LIMIT_VALIDATION.apiLimit);
      const windowMs = normalizeRateLimitInteger(overrideSource.windowMs, RATE_LIMIT_VALIDATION.apiWindowMs);

      if (typeof limit === "number") {
        override.limit = limit;
      }

      if (typeof windowMs === "number") {
        override.windowMs = windowMs;
      }

      if (Object.keys(override).length > 0) {
        result[policyId] = override;
      }
    }

    return result;
  } catch {
    return {};
  }
}

export function validateApiRateLimitOverridesStrict(raw: string | null | undefined):
  | { ok: true; value: ApiRateLimitOverrideMap }
  | { ok: false; error: string } {
  if (!raw || !raw.trim()) {
    return { ok: true, value: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Rate limit API overrides must be valid JSON" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Rate limit API overrides must be an object" };
  }

  const result: ApiRateLimitOverrideMap = {};

  for (const [policyId, candidate] of Object.entries(parsed as Record<string, unknown>)) {
    if (!API_RATE_LIMIT_POLICY_ID_SET.has(policyId)) {
      return { ok: false, error: `Unknown rate limit policy: ${policyId}` };
    }

    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return { ok: false, error: `Policy ${policyId} must be an object` };
    }

    const overrideSource = candidate as Record<string, unknown>;
    const unsupportedField = Object.keys(overrideSource).find((key) => key !== "limit" && key !== "windowMs");
    if (unsupportedField) {
      return { ok: false, error: `Policy ${policyId} has unsupported field: ${unsupportedField}` };
    }

    const override: ApiRateLimitOverride = {};

    if ("limit" in overrideSource) {
      const limit = normalizeRateLimitInteger(overrideSource.limit, RATE_LIMIT_VALIDATION.apiLimit);
      if (limit === null) {
        return {
          ok: false,
          error: `Policy ${policyId} limit must be an integer between ${RATE_LIMIT_VALIDATION.apiLimit.min} and ${RATE_LIMIT_VALIDATION.apiLimit.max}`,
        };
      }
      override.limit = limit;
    }

    if ("windowMs" in overrideSource) {
      const windowMs = normalizeRateLimitInteger(overrideSource.windowMs, RATE_LIMIT_VALIDATION.apiWindowMs);
      if (windowMs === null) {
        return {
          ok: false,
          error: `Policy ${policyId} windowMs must be an integer between ${RATE_LIMIT_VALIDATION.apiWindowMs.min} and ${RATE_LIMIT_VALIDATION.apiWindowMs.max}`,
        };
      }
      override.windowMs = windowMs;
    }

    if (Object.keys(override).length > 0) {
      result[policyId] = override;
    }
  }

  return { ok: true, value: result };
}
