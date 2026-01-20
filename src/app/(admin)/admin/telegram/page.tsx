"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function copyToClipboard(text: string) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Copy failed")
  );
}

function formatUnixSeconds(seconds: number | undefined) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "-";
  return new Date(seconds * 1000).toLocaleString();
}

export default function AdminTelegramPage() {
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
        toast.error(error || "Failed to load Telegram settings");
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
  }, []);

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
        toast.error(webhookData?.error || "Failed to load Telegram webhook info");
      }

      if (endpointRes.ok && typeof endpointData?.webhookSecretConfigured === "boolean") {
        setEndpointStatus({ webhookSecretConfigured: endpointData.webhookSecretConfigured });
      }
    } finally {
      setWebhookLoading(false);
    }
  }, []);

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
        toast.error(data?.error || "Failed to save settings");
        return;
      }
      toast.success("Telegram settings saved");
      await fetchSettings();
    } finally {
      setSaving(false);
    }
  };

  const setWebhook = async () => {
    const url = webhookUrl;
    if (!url) {
      toast.error("Webhook URL is required");
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
        toast.error(data?.error || "Failed to set webhook");
        return;
      }
      setWebhookInfo(data?.webhookInfo || null);
      toast.success("Webhook set");
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
        toast.error(data?.error || "Failed to delete webhook");
        return;
      }
      setWebhookInfo(data?.webhookInfo || null);
      toast.success("Webhook deleted");
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
        toast.error(data?.error || "Failed to sync bot commands");
        return;
      }
      toast.success("Bot commands synced");
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
          <h1 className="text-3xl font-bold">Telegram</h1>
          <p className="text-muted-foreground">Manage the site-owned Telegram bot and webhooks</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fetchWebhook()} disabled={webhookLoading || saving}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Bot Settings
          </CardTitle>
          <CardDescription>Configured by the admin and shared for all users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Bot Token</Label>
            <Input
              placeholder={
                maskedValues.telegram_bot_token && !(values.telegram_bot_token || "").trim()
                  ? "•••••••• (configured)"
                  : "123456:ABC-DEF..."
              }
              value={values.telegram_bot_token || ""}
              type="password"
              onChange={(e) => setValue("telegram_bot_token", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Get from @BotFather. Required for sending messages and managing Topics.</p>
          </div>

          <div className="space-y-2">
            <Label>Bot Username</Label>
            <Input
              placeholder="YourBot"
              value={values.telegram_bot_username || ""}
              onChange={(e) => setValue("telegram_bot_username", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Optional: used to generate /start deep-links on the user dashboard.</p>
          </div>

          <div className="space-y-2">
            <Label>Webhook Secret</Label>
            <Input
              placeholder={
                maskedValues.telegram_webhook_secret && !(values.telegram_webhook_secret || "").trim()
                  ? "•••••••• (configured)"
                  : "random-secret"
              }
              value={values.telegram_webhook_secret || ""}
              type="password"
              onChange={(e) => setValue("telegram_webhook_secret", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Recommended. Telegram will send it as <span className="font-mono">X-Telegram-Bot-Api-Secret-Token</span>.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Forum General Topic Name</Label>
            <Input
              placeholder="TEmail · General"
              value={values.telegram_forum_general_topic_name || ""}
              onChange={(e) => setValue("telegram_forum_general_topic_name", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Created when a user binds a forum group via /bind.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
          <CardDescription>Set the Telegram webhook to point to this server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Public Base URL</Label>
            <Input
              placeholder="https://example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Telegram requires HTTPS. Your webhook URL will be: <span className="font-mono break-all">{webhookUrl || "-"}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookUrl)} disabled={!webhookUrl}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Webhook URL
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={dropPendingUpdates} onCheckedChange={setDropPendingUpdates} />
            <Label className="text-sm">Drop pending updates</Label>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={setWebhook} disabled={webhookLoading || !webhookUrl}>
              Set Webhook
            </Button>
            <Button variant="outline" onClick={deleteWebhook} disabled={webhookLoading}>
              Delete Webhook
            </Button>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Endpoint status:</span>{" "}
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
                <span className="text-muted-foreground">Telegram URL:</span>{" "}
                <span className="font-mono break-all">{webhookInfo?.url || "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Pending updates:</span>{" "}
                <span className="font-mono">{String(webhookInfo?.pending_update_count ?? "-")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Last error:</span>{" "}
                <span className="font-mono break-all">{webhookInfo?.last_error_message || "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Last error date:</span>{" "}
                <span className="font-mono">{formatUnixSeconds(webhookInfo?.last_error_date)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">IP address:</span>{" "}
                <span className="font-mono">{webhookInfo?.ip_address || "-"}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commands</CardTitle>
          <CardDescription>Sync slash commands so users get suggestions when typing “/”</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={syncCommands} disabled={commandsLoading || saving || webhookLoading}>
            {commandsLoading ? "Syncing..." : "Sync Bot Commands"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Tip: after syncing, open a chat with the bot and type <span className="font-mono">/</span> to see the command list.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
