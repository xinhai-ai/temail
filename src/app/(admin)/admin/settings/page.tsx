"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Info, Settings } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_AI_CLASSIFIER_PROMPT = `You are an email classification assistant. Analyze the email content and classify it into one of the following categories:

{{categories}}

Return your result in JSON.

Email Subject: {{email.subject}}
Email From: {{email.fromAddress}}
Email Body: {{email.textBody}}`;

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [aiClassifierEnabled, setAiClassifierEnabled] = useState(false);

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const generalItems = useMemo(
    () => [
      { key: "site_name", label: "Site Name", placeholder: "TEmail" },
      { key: "site_url", label: "Site URL", placeholder: "http://localhost:3000" },
    ],
    []
  );
  const smtpItems = useMemo(
    () => [
      { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.example.com" },
      { key: "smtp_port", label: "SMTP Port", placeholder: "587" },
      { key: "smtp_user", label: "SMTP User", placeholder: "user@example.com" },
      { key: "smtp_pass", label: "SMTP Password", placeholder: "••••••••", secret: true },
      { key: "smtp_from", label: "SMTP From", placeholder: "TEmail <no-reply@example.com>" },
    ],
    []
  );
  const aiClassifierItems = useMemo(
    () => [
      {
        key: "ai_classifier_base_url",
        label: "API Base URL",
        placeholder: "https://api.openai.com/v1",
        description: "OpenAI-compatible API endpoint",
      },
      {
        key: "ai_classifier_model",
        label: "Model",
        placeholder: "gpt-4o-mini",
        description: "Model to use for classification (e.g., gpt-4o-mini, gpt-4o)",
      },
      {
        key: "ai_classifier_api_key",
        label: "API Key",
        placeholder: "sk-...",
        secret: true,
        description: "OpenAI API key or compatible provider key",
      },
      {
        key: "ai_classifier_default_prompt",
        label: "Default Prompt Template",
        type: "textarea" as const,
        placeholder: DEFAULT_AI_CLASSIFIER_PROMPT,
        description: "Default classification prompt (supports template variables)",
      },
    ],
    []
  );

  const fetchSettings = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/settings");
    const data = await res.json().catch(() => []);

    if (!res.ok) {
      toast.error(data?.error || "Failed to load settings");
      setLoading(false);
      return;
    }

    const map: Record<string, string> = {};
    for (const row of data as { key: string; value: string }[]) {
      map[row.key] = row.value;
    }

    setValues(map);
    setSmtpSecure(map.smtp_secure === "true");
    setAiClassifierEnabled(map.ai_classifier_enabled === "true");
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

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
        { key: "smtp_secure", value: smtpSecure ? "true" : "false" },
        { key: "ai_classifier_enabled", value: aiClassifierEnabled ? "true" : "false" },
      ].filter((x) => x.value !== "");

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Settings saved");
        await fetchSettings();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save settings");
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
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Configure system settings</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {generalItems.map((item) => (
              <div key={item.key} className="space-y-2">
                <Label>{item.label}</Label>
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
              <Settings className="h-5 w-5" />
              SMTP Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>SMTP Secure</Label>
                <p className="text-sm text-muted-foreground">
                  Use SSL/TLS (or set port 465)
                </p>
              </div>
              <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} />
            </div>

            {smtpItems.map((item) => (
              <div key={item.key} className="space-y-2">
                <Label>{item.label}</Label>
                <Input
                  placeholder={item.placeholder}
                  value={values[item.key] || ""}
                  type={item.secret ? "password" : "text"}
                  onChange={(e) => setValue(item.key, e.target.value)}
                />
              </div>
            ))}

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Note: these settings are stored in the database.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              AI Classifier Settings
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure AI-powered email classification for workflows
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable AI Classifier</Label>
                <p className="text-xs text-muted-foreground">
                  Allow workflows to use AI for email classification
                </p>
              </div>
              <Switch checked={aiClassifierEnabled} onCheckedChange={setAiClassifierEnabled} />
            </div>

            <Separator />

            {aiClassifierItems.map((item) => (
              <div key={item.key} className="space-y-2">
                <Label>{item.label}</Label>
                {item.description && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
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
                  <p className="font-medium">Template Variables</p>
                  <p>You can use these variables in the prompt template:</p>
                  <ul className="list-disc list-inside pl-2 space-y-0.5">
                    <li><code>{"{{categories}}"}</code> - List of classification categories</li>
                    <li><code>{"{{email.subject}}"}</code> - Email subject line</li>
                    <li><code>{"{{email.fromAddress}}"}</code> - Sender email address</li>
                    <li><code>{"{{email.fromName}}"}</code> - Sender display name</li>
                    <li><code>{"{{email.textBody}}"}</code> - Email body (plain text)</li>
                    <li><code>{"{{email.htmlBody}}"}</code> - Email body (HTML)</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save AI Classifier Settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
