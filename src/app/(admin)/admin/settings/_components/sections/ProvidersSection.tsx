"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  LINUXDO_TRUST_LEVEL_MAPPING_KEY,
  type LinuxDoTrustLevelBucket,
  type LinuxDoTrustLevelMapping,
  parseLinuxDoTrustLevelMapping,
} from "@/lib/linuxdo-shared";

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
  linuxdoEnabled: boolean;
  setLinuxdoEnabled: (value: boolean) => void;
  linuxdoRegistrationEnabled: boolean;
  setLinuxdoRegistrationEnabled: (value: boolean) => void;
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
  linuxdoEnabled,
  setLinuxdoEnabled,
  linuxdoRegistrationEnabled,
  setLinuxdoRegistrationEnabled,
}: ProvidersSectionProps) {
  const t = useTranslations("admin");

  const [userGroupsLoading, setUserGroupsLoading] = useState(true);
  const [userGroups, setUserGroups] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const load = async () => {
      setUserGroupsLoading(true);
      try {
        const res = await fetch("/api/admin/usergroups");
        const data = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(data)) {
          setUserGroups([]);
          return;
        }
        const options = data
          .map((row: unknown) => row as Partial<{ id: string; name: string }>)
          .filter((row) => typeof row.id === "string" && typeof row.name === "string")
          .map((row) => ({ id: row.id as string, name: row.name as string }));
        setUserGroups(options);
      } finally {
        setUserGroupsLoading(false);
      }
    };
    load().catch(() => setUserGroupsLoading(false));
  }, []);

  const mappingRaw = values[LINUXDO_TRUST_LEVEL_MAPPING_KEY] || "";
  const mappingConfigured = Boolean(mappingRaw.trim());
  const parsedMapping = useMemo(() => parseLinuxDoTrustLevelMapping(mappingRaw), [mappingRaw]);

  const fallbackGroupId = useMemo(() => {
    if (userGroups.length === 0) return null;
    const byName = userGroups.find((g) => g.name === "Default");
    return (byName || userGroups[0])?.id ?? null;
  }, [userGroups]);

  const derivedMapping: LinuxDoTrustLevelMapping | null = useMemo(() => {
    if (parsedMapping) return parsedMapping;
    if (!fallbackGroupId) return null;
    return {
      tl0: { action: "assign", userGroupId: fallbackGroupId },
      tl1: { action: "assign", userGroupId: fallbackGroupId },
      tl2: { action: "assign", userGroupId: fallbackGroupId },
      tl34: { action: "assign", userGroupId: fallbackGroupId },
    };
  }, [parsedMapping, fallbackGroupId]);

  const updateMapping = (bucket: LinuxDoTrustLevelBucket, nextRule: LinuxDoTrustLevelMapping[LinuxDoTrustLevelBucket]) => {
    if (!derivedMapping) return;
    const next: LinuxDoTrustLevelMapping = { ...derivedMapping, [bucket]: nextRule };
    setValue(LINUXDO_TRUST_LEVEL_MAPPING_KEY, JSON.stringify(next));
  };

  const buckets: Array<{ key: LinuxDoTrustLevelBucket; label: string }> = [
    { key: "tl0", label: t("settings.providers.linuxdo.trustLevelMapping.buckets.tl0") },
    { key: "tl1", label: t("settings.providers.linuxdo.trustLevelMapping.buckets.tl1") },
    { key: "tl2", label: t("settings.providers.linuxdo.trustLevelMapping.buckets.tl2") },
    { key: "tl34", label: t("settings.providers.linuxdo.trustLevelMapping.buckets.tl34") },
  ];

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

      <Separator />

      <div className="space-y-4">
        <Label className="text-sm font-medium">{t("settings.providers.linuxdo.title")}</Label>

        <SettingRow
          type="switch"
          label={t("settings.providers.linuxdo.enable.label")}
          description={t("settings.providers.linuxdo.enable.help")}
          checked={linuxdoEnabled}
          onCheckedChange={setLinuxdoEnabled}
        />

        <SettingRow
          type="switch"
          label={t("settings.providers.linuxdo.registration.label")}
          description={t("settings.providers.linuxdo.registration.help")}
          checked={linuxdoRegistrationEnabled}
          onCheckedChange={setLinuxdoRegistrationEnabled}
          disabled={!linuxdoEnabled}
        />

        <div className="space-y-2">
          <Label>{t("settings.providers.linuxdo.clientId.label")}</Label>
          <Input
            placeholder={t("settings.providers.linuxdo.clientId.placeholder")}
            value={values.auth_provider_linuxdo_client_id || ""}
            onChange={(e) => setValue("auth_provider_linuxdo_client_id", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("settings.providers.linuxdo.clientSecret.label")}</Label>
          <Input
            type="password"
            placeholder={t("settings.providers.linuxdo.clientSecret.placeholder")}
            value={
              maskedValues.auth_provider_linuxdo_client_secret && !values.auth_provider_linuxdo_client_secret
                ? t("settings.common.secretConfigured")
                : values.auth_provider_linuxdo_client_secret || ""
            }
            onChange={(e) => setValue("auth_provider_linuxdo_client_secret", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("settings.providers.linuxdo.callbackHint")}</p>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>{t("settings.providers.linuxdo.trustLevelMapping.title")}</Label>
          <p className="text-sm text-muted-foreground">{t("settings.providers.linuxdo.trustLevelMapping.help")}</p>

          {userGroupsLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !derivedMapping ? (
            <p className="text-sm text-muted-foreground">{t("settings.providers.linuxdo.trustLevelMapping.noGroups")}</p>
          ) : (
            <div className="space-y-3">
              {!mappingConfigured && (
                <p className="text-xs text-muted-foreground">
                  {t("settings.providers.linuxdo.trustLevelMapping.usingDefault")}
                </p>
              )}

              {mappingConfigured && !parsedMapping && (
                <p className="text-xs text-destructive">
                  {t("settings.providers.linuxdo.trustLevelMapping.invalidJson")}
                </p>
              )}

              {buckets.map(({ key, label }) => {
                const rule = derivedMapping[key];
                const action = rule.action;
                const userGroupId = rule.action === "assign" ? rule.userGroupId : "";
                const selectDisabled = userGroupsLoading || userGroups.length === 0;

                return (
                  <div key={key} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("settings.providers.linuxdo.trustLevelMapping.action.label")}
                      </div>
                      <Select
                        value={action}
                        onValueChange={(v) => {
                          if (!derivedMapping) return;
                          if (v === "reject") {
                            updateMapping(key, { action: "reject" });
                            return;
                          }
                          if (!fallbackGroupId) return;
                          updateMapping(key, { action: "assign", userGroupId: fallbackGroupId });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="assign">{t("settings.providers.linuxdo.trustLevelMapping.action.assign")}</SelectItem>
                          <SelectItem value="reject">{t("settings.providers.linuxdo.trustLevelMapping.action.reject")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {t("settings.providers.linuxdo.trustLevelMapping.group.label")}
                      </div>
                      <Select
                        value={userGroupId}
                        onValueChange={(v) => updateMapping(key, { action: "assign", userGroupId: v })}
                        disabled={selectDisabled || action !== "assign"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("settings.providers.linuxdo.trustLevelMapping.group.placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {userGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SettingSection>
  );
}
