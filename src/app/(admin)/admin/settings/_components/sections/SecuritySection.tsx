"use client";

import { useTranslations } from "next-intl";
import { Shield, Info } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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

  return (
    <SettingSection
      icon={Shield}
      title={t("settings.security.cardTitle")}
      description={t("settings.security.subtitle")}
    >
      <SettingRow
        type="switch"
        label={t("settings.security.turnstile.enable.label")}
        description={t("settings.security.turnstile.enable.help")}
        checked={turnstileEnabled}
        onCheckedChange={setTurnstileEnabled}
      />

      <Separator />

      <SettingRow
        type="switch"
        label={t("settings.security.passkey.enable.label")}
        description={t("settings.security.passkey.enable.help")}
        checked={passkeyEnabled}
        onCheckedChange={setPasskeyEnabled}
      />

      <SettingRow
        type="switch"
        label={t("settings.security.otp.enable.label")}
        description={t("settings.security.otp.enable.help")}
        checked={otpEnabled}
        onCheckedChange={setOtpEnabled}
      />

      <SettingRow
        type="switch"
        label={t("settings.security.emailVerification.enable.label")}
        description={t("settings.security.emailVerification.enable.help")}
        checked={emailVerificationEnabled}
        onCheckedChange={setEmailVerificationEnabled}
      />

      <SettingRow
        type="switch"
        label={t("settings.security.passwordReset.enable.label")}
        description={t("settings.security.passwordReset.enable.help")}
        checked={passwordResetEnabled}
        onCheckedChange={setPasswordResetEnabled}
      />

      <Separator />

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
    </SettingSection>
  );
}
