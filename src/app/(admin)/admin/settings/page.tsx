"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Info, Settings, Shield } from "lucide-react";
import { toast } from "sonner";
import { isVercelDeployment } from "@/lib/deployment/public";

const DEFAULT_AI_CLASSIFIER_PROMPT = `You are an email classification assistant. Analyze the email content and classify it into one of the following categories:

{{categories}}

Return your result in JSON.

Email Subject: {{email.subject}}
Email From: {{email.fromAddress}}
Email Body: {{email.textBody}}`;

const DEFAULT_AI_REWRITE_PROMPT = `You are an email rewriting and extraction assistant.

Return a JSON object with this schema:
{
  "subject": string | null,
  "textBody": string | null,
  "htmlBody": string | null,
  "variables": object | null,
  "reasoning": string | null
}

Rules:
- If you don't want to change a field, return null for that field.
- If extracting data, put it into "variables" as a flat object of string values.
- The workflow node write target is: {{writeTarget}}
- Allowed email fields for rewriting (JSON array): {{allowedEmailFieldsJson}}
- If writeTarget is "variables", you MUST set subject/textBody/htmlBody to null.
- If writeTarget is "email", you MUST set variables to null.
- You MUST NOT invent variable keys. Only use keys explicitly requested by the user.
- Allowed variable keys (JSON array): {{requestedVariableKeysJson}}
- If the allowed key list is empty, set "variables" to null.
- Do not output additional keys under "variables" (no synonyms, no extra keys).
- Variable values must be plain strings (do not JSON-encode objects).
- Do not return additional keys.

Email Subject:
{{email.subject}}

Email Text Body:
{{email.textBody}}

Email HTML Body:
{{email.htmlBody}}

Existing Variables (JSON):
{{variablesJson}}

Instruction:
{{instruction}}`;

export default function AdminSettingsPage() {
  type AppInfoResponse = {
    version: string;
    commitSha: string | null;
    commitShortSha: string | null;
    repository: { owner: string; name: string; url: string };
  };

  type UpdateCheckResponse = {
    ok: boolean;
    checkedAt: string;
    current: AppInfoResponse;
    latest: { tag: string; version: string | null; url: string; publishedAt: string | null } | null;
    hasUpdate: boolean | null;
    error?: string;
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [maskedValues, setMaskedValues] = useState<Record<string, boolean>>({});
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [aiClassifierEnabled, setAiClassifierEnabled] = useState(false);
  const [aiRewriteEnabled, setAiRewriteEnabled] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<"open" | "invite" | "closed">("open");
  const [registrationInviteCodes, setRegistrationInviteCodes] = useState("");
  const [workflowMaxExecutionLogs, setWorkflowMaxExecutionLogs] = useState("100");
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [telegramBotEnabled, setTelegramBotEnabled] = useState(true);
  const [tab, setTab] = useState<"general" | "registration" | "security" | "smtp" | "ai" | "workflow" | "telegram">("general");

  const [appInfo, setAppInfo] = useState<AppInfoResponse | null>(null);
  const [appInfoLoading, setAppInfoLoading] = useState(true);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckResponse | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const t = useTranslations("admin");
  const vercelMode = isVercelDeployment();

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const generalItems = useMemo(
    () => [
      { key: "site_name", labelKey: "settings.fields.site_name.label", placeholder: "TEmail" },
      { key: "site_url", labelKey: "settings.fields.site_url.label", placeholder: "http://localhost:3000" },
    ],
    []
  );
  const smtpItems = useMemo(
    () => [
      { key: "smtp_host", labelKey: "settings.fields.smtp_host.label", placeholder: "smtp.example.com" },
      { key: "smtp_port", labelKey: "settings.fields.smtp_port.label", placeholder: "587" },
      { key: "smtp_user", labelKey: "settings.fields.smtp_user.label", placeholder: "user@example.com" },
      { key: "smtp_pass", labelKey: "settings.fields.smtp_pass.label", placeholder: "••••••••", secret: true },
      { key: "smtp_from", labelKey: "settings.fields.smtp_from.label", placeholder: "TEmail <no-reply@example.com>" },
    ],
    []
  );
  const turnstileItems = useMemo(
    () => [
      { key: "turnstile_site_key", labelKey: "settings.fields.turnstile_site_key.label", placeholder: "0x4AAAAAA..." },
      { key: "turnstile_secret_key", labelKey: "settings.fields.turnstile_secret_key.label", placeholder: "0x4AAAAAA...", secret: true },
    ],
    []
  );
  const webauthnItems = useMemo(
    () => [
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
    ],
    []
  );
  const aiClassifierItems = useMemo(
    () => [
      {
        key: "ai_classifier_base_url",
        labelKey: "settings.fields.ai_classifier_base_url.label",
        placeholder: "https://api.openai.com/v1",
        descriptionKey: "settings.fields.ai_classifier_base_url.description",
      },
      {
        key: "ai_classifier_model",
        labelKey: "settings.fields.ai_classifier_model.label",
        placeholder: "gpt-4o-mini",
        descriptionKey: "settings.fields.ai_classifier_model.description",
      },
      {
        key: "ai_classifier_api_key",
        labelKey: "settings.fields.ai_classifier_api_key.label",
        placeholder: "sk-...",
        secret: true,
        descriptionKey: "settings.fields.ai_classifier_api_key.description",
      },
      {
        key: "ai_classifier_default_prompt",
        labelKey: "settings.fields.ai_classifier_default_prompt.label",
        type: "textarea" as const,
        placeholder: DEFAULT_AI_CLASSIFIER_PROMPT,
        descriptionKey: "settings.fields.ai_classifier_default_prompt.description",
      },
    ],
    []
  );
  const aiRewriteItems = useMemo(
    () => [
      {
        key: "ai_rewrite_base_url",
        labelKey: "settings.fields.ai_rewrite_base_url.label",
        placeholder: "https://api.openai.com/v1",
        descriptionKey: "settings.fields.ai_rewrite_base_url.description",
      },
      {
        key: "ai_rewrite_model",
        labelKey: "settings.fields.ai_rewrite_model.label",
        placeholder: "gpt-4o-mini",
        descriptionKey: "settings.fields.ai_rewrite_model.description",
      },
      {
        key: "ai_rewrite_api_key",
        labelKey: "settings.fields.ai_rewrite_api_key.label",
        placeholder: "sk-...",
        secret: true,
        descriptionKey: "settings.fields.ai_rewrite_api_key.description",
      },
      {
        key: "ai_rewrite_default_prompt",
        labelKey: "settings.fields.ai_rewrite_default_prompt.label",
        type: "textarea" as const,
        placeholder: DEFAULT_AI_REWRITE_PROMPT,
        descriptionKey: "settings.fields.ai_rewrite_default_prompt.description",
      },
    ],
    []
  );

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/settings");
    const data = await res.json().catch(() => []);

    if (!res.ok) {
      toast.error(data?.error || t("settings.toasts.loadFailed"));
      setLoading(false);
      return;
    }

    const map: Record<string, string> = {};
    const masked: Record<string, boolean> = {};
    for (const row of data as { key: string; value: string; masked?: boolean }[]) {
      map[row.key] = row.value;
      masked[row.key] = Boolean(row.masked);
    }

    setValues(map);
    setMaskedValues(masked);
    setSmtpSecure(map.smtp_secure === "true");
    setAiClassifierEnabled(map.ai_classifier_enabled === "true");
    setAiRewriteEnabled(map.ai_rewrite_enabled === "true");
    setTurnstileEnabled(map.turnstile_enabled === "true");
    setPasskeyEnabled(map.auth_passkey_enabled === "true");
    setOtpEnabled(map.auth_otp_enabled === "true");
    // Default to true if not set (backward compatibility)
    setTelegramBotEnabled(map.telegram_bot_enabled !== "false");
    const mode = map.registration_mode;
    setRegistrationMode(mode === "invite" || mode === "closed" ? mode : "open");
    setRegistrationInviteCodes(map.registration_invite_codes || "");
    setWorkflowMaxExecutionLogs(map.workflow_max_execution_logs || "100");
    setLoading(false);
  }, [t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const load = async () => {
      setAppInfoLoading(true);
      const res = await fetch("/api/app-info");
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setAppInfo(data as AppInfoResponse);
      }
      setAppInfoLoading(false);
    };
    load().catch(() => setAppInfoLoading(false));
  }, []);

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch("/api/admin/app-update");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("settings.toasts.checkUpdatesFailed"));
        return;
      }

      const payload = data as UpdateCheckResponse;
      setUpdateCheck(payload);

      if (!payload.ok) {
        toast.error(payload.error || t("settings.toasts.checkUpdatesFailed"));
        return;
      }

      if (payload.hasUpdate === true) {
        toast.info(t("settings.toasts.updateAvailable"));
        return;
      }

      if (payload.hasUpdate === false) {
        toast.success(t("settings.toasts.upToDate"));
        return;
      }

      toast.message(t("settings.toasts.checkCompleted"));
    } catch {
      toast.error(t("settings.toasts.checkUpdatesFailed"));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = [
        ...generalItems.map((item) => ({
          key: item.key,
          value: values[item.key] || "",
        })),
        ...smtpItems.map((item) => ({
          key: item.key,
          value: values[item.key] || "",
        })),
        ...aiClassifierItems.map((item) => ({
          key: item.key,
          value: values[item.key] || "",
        })),
        ...aiRewriteItems.map((item) => ({
          key: item.key,
          value: values[item.key] || "",
        })),
        ...turnstileItems.map((item) => ({
          key: item.key,
          value: values[item.key] || "",
        })),
        { key: "smtp_secure", value: smtpSecure ? "true" : "false" },
        { key: "ai_classifier_enabled", value: aiClassifierEnabled ? "true" : "false" },
        { key: "ai_rewrite_enabled", value: aiRewriteEnabled ? "true" : "false" },
        { key: "turnstile_enabled", value: turnstileEnabled ? "true" : "false" },
        { key: "auth_passkey_enabled", value: passkeyEnabled ? "true" : "false" },
        { key: "auth_otp_enabled", value: otpEnabled ? "true" : "false" },
        { key: "telegram_bot_enabled", value: telegramBotEnabled ? "true" : "false" },
      ].filter((x) => x.value !== "");

      payload.push(
        { key: "registration_mode", value: registrationMode },
        { key: "registration_invite_codes", value: registrationInviteCodes },
        { key: "workflow_max_execution_logs", value: workflowMaxExecutionLogs },
        { key: "webauthn_origin", value: values["webauthn_origin"] || "" },
        { key: "webauthn_rp_id", value: values["webauthn_rp_id"] || "" }
      );

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(t("settings.toasts.saved"));
        await fetchSettings();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t("settings.toasts.saveFailed"));
      }
    } finally {
      setSaving(false);
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
          <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
          <p className="text-muted-foreground">{t("settings.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSettings} disabled={saving}>
            {t("common.reload")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-4">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 h-auto">
            <TabsTrigger value="general">{t("settings.tabs.general")}</TabsTrigger>
          <TabsTrigger value="registration">{t("settings.tabs.registration")}</TabsTrigger>
          <TabsTrigger value="security">{t("settings.tabs.security")}</TabsTrigger>
          {!vercelMode && <TabsTrigger value="smtp">{t("settings.tabs.smtp")}</TabsTrigger>}
          <TabsTrigger value="ai">{t("settings.tabs.ai")}</TabsTrigger>
          <TabsTrigger value="workflow">{t("settings.tabs.workflow")}</TabsTrigger>
          <TabsTrigger value="telegram">{t("settings.tabs.telegram")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t("settings.general.cardTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {generalItems.map((item) => (
                  <div key={item.key} className="space-y-2">
                    <Label>{t(item.labelKey)}</Label>
                    <Input
                      placeholder={item.placeholder}
                      value={values[item.key] || ""}
                      onChange={(e) => setValue(item.key, e.target.value)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  {t("settings.about.cardTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("settings.about.version")}</span>
                  <Badge variant="secondary" className="font-mono">
                    {appInfoLoading ? "…" : appInfo?.version || t("common.unknown")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("settings.about.commit")}</span>
                  <Badge variant="outline" className="font-mono" title={appInfo?.commitSha || ""}>
                    {appInfoLoading ? "…" : appInfo?.commitShortSha || appInfo?.commitSha || t("common.unknown")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("settings.about.github")}</span>
                  <a
                    className="underline underline-offset-4 hover:text-foreground"
                    href={appInfo?.repository.url || "https://github.com/xinhai-ai/temail"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {appInfo?.repository.owner && appInfo?.repository.name
                      ? `${appInfo.repository.owner}/${appInfo.repository.name}`
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="registration">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("settings.registration.cardTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("settings.registration.mode.label")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.registration.mode.help")}
                </p>
                <Select
                  value={registrationMode}
                  onValueChange={(v) => setRegistrationMode(v as "open" | "invite" | "closed")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("settings.registration.mode.placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">{t("settings.registration.mode.options.open")}</SelectItem>
                    <SelectItem value="invite">{t("settings.registration.mode.options.invite")}</SelectItem>
                    <SelectItem value="closed">{t("settings.registration.mode.options.closed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("settings.registration.inviteCodes.label")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("settings.registration.inviteCodes.help")}
                </p>
                <Textarea
                  placeholder={t("settings.registration.inviteCodes.placeholder")}
                  value={registrationInviteCodes}
                  onChange={(e) => setRegistrationInviteCodes(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                  disabled={registrationMode !== "invite"}
                />
                {registrationMode === "invite" && !registrationInviteCodes.trim() && (
                  <p className="text-xs text-destructive">
                    {t("settings.registration.inviteCodes.warning")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t("settings.security.cardTitle")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t("settings.security.subtitle")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("settings.security.turnstile.enable.label")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.security.turnstile.enable.help")}
                  </p>
                </div>
                <Switch checked={turnstileEnabled} onCheckedChange={setTurnstileEnabled} />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("settings.security.passkey.enable.label")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.security.passkey.enable.help")}
                  </p>
                </div>
                <Switch checked={passkeyEnabled} onCheckedChange={setPasskeyEnabled} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("settings.security.otp.enable.label")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.security.otp.enable.help")}
                  </p>
                </div>
                <Switch checked={otpEnabled} onCheckedChange={setOtpEnabled} />
              </div>

              <Separator />

              {turnstileEnabled && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs text-amber-900 space-y-1">
                    <p className="font-medium">{t("settings.security.turnstile.status.title")}</p>
                    <p>
                      {(values["turnstile_site_key"] || "").trim()
                        ? t("settings.security.turnstile.status.siteKey.configured")
                        : t("settings.security.turnstile.status.siteKey.missing")}
                      {" · "}
                      {maskedValues["turnstile_secret_key"] || (values["turnstile_secret_key"] || "").trim()
                        ? t("settings.security.turnstile.status.secretKey.configured")
                        : t("settings.security.turnstile.status.secretKey.missing")}
                    </p>
                    <p>
                      {t("settings.security.turnstile.status.enforcedWhenReady")}
                    </p>
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
                      {t("settings.security.turnstile.devBypass.p1")}{" "}
                      <code>TURNSTILE_DEV_BYPASS=1</code>.
                    </p>
                    <p>
                      {t("settings.security.turnstile.devBypass.p2")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {!vercelMode && (
          <TabsContent value="smtp">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t("settings.smtp.cardTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t("settings.smtp.secure.label")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.smtp.secure.help")}
                    </p>
                  </div>
                  <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} />
                </div>

                {smtpItems.map((item) => (
                  <div key={item.key} className="space-y-2">
                    <Label>{t(item.labelKey)}</Label>
                    <Input
                      placeholder={item.placeholder}
                      value={values[item.key] || ""}
                      type={item.secret ? "password" : "text"}
                      onChange={(e) => setValue(item.key, e.target.value)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="ai">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t("settings.ai.classifier.cardTitle")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("settings.ai.classifier.subtitle")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("settings.ai.classifier.enable.label")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.ai.classifier.enable.help")}
                    </p>
                  </div>
                  <Switch checked={aiClassifierEnabled} onCheckedChange={setAiClassifierEnabled} />
                </div>

                <Separator />

                {aiClassifierItems.map((item) => (
                  <div key={item.key} className="space-y-2">
                    <Label>{t(item.labelKey)}</Label>
                    {item.descriptionKey && (
                      <p className="text-xs text-muted-foreground">{t(item.descriptionKey)}</p>
                    )}
                    {item.type === "textarea" ? (
                      <Textarea
                        placeholder={item.placeholder}
                        value={values[item.key] || ""}
                        onChange={(e) => setValue(item.key, e.target.value)}
                        rows={8}
                        className="font-mono text-sm"
                      />
                    ) : (
                      <Input
                        placeholder={item.placeholder}
                        value={values[item.key] || ""}
                        type={item.secret ? "password" : "text"}
                        onChange={(e) => setValue(item.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}

	                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
	                  <div className="flex items-start gap-2">
	                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
	                    <div className="text-xs text-blue-900 space-y-1">
	                      <p className="font-medium">{t("settings.ai.templateVariables.title")}</p>
	                      <p>{t("settings.ai.templateVariables.help")}</p>
	                      <ul className="list-disc list-inside pl-2 space-y-0.5">
	                        <li><code>{"{{categories}}"}</code> - {t("settings.ai.classifier.templateVariables.categories")}</li>
	                        <li><code>{"{{email.subject}}"}</code> - {t("settings.ai.classifier.templateVariables.emailSubject")}</li>
	                        <li><code>{"{{email.fromAddress}}"}</code> - {t("settings.ai.classifier.templateVariables.fromAddress")}</li>
	                        <li><code>{"{{email.fromName}}"}</code> - {t("settings.ai.classifier.templateVariables.fromName")}</li>
	                        <li><code>{"{{email.textBody}}"}</code> - {t("settings.ai.classifier.templateVariables.textBody")}</li>
	                        <li><code>{"{{email.htmlBody}}"}</code> - {t("settings.ai.classifier.templateVariables.htmlBody")}</li>
	                      </ul>
	                    </div>
	                  </div>
	                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t("settings.ai.rewrite.cardTitle")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("settings.ai.rewrite.subtitle")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t("settings.ai.rewrite.enable.label")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.ai.rewrite.enable.help")}
                    </p>
                  </div>
                  <Switch checked={aiRewriteEnabled} onCheckedChange={setAiRewriteEnabled} />
                </div>

                <Separator />

                {aiRewriteItems.map((item) => (
                  <div key={item.key} className="space-y-2">
                    <Label>{t(item.labelKey)}</Label>
                    {item.descriptionKey && (
                      <p className="text-xs text-muted-foreground">{t(item.descriptionKey)}</p>
                    )}
                    {item.type === "textarea" ? (
                      <Textarea
                        placeholder={item.placeholder}
                        value={values[item.key] || ""}
                        onChange={(e) => setValue(item.key, e.target.value)}
                        rows={10}
                        className="font-mono text-sm"
                      />
                    ) : (
                      <Input
                        placeholder={item.placeholder}
                        value={values[item.key] || ""}
                        type={item.secret ? "password" : "text"}
                        onChange={(e) => setValue(item.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-900 space-y-1">
                      <p className="font-medium">{t("settings.ai.templateVariables.title")}</p>
                      <p>{t("settings.ai.templateVariables.help")}</p>
                      <ul className="list-disc list-inside pl-2 space-y-0.5">
                        <li><code>{"{{email.subject}}"}</code> - {t("settings.ai.rewrite.templateVariables.emailSubject")}</li>
                        <li><code>{"{{email.textBody}}"}</code> - {t("settings.ai.rewrite.templateVariables.textBody")}</li>
                        <li><code>{"{{email.htmlBody}}"}</code> - {t("settings.ai.rewrite.templateVariables.htmlBody")}</li>
                        <li><code>{"{{variablesJson}}"}</code> - {t("settings.ai.rewrite.templateVariables.variablesJson")}</li>
                        <li><code>{"{{instruction}}"}</code> - {t("settings.ai.rewrite.templateVariables.instruction")}</li>
                        <li><code>{"{{variables.anyKey}}"}</code> - {t("settings.ai.rewrite.templateVariables.variablesAnyKey")}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workflow">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("settings.workflow.cardTitle")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t("settings.workflow.subtitle")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("settings.workflow.maxExecutionLogs.label")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.workflow.maxExecutionLogs.help")}
                </p>
                <Input
                  type="number"
                  min="10"
                  max="10000"
                  placeholder="100"
                  value={workflowMaxExecutionLogs}
                  onChange={(e) => setWorkflowMaxExecutionLogs(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.workflow.maxExecutionLogs.recommended")}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telegram">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t("settings.telegramBot.cardTitle")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t("settings.telegramBot.subtitle")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("settings.telegramBot.enable.label")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.telegramBot.enable.help")}
                  </p>
                </div>
                <Switch checked={telegramBotEnabled} onCheckedChange={setTelegramBotEnabled} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
