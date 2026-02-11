"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Shield, Info } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  API_RATE_LIMIT_POLICIES,
  RATE_LIMIT_SETTING_KEYS,
} from "@/lib/rate-limit-policies";

type SecuritySectionProps = {
  values: Record<string, string>;
  maskedValues: Record<string, boolean>;
  setValue: (key: string, value: string) => void;
  turnstileEnabled: boolean;
  setTurnstileEnabled: (value: boolean) => void;
  passkeyEnabled: boolean;
  setPasskeyEnabled: (value: boolean) => void;
  otpEnabled: boolean;
  setOtpEnabled: (value: boolean) => void;
  emailVerificationEnabled: boolean;
  setEmailVerificationEnabled: (value: boolean) => void;
  passwordResetEnabled: boolean;
  setPasswordResetEnabled: (value: boolean) => void;
};

type ApiOverrideItem = {
  limit?: number;
  windowMs?: number;
};

type ApiOverrideMap = Record<string, ApiOverrideItem>;

function parseApiOverrides(raw: string | undefined): ApiOverrideMap {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: ApiOverrideMap = {};
    for (const [policyId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const source = value as Record<string, unknown>;
      const item: ApiOverrideItem = {};

      if (typeof source.limit === "number" && Number.isFinite(source.limit) && source.limit > 0) {
        item.limit = Math.floor(source.limit);
      }
      if (typeof source.windowMs === "number" && Number.isFinite(source.windowMs) && source.windowMs > 0) {
        item.windowMs = Math.floor(source.windowMs);
      }
      if (Object.keys(item).length > 0) {
        result[policyId] = item;
      }
    }

    return result;
  } catch {
    return {};
  }
}

function toIntOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function compactApiOverrides(overrides: ApiOverrideMap): string {
  if (Object.keys(overrides).length === 0) {
    return "";
  }
  return JSON.stringify(overrides);
}

export function SecuritySection({
  values,
  maskedValues,
  setValue,
  turnstileEnabled,
  setTurnstileEnabled,
  passkeyEnabled,
  setPasskeyEnabled,
  otpEnabled,
  setOtpEnabled,
  emailVerificationEnabled,
  setEmailVerificationEnabled,
  passwordResetEnabled,
  setPasswordResetEnabled,
}: SecuritySectionProps) {
  const t = useTranslations("admin");

  const turnstileItems = [
    { key: "turnstile_site_key", labelKey: "settings.fields.turnstile_site_key.label", placeholder: "0x4AAAAAA..." },
    {
      key: "turnstile_secret_key",
      labelKey: "settings.fields.turnstile_secret_key.label",
      placeholder: "0x4AAAAAA...",
      secret: true,
    },
  ];

  const webauthnItems = [
    {
      key: "webauthn_origin",
      labelKey: "settings.fields.webauthn_origin.label",
      placeholder: "https://example.com",
    },
    {
      key: "webauthn_rp_id",
      labelKey: "settings.fields.webauthn_rp_id.label",
      placeholder: "example.com",
    },
  ];

  const apiOverrides = useMemo(
    () => parseApiOverrides(values[RATE_LIMIT_SETTING_KEYS.apiOverrides]),
    [values]
  );

  const persistApiOverrides = useCallback(
    (next: ApiOverrideMap) => {
      setValue(RATE_LIMIT_SETTING_KEYS.apiOverrides, compactApiOverrides(next));
    },
    [setValue]
  );

  const setImapNumber = (key: string, value: string) => {
    const trimmed = value.trim();
    setValue(key, trimmed);
  };

  const updateApiOverride = (
    policyId: string,
    field: keyof ApiOverrideItem,
    value: string,
    defaults: { limit: number; windowMs: number }
  ) => {
    const parsed = toIntOrUndefined(value);
    const next: ApiOverrideMap = { ...apiOverrides };
    const current = next[policyId] ? { ...next[policyId] } : {};

    if (parsed === undefined || parsed === defaults[field]) {
      delete current[field];
    } else {
      current[field] = parsed;
    }

    if (!current.limit && !current.windowMs) {
      delete next[policyId];
    } else {
      next[policyId] = current;
    }

    persistApiOverrides(next);
  };

  const resetApiOverrides = () => {
    persistApiOverrides({});
  };

  return (
    <SettingSection
      icon={Shield}
      title={t("settings.security.cardTitle")}
      description={t("settings.security.subtitle")}
    >
      <div className="rounded-lg border p-4 space-y-4">
        <SettingRow
          type="switch"
          label={t("settings.security.turnstile.enable.label")}
          description={t("settings.security.turnstile.enable.help")}
          checked={turnstileEnabled}
          onCheckedChange={setTurnstileEnabled}
        />

        {turnstileEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-medium">{t("settings.security.turnstile.status.title")}</p>
              <p>
                {(values.turnstile_site_key || "").trim()
                  ? t("settings.security.turnstile.status.siteKey.configured")
                  : t("settings.security.turnstile.status.siteKey.missing")}
                {" · "}
                {maskedValues.turnstile_secret_key || (values.turnstile_secret_key || "").trim()
                  ? t("settings.security.turnstile.status.secretKey.configured")
                  : t("settings.security.turnstile.status.secretKey.missing")}
              </p>
              <p>{t("settings.security.turnstile.status.enforcedWhenReady")}</p>
            </div>
          </div>
        )}

        {turnstileItems.map((item) => (
          <div key={item.key} className="space-y-2">
            <Label>{t(item.labelKey)}</Label>
            <Input
              placeholder={
                item.secret && maskedValues[item.key] && !values[item.key]
                  ? t("settings.common.secretConfigured")
                  : item.placeholder
              }
              value={values[item.key] || ""}
              type={item.secret ? "password" : "text"}
              onChange={(e) => setValue(item.key, e.target.value)}
            />
          </div>
        ))}

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-xs text-blue-900 space-y-1">
              <p className="font-medium">{t("settings.security.turnstile.devBypass.title")}</p>
              <p>
                {t("settings.security.turnstile.devBypass.p1")} <code>TURNSTILE_DEV_BYPASS=1</code>.
              </p>
              <p>{t("settings.security.turnstile.devBypass.p2")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <SettingRow
          type="switch"
          label={t("settings.security.passkey.enable.label")}
          description={t("settings.security.passkey.enable.help")}
          checked={passkeyEnabled}
          onCheckedChange={setPasskeyEnabled}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {webauthnItems.map((item) => (
            <div key={item.key} className="space-y-2">
              <Label>{t(item.labelKey)}</Label>
              <Input
                placeholder={item.placeholder}
                value={values[item.key] || ""}
                onChange={(e) => setValue(item.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <SettingRow
          type="switch"
          label={t("settings.security.otp.enable.label")}
          description={t("settings.security.otp.enable.help")}
          checked={otpEnabled}
          onCheckedChange={setOtpEnabled}
        />
      </div>

      <div className="rounded-lg border p-4">
        <SettingRow
          type="switch"
          label={t("settings.security.emailVerification.enable.label")}
          description={t("settings.security.emailVerification.enable.help")}
          checked={emailVerificationEnabled}
          onCheckedChange={setEmailVerificationEnabled}
        />
      </div>

      <div className="rounded-lg border p-4">
        <SettingRow
          type="switch"
          label={t("settings.security.passwordReset.enable.label")}
          description={t("settings.security.passwordReset.enable.help")}
          checked={passwordResetEnabled}
          onCheckedChange={setPasswordResetEnabled}
        />
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div>
          <h4 className="text-sm font-medium">{t("settings.security.rateLimit.imap.title")}</h4>
          <p className="text-xs text-muted-foreground">{t("settings.security.rateLimit.imap.help")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("settings.security.rateLimit.imap.cooldownMs")}</Label>
            <Input
              type="number"
              min="1000"
              value={values[RATE_LIMIT_SETTING_KEYS.imapSyncCooldownMs] || String(30_000)}
              placeholder="30000"
              onChange={(e) => setImapNumber(RATE_LIMIT_SETTING_KEYS.imapSyncCooldownMs, e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("settings.security.rateLimit.imap.maxDurationMs")}</Label>
            <Input
              type="number"
              min="10000"
              value={values[RATE_LIMIT_SETTING_KEYS.imapSyncMaxDurationMs] || String(300_000)}
              placeholder="300000"
              onChange={(e) => setImapNumber(RATE_LIMIT_SETTING_KEYS.imapSyncMaxDurationMs, e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium">{t("settings.security.rateLimit.api.title")}</h4>
            <p className="text-xs text-muted-foreground">{t("settings.security.rateLimit.api.help")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={resetApiOverrides}>
            {t("settings.security.rateLimit.api.reset")}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("settings.security.rateLimit.api.table.policy")}</TableHead>
              <TableHead>{t("settings.security.rateLimit.api.table.default")}</TableHead>
              <TableHead>{t("settings.security.rateLimit.api.table.limit")}</TableHead>
              <TableHead>{t("settings.security.rateLimit.api.table.windowMs")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {API_RATE_LIMIT_POLICIES.map((policy) => {
              const override = apiOverrides[policy.id] || {};
              const limitValue = typeof override.limit === "number" ? String(override.limit) : "";
              const windowValue = typeof override.windowMs === "number" ? String(override.windowMs) : "";

              return (
                <TableRow key={policy.id}>
                  <TableCell className="font-mono text-xs">{policy.id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {policy.defaultLimit} / {policy.defaultWindowMs}ms
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      value={limitValue}
                      placeholder={String(policy.defaultLimit)}
                      onChange={(e) =>
                        updateApiOverride(policy.id, "limit", e.target.value, {
                          limit: policy.defaultLimit,
                          windowMs: policy.defaultWindowMs,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1000"
                      value={windowValue}
                      placeholder={String(policy.defaultWindowMs)}
                      onChange={(e) =>
                        updateApiOverride(policy.id, "windowMs", e.target.value, {
                          limit: policy.defaultLimit,
                          windowMs: policy.defaultWindowMs,
                        })
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </SettingSection>
  );
}
