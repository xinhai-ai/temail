"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [tab, setTab] = useState<"general" | "registration" | "security" | "smtp" | "ai" | "workflow">("general");

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
  const turnstileItems = useMemo(
    () => [
      { key: "turnstile_site_key", label: "Site Key", placeholder: "0x4AAAAAA..." },
      { key: "turnstile_secret_key", label: "Secret Key", placeholder: "0x4AAAAAA...", secret: true },
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
  const aiRewriteItems = useMemo(
    () => [
      {
        key: "ai_rewrite_base_url",
        label: "API Base URL",
        placeholder: "https://api.openai.com/v1",
        description: "OpenAI-compatible API endpoint",
      },
      {
        key: "ai_rewrite_model",
        label: "Model",
        placeholder: "gpt-4o-mini",
        description: "Model to use for rewriting/extraction (e.g., gpt-4o-mini, gpt-4o)",
      },
      {
        key: "ai_rewrite_api_key",
        label: "API Key",
        placeholder: "sk-...",
        secret: true,
        description: "OpenAI API key or compatible provider key",
      },
      {
        key: "ai_rewrite_default_prompt",
        label: "Default Prompt Template",
        type: "textarea" as const,
        placeholder: DEFAULT_AI_REWRITE_PROMPT,
        description: "Default rewrite/extraction prompt (supports template variables)",
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
    const mode = map.registration_mode;
    setRegistrationMode(mode === "invite" || mode === "closed" ? mode : "open");
    setRegistrationInviteCodes(map.registration_invite_codes || "");
    setWorkflowMaxExecutionLogs(map.workflow_max_execution_logs || "100");
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
      ].filter((x) => x.value !== "");

      payload.push(
        { key: "registration_mode", value: registrationMode },
        { key: "registration_invite_codes", value: registrationInviteCodes },
        { key: "workflow_max_execution_logs", value: workflowMaxExecutionLogs }
      );

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">System Settings</h1>
          <p className="text-muted-foreground">Configure system settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSettings} disabled={saving}>
            Reload
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-4">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="registration">Registration</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
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
        </TabsContent>

        <TabsContent value="registration">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Registration Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Registration Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Control whether new users can sign up.
                </p>
                <Select
                  value={registrationMode}
                  onValueChange={(v) => setRegistrationMode(v as "open" | "invite" | "closed")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="invite">Invite Code</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Invite Codes</Label>
                <p className="text-sm text-muted-foreground">
                  Used when Registration Mode is set to Invite Code. Separate multiple codes by commas or newlines.
                </p>
                <Textarea
                  placeholder="code-1\ncode-2"
                  value={registrationInviteCodes}
                  onChange={(e) => setRegistrationInviteCodes(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                  disabled={registrationMode !== "invite"}
                />
                {registrationMode === "invite" && !registrationInviteCodes.trim() && (
                  <p className="text-xs text-destructive">
                    Invite-code registration is enabled but no invite codes are configured.
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
                Security Settings
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure bot protection for authentication flows.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Cloudflare Turnstile</Label>
                  <p className="text-xs text-muted-foreground">
                    Protect login and registration with a CAPTCHA-like challenge.
                  </p>
                </div>
                <Switch checked={turnstileEnabled} onCheckedChange={setTurnstileEnabled} />
              </div>

              <Separator />

              {turnstileEnabled && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs text-amber-900 space-y-1">
                    <p className="font-medium">Turnstile status</p>
                    <p>
                      {(values["turnstile_site_key"] || "").trim()
                        ? "Site Key: configured"
                        : "Site Key: missing"}
                      {" · "}
                      {maskedValues["turnstile_secret_key"] || (values["turnstile_secret_key"] || "").trim()
                        ? "Secret Key: configured"
                        : "Secret Key: missing"}
                    </p>
                    <p>
                      Turnstile is only enforced when enabled and both keys are configured.
                    </p>
                  </div>
                </div>
              )}

              {turnstileItems.map((item) => (
                <div key={item.key} className="space-y-2">
                  <Label>{item.label}</Label>
                  <Input
                    placeholder={
                      item.secret && maskedValues[item.key] && !values[item.key]
                        ? "•••••••• (configured)"
                        : item.placeholder
                    }
                    value={values[item.key] || ""}
                    type={item.secret ? "password" : "text"}
                    onChange={(e) => setValue(item.key, e.target.value)}
                  />
                </div>
              ))}

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-900 space-y-1">
                    <p className="font-medium">Development Bypass</p>
                    <p>
                      In development, you can bypass Turnstile verification by setting{" "}
                      <code>TURNSTILE_DEV_BYPASS=1</code>.
                    </p>
                    <p>
                      Create your keys in Cloudflare Turnstile and paste the Site Key and Secret Key above.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <div className="space-y-6">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  AI Rewrite Settings
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure AI-powered rewrite/extraction nodes for workflows
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable AI Rewrite</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow workflows to use AI to rewrite or extract email content
                    </p>
                  </div>
                  <Switch checked={aiRewriteEnabled} onCheckedChange={setAiRewriteEnabled} />
                </div>

                <Separator />

                {aiRewriteItems.map((item) => (
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
                      <p className="font-medium">Template Variables</p>
                      <p>You can use these variables in the prompt template:</p>
                      <ul className="list-disc list-inside pl-2 space-y-0.5">
                        <li><code>{"{{email.subject}}"}</code> - Email subject line</li>
                        <li><code>{"{{email.textBody}}"}</code> - Email body (plain text)</li>
                        <li><code>{"{{email.htmlBody}}"}</code> - Email body (HTML)</li>
                        <li><code>{"{{variablesJson}}"}</code> - Current workflow variables as JSON</li>
                        <li><code>{"{{instruction}}"}</code> - Node-specific instruction text</li>
                        <li><code>{"{{variables.anyKey}}"}</code> - Access a specific workflow variable</li>
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
                Workflow Settings
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Configure workflow execution and logging behavior
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Max Execution Logs per Workflow</Label>
                <p className="text-xs text-muted-foreground">
                  Maximum number of execution logs to keep for each workflow. Older logs will be automatically deleted when this limit is exceeded.
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
                  Recommended: 50-500. Higher values will use more database storage.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
