import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import { readJsonBody } from "@/lib/request";
import { isTurnstileDevBypassEnabled } from "@/lib/turnstile";
import { clearSystemSettingCache } from "@/services/system-settings";
import { LINUXDO_TRUST_LEVEL_MAPPING_KEY, parseLinuxDoTrustLevelMapping } from "@/lib/linuxdo";
import {
  RATE_LIMIT_SETTING_KEYS,
  RATE_LIMIT_VALIDATION,
  normalizeRateLimitInteger,
  validateApiRateLimitOverridesStrict,
} from "@/lib/rate-limit-policies";

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  type: z.string().optional(),
  description: z.string().nullable().optional(),
});

function parseBoolean(value: string | undefined | null): boolean {
  const raw = (value || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  const secretKeys = new Set([
    "smtp_pass",
    "ai_classifier_api_key",
    "ai_rewrite_api_key",
    "ai_provider_api_key",
    "turnstile_secret_key",
    "telegram_bot_token",
    "telegram_webhook_secret",
    "auth_provider_github_client_secret",
    "auth_provider_linuxdo_client_secret",
  ]);
  const safeSettings = settings.map((row) =>
    secretKeys.has(row.key)
      ? { ...row, value: "", masked: Boolean(row.value) }
      : row
  );

  return NextResponse.json(safeSettings);
}

export async function PUT(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 1_000_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }
  const body = bodyResult.data;

  try {
    const items = Array.isArray(body) ? body : [body];
    const data = items.map((item) => settingSchema.parse(item));

    const keysToValidate = new Set([
      "turnstile_enabled",
      "turnstile_site_key",
      "turnstile_secret_key",
      "auth_email_verification_enabled",
      "auth_password_reset_enabled",
      "auth_provider_github_enabled",
      "auth_provider_github_client_id",
      "auth_provider_github_client_secret",
      "auth_provider_linuxdo_enabled",
      "auth_provider_linuxdo_client_id",
      "auth_provider_linuxdo_client_secret",
      LINUXDO_TRUST_LEVEL_MAPPING_KEY,
      RATE_LIMIT_SETTING_KEYS.imapSyncCooldownMs,
      RATE_LIMIT_SETTING_KEYS.imapSyncMaxDurationMs,
      RATE_LIMIT_SETTING_KEYS.apiOverrides,
    ]);

    const wantsValidation = data.some((item) => keysToValidate.has(item.key));
    if (wantsValidation) {
      const keys = Array.from(keysToValidate);
      const rows = await prisma.systemSetting.findMany({
        where: { key: { in: keys } },
        select: { key: true, value: true },
      });

      const current: Record<string, string> = {};
      for (const row of rows) current[row.key] = row.value;

      const next: Record<string, string> = { ...current };
      for (const item of data) {
        if (keysToValidate.has(item.key)) {
          next[item.key] = item.value;
        }
      }

      const bypass = isTurnstileDevBypassEnabled();
      const turnstileReady =
        bypass ||
        (parseBoolean(next.turnstile_enabled) &&
          Boolean((next.turnstile_site_key || "").trim()) &&
          Boolean((next.turnstile_secret_key || "").trim()));

      const emailVerificationEnabled = parseBoolean(next.auth_email_verification_enabled);
      const passwordResetEnabled = parseBoolean(next.auth_password_reset_enabled);

      if ((emailVerificationEnabled || passwordResetEnabled) && !turnstileReady) {
        return NextResponse.json(
          { error: "Turnstile must be enabled and configured to enable email verification/password reset" },
          { status: 400 }
        );
      }

      const githubEnabled = parseBoolean(next.auth_provider_github_enabled);
      if (githubEnabled) {
        const clientId = (next.auth_provider_github_client_id || "").trim();
        const clientSecret = (next.auth_provider_github_client_secret || "").trim();
        if (!clientId || !clientSecret) {
          return NextResponse.json(
            { error: "GitHub OAuth must be configured (client id/secret) before enabling" },
            { status: 400 }
          );
        }
      }

      const linuxdoEnabled = parseBoolean(next.auth_provider_linuxdo_enabled);
      if (linuxdoEnabled) {
        const clientId = (next.auth_provider_linuxdo_client_id || "").trim();
        const clientSecret = (next.auth_provider_linuxdo_client_secret || "").trim();
        if (!clientId || !clientSecret) {
          return NextResponse.json(
            { error: "LinuxDO OAuth must be configured (client id/secret) before enabling" },
            { status: 400 }
          );
        }
      }

      const mappingRaw = next[LINUXDO_TRUST_LEVEL_MAPPING_KEY];
      if (typeof mappingRaw === "string" && mappingRaw.trim() !== "") {
        const mapping = parseLinuxDoTrustLevelMapping(mappingRaw);
        if (!mapping) {
          return NextResponse.json(
            { error: "Invalid LinuxDO trust-level mapping JSON" },
            { status: 400 }
          );
        }

        const groupIds = Array.from(
          new Set(
            Object.values(mapping)
              .map((rule) => (rule.action === "assign" ? rule.userGroupId : null))
              .filter((value): value is string => typeof value === "string" && value.trim() !== "")
          )
        );

        if (groupIds.length > 0) {
          const existing = await prisma.userGroup.findMany({
            where: { id: { in: groupIds } },
            select: { id: true },
          });
          const existingIds = new Set(existing.map((g) => g.id));
          const missing = groupIds.find((id) => !existingIds.has(id));
          if (missing) {
            return NextResponse.json(
              { error: `Invalid user group id in LinuxDO trust-level mapping: ${missing}` },
              { status: 400 }
            );
          }
        }
      }

      const cooldownRaw = next[RATE_LIMIT_SETTING_KEYS.imapSyncCooldownMs];
      if (typeof cooldownRaw === "string" && cooldownRaw.trim() !== "") {
        const parsed = normalizeRateLimitInteger(cooldownRaw, RATE_LIMIT_VALIDATION.imapSyncCooldownMs);
        if (parsed === null) {
          return NextResponse.json(
            {
              error:
                `IMAP sync cooldown must be an integer between ` +
                `${RATE_LIMIT_VALIDATION.imapSyncCooldownMs.min} and ${RATE_LIMIT_VALIDATION.imapSyncCooldownMs.max} ms`,
            },
            { status: 400 }
          );
        }
      }

      const maxDurationRaw = next[RATE_LIMIT_SETTING_KEYS.imapSyncMaxDurationMs];
      if (typeof maxDurationRaw === "string" && maxDurationRaw.trim() !== "") {
        const parsed = normalizeRateLimitInteger(maxDurationRaw, RATE_LIMIT_VALIDATION.imapSyncMaxDurationMs);
        if (parsed === null) {
          return NextResponse.json(
            {
              error:
                `IMAP sync max duration must be an integer between ` +
                `${RATE_LIMIT_VALIDATION.imapSyncMaxDurationMs.min} and ${RATE_LIMIT_VALIDATION.imapSyncMaxDurationMs.max} ms`,
            },
            { status: 400 }
          );
        }
      }

      const overridesRaw = next[RATE_LIMIT_SETTING_KEYS.apiOverrides];
      const overridesValidation = validateApiRateLimitOverridesStrict(overridesRaw);
      if (!overridesValidation.ok) {
        return NextResponse.json(
          { error: overridesValidation.error },
          { status: 400 }
        );
      }
    }

    const results = await prisma.$transaction(
      data.map((item) =>
        prisma.systemSetting.upsert({
          where: { key: item.key },
          update: {
            value: item.value,
            type: item.type,
            description: item.description === undefined ? undefined : item.description,
          },
          create: {
            key: item.key,
            value: item.value,
            type: item.type,
            description: item.description ?? undefined,
          },
        })
      )
    );

    for (const item of data) {
      clearSystemSettingCache(item.key);
    }

    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
