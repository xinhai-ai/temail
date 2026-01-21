"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, RefreshCw, Save, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

type SettingRow = {
  key: string;
  value: string;
  masked?: boolean;
};

type WebhookInfo = {
  url: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
};

function formatUnixSeconds(seconds: number | undefined) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "-";
  return new Date(seconds * 1000).toLocaleString();
}

export default function AdminTelegramPage() {
  const t = useTranslations("admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [maskedValues, setMaskedValues] = useState<Record<string, boolean>>({});

  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [endpointStatus, setEndpointStatus] = useState<{ webhookSecretConfigured: boolean } | null>(null);

  const [commandsLoading, setCommandsLoading] = useState(false);

  const [baseUrl, setBaseUrl] = useState("");
  const [dropPendingUpdates, setDropPendingUpdates] = useState(true);

  const webhookUrl = useMemo(() => {
    const origin = (baseUrl || "").trim().replace(/\/+$/, "");
    if (!origin) return "";
    return `${origin}/api/telegram/webhook`;
  }, [baseUrl]);

  const copyToClipboard = useCallback((text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => toast.success(t("telegram.toasts.copied")),
      () => toast.error(t("telegram.toasts.copyFailed"))
    );
  }, [t]);

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/settings");
      const data = (await res.json().catch(() => null)) as SettingRow[] | { error?: string } | null;
      if (!res.ok) {
        const error = data && typeof data === "object" && "error" in data ? String((data as { error?: string }).error || "") : "";
        toast.error(error || t("telegram.toasts.loadSettingsFailed"));
        return;
      }
      const map: Record<string, string> = {};
      const masked: Record<string, boolean> = {};
      for (const row of Array.isArray(data) ? data : []) {
        map[row.key] = row.value;
        masked[row.key] = Boolean(row.masked);
      }
      setValues(map);
      setMaskedValues(masked);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchWebhook = useCallback(async () => {
    setWebhookLoading(true);
    try {
      const [webhookRes, endpointRes] = await Promise.all([
        fetch("/api/admin/telegram/webhook"),
        fetch("/api/telegram/webhook"),
      ]);
      const webhookData = (await webhookRes.json().catch(() => null)) as { webhookInfo?: WebhookInfo; error?: string } | null;
      const endpointData = (await endpointRes.json().catch(() => null)) as { webhookSecretConfigured?: boolean } | null;

      if (webhookRes.ok) {
        setWebhookInfo(webhookData?.webhookInfo || null);
      } else {
        toast.error(webhookData?.error || t("telegram.toasts.loadWebhookFailed"));
      }

      if (endpointRes.ok && typeof endpointData?.webhookSecretConfigured === "boolean") {
        setEndpointStatus({ webhookSecretConfigured: endpointData.webhookSecretConfigured });
      }
    } finally {
      setWebhookLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSettings().catch(() => setLoading(false));
    fetchWebhook().catch(() => null);
  }, [fetchSettings, fetchWebhook]);

  useEffect(() => {
    if ((baseUrl || "").trim()) return;
    setBaseUrl(window.location.origin);
  }, [baseUrl]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload: Array<{ key: string; value: string }> = [];

      // Secrets: only send when explicitly set.
      const botToken = (values.telegram_bot_token || "").trim();
      if (botToken) payload.push({ key: "telegram_bot_token", value: botToken });

      const webhookSecret = (values.telegram_webhook_secret || "").trim();
      if (webhookSecret) payload.push({ key: "telegram_webhook_secret", value: webhookSecret });

      // Non-secrets: allow clearing.
      payload.push({ key: "telegram_bot_username", value: values.telegram_bot_username || "" });
      payload.push({ key: "telegram_forum_general_topic_name", value: values.telegram_forum_general_topic_name || "" });

      const res = await fetch("/api/admin/telegram/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error || t("telegram.toasts.saveFailed"));
        return;
      }
      toast.success(t("telegram.toasts.saved"));
      await fetchSettings();
    } finally {
      setSaving(false);
    }
  };

  const setWebhook = async () => {
    const url = webhookUrl;
    if (!url) {
      toast.error(t("telegram.toasts.webhookUrlRequired"));
      return;
    }
    setWebhookLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, dropPendingUpdates }),
      });
      const data = (await res.json().catch(() => null)) as { webhookInfo?: WebhookInfo; error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error || t("telegram.toasts.setWebhookFailed"));
        return;
      }
      setWebhookInfo(data?.webhookInfo || null);
      toast.success(t("telegram.toasts.webhookSet"));
    } finally {
      setWebhookLoading(false);
    }
  };

  const deleteWebhook = async () => {
    setWebhookLoading(true);
    try {
      const qp = dropPendingUpdates ? "?dropPendingUpdates=1" : "";
      const res = await fetch(`/api/admin/telegram/webhook${qp}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { webhookInfo?: WebhookInfo; error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error || t("telegram.toasts.deleteWebhookFailed"));
        return;
      }
      setWebhookInfo(data?.webhookInfo || null);
      toast.success(t("telegram.toasts.webhookDeleted"));
    } finally {
      setWebhookLoading(false);
    }
  };

  const syncCommands = async () => {
    setCommandsLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/commands", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error || t("telegram.toasts.syncCommandsFailed"));
        return;
      }
      toast.success(t("telegram.toasts.commandsSynced"));
    } finally {
      setCommandsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("telegram.title")}</h1>
          <p className="text-muted-foreground">{t("telegram.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fetchWebhook()} disabled={webhookLoading || saving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("common.refresh")}
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {t("telegram.botSettings.title")}
          </CardTitle>
          <CardDescription>{t("telegram.botSettings.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("telegram.botSettings.fields.botToken.label")}</Label>
            <Input
              placeholder={
                maskedValues.telegram_bot_token && !(values.telegram_bot_token || "").trim()
                  ? t("telegram.common.secretConfigured")
                  : "123456:ABC-DEF..."
              }
              value={values.telegram_bot_token || ""}
              type="password"
              onChange={(e) => setValue("telegram_bot_token", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("telegram.botSettings.fields.botToken.help")}</p>
          </div>

          <div className="space-y-2">
            <Label>{t("telegram.botSettings.fields.botUsername.label")}</Label>
            <Input
              placeholder="YourBot"
              value={values.telegram_bot_username || ""}
              onChange={(e) => setValue("telegram_bot_username", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("telegram.botSettings.fields.botUsername.help")}</p>
          </div>

          <div className="space-y-2">
            <Label>{t("telegram.botSettings.fields.webhookSecret.label")}</Label>
            <Input
              placeholder={
                maskedValues.telegram_webhook_secret && !(values.telegram_webhook_secret || "").trim()
                  ? t("telegram.common.secretConfigured")
                  : "random-secret"
              }
              value={values.telegram_webhook_secret || ""}
              type="password"
              onChange={(e) => setValue("telegram_webhook_secret", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("telegram.botSettings.fields.webhookSecret.helpPrefix")}{" "}
              <span className="font-mono">X-Telegram-Bot-Api-Secret-Token</span>
              {t("telegram.botSettings.fields.webhookSecret.helpSuffix")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("telegram.botSettings.fields.forumGeneralTopicName.label")}</Label>
            <Input
              placeholder="TEmail · General"
              value={values.telegram_forum_general_topic_name || ""}
              onChange={(e) => setValue("telegram_forum_general_topic_name", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("telegram.botSettings.fields.forumGeneralTopicName.help")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("telegram.webhook.title")}</CardTitle>
          <CardDescription>{t("telegram.webhook.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("telegram.webhook.fields.publicBaseUrl.label")}</Label>
            <Input
              placeholder="https://example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("telegram.webhook.fields.publicBaseUrl.helpPrefix")}{" "}
              <span className="font-mono break-all">{webhookUrl || "-"}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookUrl)} disabled={!webhookUrl}>
                <Copy className="h-4 w-4 mr-2" />
                {t("telegram.webhook.actions.copyWebhookUrl")}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={dropPendingUpdates} onCheckedChange={setDropPendingUpdates} />
            <Label className="text-sm">{t("telegram.webhook.options.dropPendingUpdates")}</Label>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={setWebhook} disabled={webhookLoading || !webhookUrl}>
              {t("telegram.webhook.actions.setWebhook")}
            </Button>
            <Button variant="outline" onClick={deleteWebhook} disabled={webhookLoading}>
              {t("telegram.webhook.actions.deleteWebhook")}
            </Button>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">{t("telegram.webhook.status.endpointStatus")}</span>{" "}
              {endpointStatus ? (
                <span className="font-mono">
                  webhookSecretConfigured={endpointStatus.webhookSecretConfigured ? "true" : "false"}
                </span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
            <div className="grid gap-1 text-xs">
              <div>
                <span className="text-muted-foreground">{t("telegram.webhook.status.telegramUrl")}</span>{" "}
                <span className="font-mono break-all">{webhookInfo?.url || "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("telegram.webhook.status.pendingUpdates")}</span>{" "}
                <span className="font-mono">{String(webhookInfo?.pending_update_count ?? "-")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("telegram.webhook.status.lastError")}</span>{" "}
                <span className="font-mono break-all">{webhookInfo?.last_error_message || "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("telegram.webhook.status.lastErrorDate")}</span>{" "}
                <span className="font-mono">{formatUnixSeconds(webhookInfo?.last_error_date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("telegram.webhook.status.ipAddress")}</span>{" "}
                <span className="font-mono">{webhookInfo?.ip_address || "-"}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("telegram.commands.title")}</CardTitle>
          <CardDescription>{t("telegram.commands.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={syncCommands} disabled={commandsLoading || saving || webhookLoading}>
            {commandsLoading ? t("telegram.commands.actions.syncing") : t("telegram.commands.actions.sync")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("telegram.commands.tipPrefix")} <span className="font-mono">/</span> {t("telegram.commands.tipSuffix")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
