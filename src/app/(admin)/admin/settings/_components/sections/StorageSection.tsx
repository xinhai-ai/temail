"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Database, RefreshCcw } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type StorageSectionProps = {
  values: Record<string, string>;
  maskedValues: Record<string, boolean>;
  setValue: (key: string, value: string) => void;
};

type UsageRow = {
  id: string;
  email: string;
  name: string | null;
  usageBytes: number;
  usageFiles: number;
  quota: {
    maxStorageMb: number | null;
    maxStorageFiles: number | null;
  };
};

type S3TestResponse = {
  ok?: boolean;
  error?: string;
  testedAt?: string;
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function StorageSection({ values, maskedValues, setValue }: StorageSectionProps) {
  const t = useTranslations("admin");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageRows, setUsageRows] = useState<UsageRow[]>([]);
  const [summary, setSummary] = useState<{ totalBytes: number; totalFiles: number; totalUsers: number } | null>(null);

  const backend = (values.storage_backend || "local").trim() || "local";
  const s3Visible = backend === "s3";
  const s3PersistedPassed = values.storage_s3_last_test_ok === "true";
  const s3TestPassed = testResult ? testResult.ok : s3PersistedPassed;
  const s3LastTestAt = values.storage_s3_last_test_at || "";

  const s3Draft = useMemo(
    () => ({
      backend: "s3",
      endpoint: values.storage_s3_endpoint || "",
      region: values.storage_s3_region || "",
      bucket: values.storage_s3_bucket || "",
      accessKeyId: values.storage_s3_access_key_id || "",
      secretAccessKey:
        values.storage_s3_secret_access_key ||
        (maskedValues.storage_s3_secret_access_key ? undefined : ""),
      forcePathStyle: values.storage_s3_force_path_style === "true",
      basePrefix: values.storage_s3_base_prefix || "",
    }),
    [values, maskedValues.storage_s3_secret_access_key]
  );

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const res = await fetch("/api/admin/storage/usage?limit=50&page=1");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSummary(null);
        setUsageRows([]);
        return;
      }
      setSummary(data?.summary || null);
      setUsageRows(Array.isArray(data?.users) ? (data.users as UsageRow[]) : []);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage().catch(() => undefined);
  }, [loadUsage]);

  const setS3Value = (key: string, value: string) => {
    setValue(key, value);
    setValue("storage_s3_last_test_ok", "false");
    setTestResult(null);
  };

  const handleTestS3 = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/storage/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s3Draft),
      });
      const data = (await res.json().catch(() => null)) as S3TestResponse | null;
      const testedAt = typeof data?.testedAt === "string" ? data.testedAt : new Date().toISOString();

      if (!res.ok || !data?.ok) {
        setValue("storage_s3_last_test_ok", "false");
        setValue("storage_s3_last_test_at", testedAt);
        setTestResult({ ok: false, message: data?.error || t("settings.storage.test.failed") });
        await loadUsage();
        return;
      }

      setValue("storage_s3_last_test_ok", "true");
      setValue("storage_s3_last_test_at", testedAt);
      setTestResult({ ok: true, message: t("settings.storage.test.success") });
      await loadUsage();
    } catch {
      const testedAt = new Date().toISOString();
      setValue("storage_s3_last_test_ok", "false");
      setValue("storage_s3_last_test_at", testedAt);
      setTestResult({ ok: false, message: t("settings.storage.test.failed") });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingSection icon={Database} title={t("settings.storage.cardTitle")} description={t("settings.storage.subtitle")}>
        <SettingRow
          type="custom"
          label={t("settings.storage.backend.label")}
          description={t("settings.storage.backend.help")}
        >
          <Select
            value={backend}
            onValueChange={(value) => {
              setValue("storage_backend", value);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="s3">S3</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        {s3Visible && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("settings.fields.storage_s3_endpoint.label")}</Label>
                <Input value={values.storage_s3_endpoint || ""} onChange={(e) => setS3Value("storage_s3_endpoint", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.fields.storage_s3_region.label")}</Label>
                <Input value={values.storage_s3_region || ""} onChange={(e) => setS3Value("storage_s3_region", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.fields.storage_s3_bucket.label")}</Label>
                <Input value={values.storage_s3_bucket || ""} onChange={(e) => setS3Value("storage_s3_bucket", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.fields.storage_s3_access_key_id.label")}</Label>
                <Input value={values.storage_s3_access_key_id || ""} onChange={(e) => setS3Value("storage_s3_access_key_id", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.fields.storage_s3_secret_access_key.label")}</Label>
                <Input
                  type="password"
                  value={values.storage_s3_secret_access_key || ""}
                  placeholder={maskedValues.storage_s3_secret_access_key ? t("settings.common.secretConfigured") : ""}
                  onChange={(e) => setS3Value("storage_s3_secret_access_key", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.fields.storage_s3_base_prefix.label")}</Label>
                <Input value={values.storage_s3_base_prefix || ""} onChange={(e) => setS3Value("storage_s3_base_prefix", e.target.value)} />
              </div>
            </div>

            <SettingRow
              type="switch"
              label={t("settings.fields.storage_s3_force_path_style.label")}
              description={t("settings.fields.storage_s3_force_path_style.description")}
              checked={values.storage_s3_force_path_style === "true"}
              onCheckedChange={(v) => setS3Value("storage_s3_force_path_style", v ? "true" : "false")}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleTestS3} disabled={testing}>
                {testing ? t("settings.storage.test.testing") : t("settings.storage.test.testNow")}
              </Button>
              <Badge variant={s3TestPassed ? "default" : "secondary"}>
                {s3TestPassed ? t("settings.storage.test.success") : t("settings.storage.test.failed")}
              </Badge>
              {testResult?.message ? (
                <span className={`text-xs ${testResult.ok ? "text-muted-foreground" : "text-destructive"}`}>
                  {testResult.message}
                </span>
              ) : null}
              {s3LastTestAt ? (
                <span className="text-xs text-muted-foreground">{new Date(s3LastTestAt).toLocaleString()}</span>
              ) : null}
            </div>
          </div>
        )}
      </SettingSection>

      <SettingSection
        icon={RefreshCcw}
        title={t("settings.storage.usage.title")}
        description={t("settings.storage.usage.help")}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadUsage} disabled={usageLoading}>
            {usageLoading ? t("common.loading") : t("common.refresh")}
          </Button>
          {summary && (
            <div className="text-sm text-muted-foreground">
              {t("settings.storage.usage.summary", {
                users: summary.totalUsers,
                files: summary.totalFiles,
                bytes: formatBytes(summary.totalBytes),
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {usageRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("settings.storage.usage.empty")}</p>
          ) : (
            usageRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <div className="truncate">{row.name || row.email}</div>
                <div className="text-muted-foreground">
                  {formatBytes(row.usageBytes)} · {row.usageFiles} files
                </div>
              </div>
            ))
          )}
        </div>
      </SettingSection>
    </div>
  );
}
