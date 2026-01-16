"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Filter, Forward, Globe, Hash, Mail, MessageCircle, PencilLine, TestTube } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ForwardConditionTreeEditor,
  countForwardMatchConditions,
  normalizeForwardConditionNode,
  type ForwardConditionTree,
} from "@/components/forwards/ForwardConditionTreeEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type StepId = "basic" | "conditions" | "targets" | "template" | "review";
type TargetType = "EMAIL" | "TELEGRAM" | "DISCORD" | "SLACK" | "WEBHOOK";

type TargetDraft = {
  clientId: string;
  type: TargetType;
  to?: string;
  token?: string;
  chatId?: string;
  url?: string;
  headers?: string;
};

type CreateTargetPayload = { type: TargetType; config: string };

type Mailbox = {
  id: string;
  address: string;
};

type StepDef = {
  id: StepId;
  title: string;
  icon: LucideIcon;
};

const ALL_MAILBOXES_SELECT_VALUE = "__all__";

const forwardTypes: Array<{ value: TargetType; label: string; icon: LucideIcon }> = [
  { value: "EMAIL", label: "Email", icon: Mail },
  { value: "TELEGRAM", label: "Telegram", icon: MessageCircle },
  { value: "DISCORD", label: "Discord", icon: Hash },
  { value: "SLACK", label: "Slack", icon: Hash },
  { value: "WEBHOOK", label: "Webhook", icon: Globe },
];

const forwardTypeLabels: Record<TargetType, string> = {
  EMAIL: "Email",
  TELEGRAM: "Telegram",
  DISCORD: "Discord",
  SLACK: "Slack",
  WEBHOOK: "Webhook",
};

const DEFAULT_TEXT_TEMPLATE = `📧 {{subject}}
From: {{fromName}} <{{fromAddress}}>
To: {{toAddress}}
Received: {{receivedAt}}

{{textBody}}`;

const DEFAULT_EMAIL_SUBJECT_TEMPLATE = "[TEmail] {{subject}}";
const DEFAULT_EMAIL_HTML_TEMPLATE = "{{htmlBody}}";
const DEFAULT_WEBHOOK_BODY_TEMPLATE = `{
  "id": "{{id}}",
  "subject": "{{subject}}",
  "from": "{{fromAddress}}",
  "fromName": "{{fromName}}",
  "to": "{{toAddress}}",
  "text": "{{textBody}}",
  "html": "{{htmlBody}}",
  "receivedAt": "{{receivedAt}}"
}`;

const DEFAULT_WEBHOOK_CONTENT_TYPE = "application/json";

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTargetDraft(type: TargetType): TargetDraft {
  switch (type) {
    case "EMAIL":
      return { clientId: createClientId(), type, to: "" };
    case "TELEGRAM":
      return { clientId: createClientId(), type, token: "", chatId: "" };
    case "DISCORD":
    case "SLACK":
    case "WEBHOOK":
      return { clientId: createClientId(), type, url: "", headers: "" };
  }
}

function parseHeadersJson(raw: string | undefined) {
  if (!raw || !raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers must be a JSON object");
  }
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`Header "${key}" must be a string`);
    }
    headers[key] = value;
  }
  return headers;
}

function buildRuleConfig(input: {
  conditionTree: ForwardConditionTree;
  templateText: string;
  templateSubject: string;
  templateHtml: string;
  templateWebhookBody: string;
  templateContentType: string;
}) {
  const conditionTree = normalizeForwardConditionNode(input.conditionTree);

  const template: Record<string, string> = {};
  if (input.templateSubject.trim()) template.subject = input.templateSubject.trim();
  if (input.templateText.trim()) template.text = input.templateText;
  if (input.templateHtml.trim()) template.html = input.templateHtml;
  if (input.templateWebhookBody.trim()) template.webhookBody = input.templateWebhookBody;
  if (input.templateContentType.trim()) template.contentType = input.templateContentType.trim();

  return JSON.stringify({
    version: 3,
    ...(conditionTree ? { conditions: conditionTree } : {}),
    ...(Object.keys(template).length > 0 ? { template } : {}),
  });
}

function buildTargets(drafts: TargetDraft[]): CreateTargetPayload[] {
  if (drafts.length === 0) {
    throw new Error("At least one target is required");
  }

  return drafts.map((t, index) => {
    const prefix = `Target #${index + 1}`;
    switch (t.type) {
      case "EMAIL": {
        const to = t.to?.trim() || "";
        if (!to) throw new Error(`${prefix}: email recipient is required`);
        return { type: "EMAIL", config: JSON.stringify({ type: "EMAIL", to }) };
      }
      case "TELEGRAM": {
        const token = t.token?.trim() || "";
        const chatId = t.chatId?.trim() || "";
        if (!token || !chatId) throw new Error(`${prefix}: Telegram token and chat ID are required`);
        return { type: "TELEGRAM", config: JSON.stringify({ type: "TELEGRAM", token, chatId }) };
      }
      case "DISCORD":
      case "SLACK":
      case "WEBHOOK": {
        const url = t.url?.trim() || "";
        if (!url) throw new Error(`${prefix}: webhook URL is required`);
        const headers = parseHeadersJson(t.headers);
        return { type: t.type, config: JSON.stringify({ type: t.type, url, headers }) };
      }
    }
  });
}

function summarizeTargets(targets: TargetDraft[]) {
  if (targets.length === 0) return "No targets";

  const counts = new Map<TargetType, number>();
  for (const t of targets) counts.set(t.type, (counts.get(t.type) || 0) + 1);

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${forwardTypeLabels[type]}×${count}`)
    .join(" · ");
}

export default function NewForwardRulePage() {
  const router = useRouter();

  const steps: StepDef[] = useMemo(
    () => [
      { id: "basic", title: "Name & Scope", icon: PencilLine },
      { id: "conditions", title: "Conditions", icon: Filter },
      { id: "targets", title: "Targets", icon: Forward },
      { id: "template", title: "Template", icon: FileText },
      { id: "review", title: "Review", icon: CheckCircle2 },
    ],
    []
  );

  const [step, setStep] = useState<StepId>("basic");
  const [saving, setSaving] = useState(false);

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailboxesLoading, setMailboxesLoading] = useState(true);

  const [name, setName] = useState("");
  const [mailboxId, setMailboxId] = useState<string>("");

  const [conditionTree, setConditionTree] = useState<ForwardConditionTree>({ kind: "and", conditions: [] });

  const [targets, setTargets] = useState<TargetDraft[]>([createTargetDraft("WEBHOOK")]);

  const [templateText, setTemplateText] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateHtml, setTemplateHtml] = useState("");
  const [templateWebhookBody, setTemplateWebhookBody] = useState("");
  const [templateContentType, setTemplateContentType] = useState("");

  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<unknown>(null);
  const [testPayload, setTestPayload] = useState<{ config: string; targets: CreateTargetPayload[] } | null>(null);
  const [testingTargetId, setTestingTargetId] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testTargetLabel, setTestTargetLabel] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/mailboxes");
        const data = await res.json().catch(() => []);
        setMailboxes(res.ok ? data : []);
      } catch {
        setMailboxes([]);
      } finally {
        setMailboxesLoading(false);
      }
    };
    run();
  }, []);

  const hasEmailTarget = targets.some((t) => t.type === "EMAIL");
  const hasWebhookTarget = targets.some((t) => t.type === "WEBHOOK");
  const hasTextTarget = targets.some((t) => t.type === "TELEGRAM" || t.type === "DISCORD" || t.type === "SLACK");

  const selectedMailboxLabel = mailboxId
    ? mailboxes.find((m) => m.id === mailboxId)?.address || "Selected mailbox"
    : "All mailboxes";

  const validateStep = useCallback(
    (id: StepId): string | null => {
      if (id === "basic") {
        if (!name.trim()) return "Please enter a rule name";
        return null;
      }
      if (id === "targets") {
        try {
          buildTargets(targets);
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : "Invalid targets";
        }
      }
      if (id === "review") {
        if (!name.trim()) return "Please enter a rule name";
        try {
          buildTargets(targets);
        } catch (error) {
          return error instanceof Error ? error.message : "Invalid targets";
        }
        return null;
      }
      return null;
    },
    [name, targets]
  );

  const isStepComplete = useCallback((id: StepId) => !validateStep(id), [validateStep]);

  const conditionCount = useMemo(() => countForwardMatchConditions(conditionTree), [conditionTree]);

  const stepSummaries: Record<StepId, string> = useMemo(
    () => ({
      basic: name.trim() ? `${name.trim()} · ${selectedMailboxLabel}` : selectedMailboxLabel,
      conditions: conditionCount > 0 ? `${conditionCount} condition(s)` : "Matches all emails",
      targets: summarizeTargets(targets),
      template: [
        templateSubject.trim() ? "subject" : null,
        templateText.trim() ? "text" : null,
        templateHtml.trim() ? "html" : null,
        templateWebhookBody.trim() ? "webhook body" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Default content",
      review: isStepComplete("review") ? "Ready" : "Fix required fields",
    }),
    [
      conditionCount,
      isStepComplete,
      name,
      selectedMailboxLabel,
      targets,
      templateHtml,
      templateSubject,
      templateText,
      templateWebhookBody,
    ]
  );

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  const goNext = () => {
    const error = validateStep(step);
    if (error) {
      toast.error(error);
      return;
    }
    const next = steps[currentStepIndex + 1];
    if (next) setStep(next.id);
  };

  const goBack = () => {
    const prev = steps[currentStepIndex - 1];
    if (prev) setStep(prev.id);
  };

  const handleCreate = async () => {
    const error = validateStep("review");
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const config = buildRuleConfig({
        conditionTree,
        templateText,
        templateSubject,
        templateHtml,
        templateWebhookBody,
        templateContentType,
      });
      const builtTargets = buildTargets(targets);

      const res = await fetch("/api/forwards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          config,
          mailboxId: mailboxId || null,
          targets: builtTargets,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Failed to create rule");
        return;
      }
      toast.success("Forward rule created");
      router.push("/forwards");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestTarget = async (target: TargetDraft) => {
    setTestingTargetId(target.clientId);
    try {
      const config = buildRuleConfig({
        conditionTree,
        templateText,
        templateSubject,
        templateHtml,
        templateWebhookBody,
        templateContentType,
      });

      const builtTargets = buildTargets([target]);
      const label = (() => {
        switch (target.type) {
          case "EMAIL":
            return target.to?.trim() ? `Email → ${target.to.trim()}` : "Email";
          case "TELEGRAM":
            return target.chatId?.trim() ? `Telegram → ${target.chatId.trim()}` : "Telegram";
          case "DISCORD":
            return "Discord";
          case "SLACK":
            return "Slack";
          case "WEBHOOK":
            return "Webhook";
        }
      })();

      const res = await fetch("/api/forwards/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "dry_run",
          config,
          targets: builtTargets,
          ignoreConditions: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Test failed");
        return;
      }
      setTestPayload({ config, targets: builtTargets });
      setTestTargetLabel(label);
      setTestResult(data);
      setTestDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test failed");
    } finally {
      setTestingTargetId(null);
    }
  };

  const handleSendTest = async () => {
    if (!testPayload) return;
    setSendingTest(true);
    try {
      const res = await fetch("/api/forwards/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "send",
          config: testPayload.config,
          targets: testPayload.targets,
          ignoreConditions: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Test failed");
        setTestResult(data);
        return;
      }
      toast.success("Test sent");
      setTestResult(data);
    } catch {
      toast.error("Test failed");
    } finally {
      setSendingTest(false);
    }
  };

  const reviewPayload = useMemo(() => {
    try {
      const config = buildRuleConfig({
        conditionTree,
        templateText,
        templateSubject,
        templateHtml,
        templateWebhookBody,
        templateContentType,
      });
      const builtTargets = buildTargets(targets);
      return {
        name: name.trim(),
        mailboxId: mailboxId || null,
        config: JSON.parse(config) as unknown,
        targets: builtTargets.map((t) => ({ type: t.type, config: JSON.parse(t.config) as unknown })),
      };
    } catch {
      return null;
    }
  }, [
    conditionTree,
    mailboxId,
    name,
    targets,
    templateContentType,
    templateHtml,
    templateSubject,
    templateText,
    templateWebhookBody,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">New Forward Rule</h1>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              Flow Builder
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Configure left-to-right like a flowchart.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/forwards">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <ScrollArea className="w-full rounded-lg border bg-muted/10">
        <div className="flex items-center gap-3 p-3">
          {steps.map((s, idx) => {
            const active = s.id === step;
            const complete = isStepComplete(s.id);
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={cn(
                    "min-w-[220px] rounded-md border bg-background px-3 py-2 text-left transition",
                    active && "border-primary ring-2 ring-primary/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md",
                        complete ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium">{s.title}</div>
                        {complete ? (
                          <span className="text-xs text-green-600">✓</span>
                        ) : active ? (
                          <span className="text-xs text-muted-foreground">editing</span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {stepSummaries[s.id]}
                      </div>
                    </div>
                  </div>
                </button>
                {idx < steps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <Card className="border-border/50">
        <CardContent className="p-6 space-y-6">
          {step === "basic" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Name & Scope</h2>
                <p className="text-sm text-muted-foreground">
                  Give the rule a name and choose its mailbox scope.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input
                    placeholder="My forward rule"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Apply to Mailbox (Optional)</Label>
                  <Select
                    value={mailboxId}
                    onValueChange={(value) =>
                      setMailboxId(value === ALL_MAILBOXES_SELECT_VALUE ? "" : value)
                    }
                    disabled={mailboxesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={mailboxesLoading ? "Loading..." : "All mailboxes"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_MAILBOXES_SELECT_VALUE}>All mailboxes</SelectItem>
                      {mailboxes.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === "conditions" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Conditions</h2>
                <p className="text-sm text-muted-foreground">
                  Optional. If empty, the rule matches all emails.
                </p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Condition Tree</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={conditionCount === 0}
                    onClick={() => setConditionTree({ kind: "and", conditions: [] })}
                  >
                    Clear
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  You can nest groups and use NOT. Empty values are ignored when saving.
                </div>

                <ForwardConditionTreeEditor value={conditionTree} onChange={setConditionTree} />
              </div>
            </div>
          )}

          {step === "targets" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Targets</h2>
                <p className="text-sm text-muted-foreground">
                  Add one or more destinations. You can mix different target types.
                </p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Targets</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTargets((prev) => [...prev, createTargetDraft("WEBHOOK")])}
                  >
                    Add target
                  </Button>
                </div>

                <div className="space-y-3">
                  {targets.map((t) => (
                    <div key={t.clientId} className="rounded-md border bg-background p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Type</Label>
                          <Select
                            value={t.type}
                            onValueChange={(value) =>
                              setTargets((prev) =>
                                prev.map((row) =>
                                  row.clientId === t.clientId
                                    ? { ...createTargetDraft(value as TargetType), clientId: row.clientId }
                                    : row
                                )
                              )
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {forwardTypes.map((ft) => (
                                <SelectItem key={ft.value} value={ft.value}>
                                  <div className="flex items-center gap-2">
                                    <ft.icon className="h-4 w-4" />
                                    {ft.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="pt-5 flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestTarget(t)}
                            disabled={testingTargetId === t.clientId}
                          >
                            <TestTube className="mr-2 h-4 w-4" />
                            {testingTargetId === t.clientId ? "Testing..." : "Test"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setTargets((prev) =>
                                prev.length <= 1 ? prev : prev.filter((row) => row.clientId !== t.clientId)
                              )
                            }
                            disabled={targets.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      {t.type === "EMAIL" && (
                        <div className="space-y-2">
                          <Label>Forward to Email Address</Label>
                          <Input
                            type="email"
                            placeholder="forward@example.com"
                            value={t.to || ""}
                            onChange={(e) =>
                              setTargets((prev) =>
                                prev.map((row) =>
                                  row.clientId === t.clientId ? { ...row, to: e.target.value } : row
                                )
                              )
                            }
                          />
                        </div>
                      )}

                      {t.type === "TELEGRAM" && (
                        <>
                          <div className="space-y-2">
                            <Label>Bot Token</Label>
                            <Input
                              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                              value={t.token || ""}
                              onChange={(e) =>
                                setTargets((prev) =>
                                  prev.map((row) =>
                                    row.clientId === t.clientId ? { ...row, token: e.target.value } : row
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Chat ID</Label>
                            <Input
                              placeholder="-1001234567890"
                              value={t.chatId || ""}
                              onChange={(e) =>
                                setTargets((prev) =>
                                  prev.map((row) =>
                                    row.clientId === t.clientId ? { ...row, chatId: e.target.value } : row
                                  )
                                )
                              }
                            />
                          </div>
                        </>
                      )}

                      {(t.type === "DISCORD" || t.type === "SLACK" || t.type === "WEBHOOK") && (
                        <>
                          <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <Input
                              placeholder="https://..."
                              value={t.url || ""}
                              onChange={(e) =>
                                setTargets((prev) =>
                                  prev.map((row) =>
                                    row.clientId === t.clientId ? { ...row, url: e.target.value } : row
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Custom Headers (JSON, optional)</Label>
                            <Textarea
                              placeholder='{"Authorization": "Bearer xxx"}'
                              value={t.headers || ""}
                              onChange={(e) =>
                                setTargets((prev) =>
                                  prev.map((row) =>
                                    row.clientId === t.clientId ? { ...row, headers: e.target.value } : row
                                  )
                                )
                              }
                              rows={3}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "template" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Template</h2>
                <p className="text-sm text-muted-foreground">
                  Optional. Customize message content; otherwise defaults will be used.
                </p>
              </div>

	              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
	                <Label className="text-sm">Variables</Label>
	                <div className="text-xs text-muted-foreground">
	                  <span className="font-mono">{`{{id}} {{subject}} {{fromAddress}} {{fromName}} {{toAddress}} {{textBody}} {{htmlBody}} {{receivedAt}} {{mailboxId}}`}</span>
	                </div>
	
	                {(hasEmailTarget || hasTextTarget) && (
	                  <div className="space-y-2">
	                    <div className="flex items-center justify-between gap-2">
	                      <Label>Text Template</Label>
	                      <div className="flex items-center gap-2">
	                        <Button
	                          type="button"
	                          variant="outline"
	                          size="sm"
	                          onClick={() => setTemplateText(DEFAULT_TEXT_TEMPLATE)}
	                        >
	                          Use default
	                        </Button>
	                        <Button
	                          type="button"
	                          variant="ghost"
	                          size="sm"
	                          onClick={() => setTemplateText("")}
	                          disabled={!templateText.trim()}
	                        >
	                          Clear
	                        </Button>
	                      </div>
	                    </div>
	                    <div className="text-xs text-muted-foreground">
	                      Leave empty to use built-in defaults (Slack/Discord may use rich layouts).
	                    </div>
	                    <Textarea
	                      placeholder={DEFAULT_TEXT_TEMPLATE}
	                      value={templateText}
	                      onChange={(e) => setTemplateText(e.target.value)}
	                      rows={5}
	                    />
	                  </div>
	                )}
	
	                {hasEmailTarget && (
	                  <>
	                    <div className="space-y-2">
	                      <div className="flex items-center justify-between gap-2">
	                        <Label>Subject Template</Label>
	                        <div className="flex items-center gap-2">
	                          <Button
	                            type="button"
	                            variant="outline"
	                            size="sm"
	                            onClick={() => setTemplateSubject(DEFAULT_EMAIL_SUBJECT_TEMPLATE)}
	                          >
	                            Use default
	                          </Button>
	                          <Button
	                            type="button"
	                            variant="ghost"
	                            size="sm"
	                            onClick={() => setTemplateSubject("")}
	                            disabled={!templateSubject.trim()}
	                          >
	                            Clear
	                          </Button>
	                        </div>
	                      </div>
	                      <Input
	                        placeholder={DEFAULT_EMAIL_SUBJECT_TEMPLATE}
	                        value={templateSubject}
	                        onChange={(e) => setTemplateSubject(e.target.value)}
	                      />
	                    </div>
	                    <div className="space-y-2">
	                      <div className="flex items-center justify-between gap-2">
	                        <Label>HTML Template (optional)</Label>
	                        <div className="flex items-center gap-2">
	                          <Button
	                            type="button"
	                            variant="outline"
	                            size="sm"
	                            onClick={() => setTemplateHtml(DEFAULT_EMAIL_HTML_TEMPLATE)}
	                          >
	                            Use default
	                          </Button>
	                          <Button
	                            type="button"
	                            variant="ghost"
	                            size="sm"
	                            onClick={() => setTemplateHtml("")}
	                            disabled={!templateHtml.trim()}
	                          >
	                            Clear
	                          </Button>
	                        </div>
	                      </div>
	                      <Textarea
	                        placeholder={DEFAULT_EMAIL_HTML_TEMPLATE}
	                        value={templateHtml}
	                        onChange={(e) => setTemplateHtml(e.target.value)}
	                        rows={5}
	                      />
	                    </div>
	                  </>
	                )}
	
	                {hasWebhookTarget && (
	                  <>
	                    <div className="space-y-2">
	                      <div className="flex items-center justify-between gap-2">
	                        <Label>Webhook Body Template</Label>
	                        <div className="flex items-center gap-2">
	                          <Button
	                            type="button"
	                            variant="outline"
	                            size="sm"
	                            onClick={() => {
	                              setTemplateWebhookBody(DEFAULT_WEBHOOK_BODY_TEMPLATE);
	                              if (!templateContentType.trim()) setTemplateContentType(DEFAULT_WEBHOOK_CONTENT_TYPE);
	                            }}
	                          >
	                            Use default
	                          </Button>
	                          <Button
	                            type="button"
	                            variant="ghost"
	                            size="sm"
	                            onClick={() => setTemplateWebhookBody("")}
	                            disabled={!templateWebhookBody.trim()}
	                          >
	                            Clear
	                          </Button>
	                        </div>
	                      </div>
	                      <div className="text-xs text-muted-foreground">
	                        Leave empty to send the built-in JSON payload.
	                      </div>
	                      <Textarea
	                        placeholder={DEFAULT_WEBHOOK_BODY_TEMPLATE}
	                        value={templateWebhookBody}
	                        onChange={(e) => setTemplateWebhookBody(e.target.value)}
	                        rows={5}
	                      />
	                    </div>
	                    <div className="space-y-2">
	                      <div className="flex items-center justify-between gap-2">
	                        <Label>Content-Type (optional)</Label>
	                        <div className="flex items-center gap-2">
	                          <Button
	                            type="button"
	                            variant="outline"
	                            size="sm"
	                            onClick={() => setTemplateContentType(DEFAULT_WEBHOOK_CONTENT_TYPE)}
	                          >
	                            Use default
	                          </Button>
	                          <Button
	                            type="button"
	                            variant="ghost"
	                            size="sm"
	                            onClick={() => setTemplateContentType("")}
	                            disabled={!templateContentType.trim()}
	                          >
	                            Clear
	                          </Button>
	                        </div>
	                      </div>
	                      <Input
	                        placeholder={DEFAULT_WEBHOOK_CONTENT_TYPE}
	                        value={templateContentType}
	                        onChange={(e) => setTemplateContentType(e.target.value)}
	                      />
	                    </div>
	                  </>
	                )}
	              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Review</h2>
                <p className="text-sm text-muted-foreground">
                  Confirm everything looks right, then create the rule.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Summary</div>
                    <Badge variant={isStepComplete("review") ? "default" : "secondary"}>
                      {isStepComplete("review") ? "Ready" : "Needs attention"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="text-sm space-y-1">
                    <div><span className="text-muted-foreground">Name:</span> {name.trim() || "(missing)"}</div>
                    <div><span className="text-muted-foreground">Mailbox:</span> {selectedMailboxLabel}</div>
                    <div><span className="text-muted-foreground">Conditions:</span> {stepSummaries.conditions}</div>
                    <div><span className="text-muted-foreground">Targets:</span> {stepSummaries.targets}</div>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div className="text-sm font-medium">Payload Preview</div>
                  <Separator />
                  <pre className="max-h-[320px] overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50">
                    {reviewPayload ? JSON.stringify(reviewPayload, null, 2) : "Invalid configuration"}
                  </pre>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link href="/forwards">Cancel</Link>
                </Button>
                <Button onClick={handleCreate} disabled={saving || !isStepComplete("review")}>
                  {saving ? "Creating..." : "Create Rule"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{testTargetLabel ? `Test: ${testTargetLabel}` : "Test Target"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">
              {testResult ? JSON.stringify(testResult, null, 2) : "No result"}
            </pre>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTestDialogOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleSendTest}
              disabled={!testPayload || sendingTest}
            >
              {sendingTest ? "Sending..." : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={goBack} disabled={currentStepIndex <= 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="text-xs text-muted-foreground">
          Step {currentStepIndex + 1} of {steps.length}
        </div>

        {step === "review" ? (
          <Button onClick={handleCreate} disabled={saving || !isStepComplete("review")}>
            {saving ? "Creating..." : "Create Rule"}
          </Button>
        ) : (
          <Button onClick={goNext}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
