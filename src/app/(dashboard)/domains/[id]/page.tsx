"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Globe, Server, Webhook, Copy, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { isVercelDeployment } from "@/lib/deployment/public";

interface Domain {
  id: string;
  name: string;
  sourceType: "IMAP" | "WEBHOOK";
  status: string;
  inboundPolicy?: "CATCH_ALL" | "KNOWN_ONLY";
  description?: string;
  isPublic?: boolean;
  imapConfig?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password?: string;
    syncInterval: number;
  };
  webhookConfig?: {
    secretKey: string;
    endpoint: string;
    isActive: boolean;
  };
}

export default function DomainConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, status } = useSession();
  const t = useTranslations("domains");
  const vercelMode = isVercelDeployment();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  const [domain, setDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);

  // IMAP config state
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapSecure, setImapSecure] = useState(true);
  const [imapUsername, setImapUsername] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapInterval, setImapInterval] = useState("60");

  // Webhook config state
  const [webhookActive, setWebhookActive] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [description, setDescription] = useState("");
  const [inboundPolicy, setInboundPolicy] = useState<"CATCH_ALL" | "KNOWN_ONLY">("CATCH_ALL");

  // Redirect non-admin users
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/inbox");
    }
  }, [status, isAdmin, router]);

  const fetchDomain = useCallback(async () => {
    const res = await fetch(`/api/domains/${id}`);
    if (res.ok) {
      const data = await res.json();
      setDomain(data);
      setIsPublic(Boolean(data.isPublic));
      setDescription(data.description || "");
      setInboundPolicy(data.inboundPolicy === "KNOWN_ONLY" ? "KNOWN_ONLY" : "CATCH_ALL");

      if (data.imapConfig) {
        setImapHost(data.imapConfig.host);
        setImapPort(String(data.imapConfig.port));
        setImapSecure(data.imapConfig.secure);
        setImapUsername(data.imapConfig.username);
        setImapPassword("");
        setImapInterval(String(data.imapConfig.syncInterval));
      }

      if (data.webhookConfig) {
        setWebhookActive(data.webhookConfig.isActive);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    const run = async () => {
      await fetchDomain();
    };
    run();
  }, [fetchDomain, isAdmin]);

  const saveDomainSettings = async () => {
    setSavingDomain(true);
    const res = await fetch(`/api/domains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isPublic,
        inboundPolicy,
        description: description.trim() ? description.trim() : undefined,
      }),
    });

    if (res.ok) {
      toast.success(t("toast.settingsSaved"));
      fetchDomain();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || t("toast.saveFailed"));
    }
    setSavingDomain(false);
  };

  const saveImapConfig = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      host: imapHost,
      port: parseInt(imapPort),
      secure: imapSecure,
      username: imapUsername,
      syncInterval: parseInt(imapInterval),
      ...(imapPassword.trim() ? { password: imapPassword } : {}),
    };
    const res = await fetch(`/api/domains/${id}/imap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success(t("toast.imapSaved"));
      setImapPassword("");
      fetchDomain();
    } else {
      const data = await res.json();
      toast.error(data.error || t("toast.saveFailed"));
    }
    setSaving(false);
  };

  const generateWebhook = async () => {
    const res = await fetch(`/api/domains/${id}/webhook`, {
      method: "POST",
    });

    if (res.ok) {
      toast.success(t("toast.webhookGenerated"));
      fetchDomain();
    } else {
      toast.error(t("toast.webhookGenerateFailed"));
    }
  };

  const handleWebhookActiveChange = async (checked: boolean) => {
    if (!domain?.webhookConfig) return;
    if (savingWebhook) return;

    const previous = webhookActive;
    setWebhookActive(checked);
    setSavingWebhook(true);

    try {
      const res = await fetch(`/api/domains/${id}/webhook`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: checked }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setWebhookActive(previous);
        toast.error(data?.error || t("toast.webhookStatusUpdateFailed"));
        return;
      }
      toast.success(t("toast.webhookStatusUpdated"));
      fetchDomain();
    } catch {
      setWebhookActive(previous);
      toast.error(t("toast.webhookStatusUpdateFailed"));
    } finally {
      setSavingWebhook(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("toast.copied"));
  };

  const getStatusLabel = (value: Domain["status"]) => {
    if (value === "ACTIVE") return t("status.active");
    if (value === "PENDING") return t("status.pending");
    if (value === "ERROR") return t("status.error");
    return value;
  };

  if (status === "loading" || loading || !isAdmin) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!domain) {
    return <div className="p-8 text-center">{t("config.notFound")}</div>;
  }

  const webhookUrl = domain.webhookConfig
    ? `${window.location.origin}/api/webhooks/incoming`
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/domains">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("config.back")}
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{domain.name}</h1>
            <p className="text-muted-foreground">{t("config.subtitle")}</p>
          </div>
        </div>
        <Badge
          className={
            domain.status === "ACTIVE"
              ? "bg-green-500/10 text-green-600"
              : domain.status === "PENDING"
              ? "bg-yellow-500/10 text-yellow-600"
              : "bg-muted text-muted-foreground"
          }
        >
          {getStatusLabel(domain.status)}
        </Badge>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>{t("config.general.title")}</CardTitle>
          <CardDescription>{t("config.general.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("config.general.descriptionField.label")}</Label>
            <Input
              placeholder={t("config.general.descriptionField.placeholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("config.general.inboundPolicy.label")}</Label>
            <Select
              value={inboundPolicy}
              onValueChange={(value) => setInboundPolicy(value as "CATCH_ALL" | "KNOWN_ONLY")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CATCH_ALL">{t("config.general.inboundPolicy.options.catchAll")}</SelectItem>
                <SelectItem value="KNOWN_ONLY">{t("config.general.inboundPolicy.options.knownOnly")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {t("config.general.inboundPolicy.help")}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Label>{t("config.general.visibility.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("config.general.visibility.help")}
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <div className="flex gap-2">
            <Button onClick={saveDomainSettings} disabled={savingDomain}>
              <Save className="h-4 w-4 mr-2" />
              {savingDomain ? t("config.general.save.saving") : t("config.general.save.button")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={vercelMode ? "webhook" : domain.sourceType.toLowerCase()} className="space-y-6">
        <TabsList>
          <TabsTrigger value="webhook" className="gap-2">
            <Webhook className="h-4 w-4" />
            {t("sourceType.webhook")}
          </TabsTrigger>
          {!vercelMode ? (
            <TabsTrigger value="imap" className="gap-2">
              <Server className="h-4 w-4" />
              {t("sourceType.imap")}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="webhook" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>{t("config.webhook.title")}</CardTitle>
              <CardDescription>
                {t("config.webhook.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {domain.webhookConfig ? (
                <>
                  <div className="space-y-2">
                    <Label>{t("config.webhook.urlLabel")}</Label>
                    <div className="flex gap-2">
                      <Input value={webhookUrl || ""} readOnly className="font-mono text-sm" />
                      <Button variant="outline" onClick={() => copyToClipboard(webhookUrl || "")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("config.webhook.secretLabel")}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={domain.webhookConfig.secretKey}
                        readOnly
                        className="font-mono text-sm"
                        type="password"
                      />
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(domain.webhookConfig!.secretKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("config.webhook.secretHelp")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t("config.webhook.active.label")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("config.webhook.active.description")}
                      </p>
                    </div>
                    <Switch checked={webhookActive} onCheckedChange={handleWebhookActiveChange} disabled={savingWebhook} />
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">{t("config.webhook.payloadTitle")}</h4>
                    <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
{`POST ${webhookUrl}
Content-Type: application/json

{
  "secret": "${domain.webhookConfig.secretKey}",
  "to": "user@${domain.name}",
  "from": "sender@example.com",
  "subject": "Email Subject",
  "text": "Plain text body",
  "html": "<p>HTML body</p>"
}`}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Webhook className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">{t("config.webhook.noConfig")}</p>
                  <Button onClick={generateWebhook}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("config.webhook.generate")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {!vercelMode ? (
          <TabsContent value="imap" className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>{t("config.imap.title")}</CardTitle>
                <CardDescription>
                  {t("config.imap.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("config.imap.host.label")}</Label>
                    <Input
                      placeholder={t("config.imap.host.placeholder")}
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("config.imap.port.label")}</Label>
                    <Input
                      placeholder={t("config.imap.port.placeholder")}
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("config.imap.username.label")}</Label>
                    <Input
                      placeholder={t("config.imap.username.placeholder")}
                      value={imapUsername}
                      onChange={(e) => setImapUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("config.imap.password.label")}</Label>
                    <Input
                      type="password"
                      placeholder={t("config.imap.password.placeholder")}
                      value={imapPassword}
                      onChange={(e) => setImapPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("config.imap.password.help")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("config.imap.syncInterval.label")}</Label>
                    <Input
                      placeholder={t("config.imap.syncInterval.placeholder")}
                      value={imapInterval}
                      onChange={(e) => setImapInterval(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={imapSecure} onCheckedChange={setImapSecure} />
                    <Label>{t("config.imap.secure")}</Label>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={saveImapConfig} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? t("config.imap.save.saving") : t("config.imap.save.button")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
