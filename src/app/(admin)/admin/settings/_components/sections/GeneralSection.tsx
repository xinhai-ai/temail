"use client";

import { useTranslations } from "next-intl";
import { Settings, Info } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { useAppInfo } from "../../_hooks/useAppInfo";

type GeneralSectionProps = {
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  appInfo: ReturnType<typeof useAppInfo>;
};

export function GeneralSection({ values, setValue, appInfo }: GeneralSectionProps) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  const { appInfo: info, appInfoLoading, updateCheck, checkingUpdate, handleCheckUpdates } = appInfo;

  return (
    <div className="space-y-6">
      <SettingSection icon={Settings} title={t("settings.general.cardTitle")}>
        <SettingRow
          label={t("settings.fields.site_name.label")}
          value={values.site_name || ""}
          onChange={(v) => setValue("site_name", v)}
          placeholder="TEmail"
        />
        <SettingRow
          label={t("settings.fields.site_url.label")}
          value={values.site_url || ""}
          onChange={(v) => setValue("site_url", v)}
          placeholder="http://localhost:3000"
        />
      </SettingSection>

      <SettingSection icon={Info} title={t("settings.about.cardTitle")}>
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("settings.about.version")}</span>
            <Badge variant="secondary" className="font-mono">
              {appInfoLoading ? "..." : info?.version || tCommon("unknown")}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("settings.about.commit")}</span>
            <Badge variant="outline" className="font-mono" title={info?.commitSha || ""}>
              {appInfoLoading ? "..." : info?.commitShortSha || info?.commitSha || tCommon("unknown")}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t("settings.about.github")}</span>
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href={info?.repository.url || "https://github.com/xinhai-ai/temail"}
              target="_blank"
              rel="noreferrer"
            >
              {info?.repository.owner && info?.repository.name
                ? `${info.repository.owner}/${info.repository.name}`
                : "xinhai-ai/temail"}
            </a>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCheckUpdates} disabled={checkingUpdate}>
                {checkingUpdate ? t("settings.about.checking") : t("settings.about.checkUpdates")}
              </Button>
              {updateCheck?.ok && updateCheck.hasUpdate === true && (
                <Badge variant="destructive">{t("settings.about.updateAvailable")}</Badge>
              )}
              {updateCheck?.ok && updateCheck.hasUpdate === false && (
                <Badge variant="secondary">{t("settings.about.upToDate")}</Badge>
              )}
            </div>
            {updateCheck?.ok && updateCheck.latest?.url && (
              <a
                className="underline underline-offset-4 hover:text-foreground"
                href={updateCheck.latest.url}
                target="_blank"
                rel="noreferrer"
              >
                {t("settings.about.viewLatest")}
              </a>
            )}
          </div>

          {updateCheck && (
            <div className="rounded-md border p-3 space-y-1">
              <p className="text-xs text-muted-foreground">
                {t("settings.about.checked", { date: new Date(updateCheck.checkedAt).toLocaleString() })}
              </p>
              {!updateCheck.ok ? (
                <p className="text-sm text-destructive">
                  {updateCheck.error || t("settings.about.checkFailed")}
                </p>
              ) : updateCheck.latest ? (
                <p className="text-sm">
                  {t("settings.about.latest", { tag: updateCheck.latest.tag })}
                  {updateCheck.latest.publishedAt
                    ? ` · ${t("settings.about.published", {
                        date: new Date(updateCheck.latest.publishedAt).toLocaleString(),
                      })}`
                    : ""}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{t("settings.about.noReleaseInfo")}</p>
              )}
            </div>
          )}
        </div>
      </SettingSection>
    </div>
  );
}
