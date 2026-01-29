"use client";

import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type ProvidersSectionProps = {
  values: Record<string, string>;
  maskedValues: Record<string, boolean>;
  setValue: (key: string, value: string) => void;
  emailRegistrationEnabled: boolean;
  setEmailRegistrationEnabled: (value: boolean) => void;
  githubEnabled: boolean;
  setGithubEnabled: (value: boolean) => void;
  githubRegistrationEnabled: boolean;
  setGithubRegistrationEnabled: (value: boolean) => void;
};

export function ProvidersSection({
  values,
  maskedValues,
  setValue,
  emailRegistrationEnabled,
  setEmailRegistrationEnabled,
  githubEnabled,
  setGithubEnabled,
  githubRegistrationEnabled,
  setGithubRegistrationEnabled,
}: ProvidersSectionProps) {
  const t = useTranslations("admin");

  return (
    <SettingSection icon={Settings} title={t("settings.providers.cardTitle")}>
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("settings.providers.email.title")}</Label>
        <SettingRow
          type="switch"
          label={t("settings.providers.email.registration.label")}
          description={t("settings.providers.email.registration.help")}
          checked={emailRegistrationEnabled}
          onCheckedChange={setEmailRegistrationEnabled}
        />
      </div>

      <Separator />

      <div className="space-y-4">
        <Label className="text-sm font-medium">{t("settings.providers.github.title")}</Label>

        <SettingRow
          type="switch"
          label={t("settings.providers.github.enable.label")}
          description={t("settings.providers.github.enable.help")}
          checked={githubEnabled}
          onCheckedChange={setGithubEnabled}
        />

        <SettingRow
          type="switch"
          label={t("settings.providers.github.registration.label")}
          description={t("settings.providers.github.registration.help")}
          checked={githubRegistrationEnabled}
          onCheckedChange={setGithubRegistrationEnabled}
          disabled={!githubEnabled}
        />

        <div className="space-y-2">
          <Label>{t("settings.providers.github.clientId.label")}</Label>
          <Input
            placeholder={t("settings.providers.github.clientId.placeholder")}
            value={values.auth_provider_github_client_id || ""}
            onChange={(e) => setValue("auth_provider_github_client_id", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("settings.providers.github.clientSecret.label")}</Label>
          <Input
            type="password"
            placeholder={t("settings.providers.github.clientSecret.placeholder")}
            value={
              maskedValues.auth_provider_github_client_secret && !values.auth_provider_github_client_secret
                ? t("settings.common.secretConfigured")
                : values.auth_provider_github_client_secret || ""
            }
            onChange={(e) => setValue("auth_provider_github_client_secret", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("settings.providers.github.callbackHint")}</p>
        </div>
      </div>
    </SettingSection>
  );
}
