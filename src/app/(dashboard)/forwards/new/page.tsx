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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { parseForwardRuleConfig } from "@/services/forward-config";

type StepId = "basic" | "conditions" | "targets" | "template" | "review";
type TargetType = "EMAIL" | "TELEGRAM" | "DISCORD" | "SLACK" | "WEBHOOK";

type TargetDraft = {
  id?: string;
  clientId: string;
  type: TargetType;
  to?: string;
  token?: string;
  chatId?: string;
  url?: string;
  headers?: string;
};

type CreateTargetPayload = { id?: string; type: TargetType; config: string };

type Mailbox = {
  id: string;
  address: string;
};

type ApiForwardTarget = {
  id: string;
  type: TargetType;
  config: string;
};

type ApiForwardRule = {
  id: string;
  name: string;
  mailboxId?: string | null;
  config: string;
  targets: ApiForwardTarget[];
};

type EmailSummary = {
  id: string;
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  receivedAt: string;
  mailbox?: { address: string } | null;
};

type TestEmailSource = "custom" | "existing";

type TestEmailSampleDraft = {
  subject: string;
  fromAddress: string;
  fromName: string;
  toAddress: string;
  textBody: string;
  htmlBody: string;
  receivedAt: string;
};

type ForwardTestSample = {
  subject?: string;
  fromAddress?: string;
  fromName?: string;
  toAddress?: string;
  textBody?: string;
  htmlBody?: string;
  receivedAt?: string;
};

type ForwardTestPayload = {
  config: string;
  targets: CreateTargetPayload[];
  ignoreConditions?: boolean;
  mailboxId?: string;
  emailId?: string;
  sample?: ForwardTestSample;
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

const DEFAULT_TEST_EMAIL_SAMPLE = {
  subject: "Test Forward - TEmail",
  fromAddress: "test@temail.local",
  fromName: "TEmail",
  toAddress: "test@temail.local",
  textBody: "This is a test message from TEmail forward system.",
  htmlBody: "<p>This is a <strong>test</strong> message from TEmail forward system.</p>",
};

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
        return { ...(t.id ? { id: t.id } : {}), type: "EMAIL", config: JSON.stringify({ type: "EMAIL", to }) };
      }
      case "TELEGRAM": {
        const token = t.token?.trim() || "";
        const chatId = t.chatId?.trim() || "";
        if (!token || !chatId) throw new Error(`${prefix}: Telegram token and chat ID are required`);
        return { ...(t.id ? { id: t.id } : {}), type: "TELEGRAM", config: JSON.stringify({ type: "TELEGRAM", token, chatId }) };
      }
      case "DISCORD":
      case "SLACK":
      case "WEBHOOK": {
        const url = t.url?.trim() || "";
        if (!url) throw new Error(`${prefix}: webhook URL is required`);
        const headers = parseHeadersJson(t.headers);
        return { ...(t.id ? { id: t.id } : {}), type: t.type, config: JSON.stringify({ type: t.type, url, headers }) };
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

export function ForwardRuleBuilderPage({ mode = "create", ruleId }: { mode?: "create" | "edit"; ruleId?: string }) {
  const router = useRouter();
  const isEdit = mode === "edit";

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
  const [loadingRule, setLoadingRule] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);

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
  const [testPayload, setTestPayload] = useState<ForwardTestPayload | null>(null);
  const [testingTargetId, setTestingTargetId] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testTargetLabel, setTestTargetLabel] = useState<string | null>(null);

  const [overallTestSource, setOverallTestSource] = useState<TestEmailSource>("custom");
  const [overallTestEmailId, setOverallTestEmailId] = useState<string>("");
  const [overallTestSample, setOverallTestSample] = useState<TestEmailSampleDraft>(() => ({
    ...DEFAULT_TEST_EMAIL_SAMPLE,
    receivedAt: new Date().toISOString(),
  }));
  const [overallIgnoreConditions, setOverallIgnoreConditions] = useState(false);
  const [overallTesting, setOverallTesting] = useState(false);

  const [recentEmails, setRecentEmails] = useState<EmailSummary[]>([]);
  const [recentEmailsLoading, setRecentEmailsLoading] = useState(false);
  const [recentEmailsError, setRecentEmailsError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isEdit) {
      setLoadingRule(false);
      setLoadError(null);
      return;
    }

    if (!ruleId) {
      setLoadingRule(false);
      setLoadError("Missing rule id");
      return;
    }

    const run = async () => {
      setLoadingRule(true);
      setLoadError(null);

      try {
        const res = await fetch(`/api/forwards/${ruleId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setLoadError(data?.error || "Failed to load rule");
          return;
        }

        const rule = data as ApiForwardRule;

        setName(rule.name || "");
        setMailboxId(rule.mailboxId || "");

        const parsed = parseForwardRuleConfig(rule.config);
        if (!parsed.ok) {
          setLoadError(parsed.error);
          return;
        }

        const template = parsed.config.template;

        setTemplateSubject(template?.subject || "");
        setTemplateText(template?.text || "");
        setTemplateHtml(template?.html || "");
        setTemplateWebhookBody(template?.webhookBody || "");
        setTemplateContentType(template?.contentType || "");

        const baseTree: ForwardConditionTree = { kind: "and", conditions: [] };
        const conditions = parsed.config.conditions;
        if (!conditions) {
          setConditionTree(baseTree);
        } else if (conditions.kind === "and" || conditions.kind === "or") {
          setConditionTree(conditions);
        } else {
          setConditionTree({ kind: "and", conditions: [conditions] });
        }

        const nextTargets =
          Array.isArray(rule.targets) && rule.targets.length > 0
            ? rule.targets.map((t) => {
                const clientId = createClientId();

                try {
                  const raw = JSON.parse(t.config) as Record<string, unknown> | null;
                  const headers = raw?.headers && typeof raw.headers === "object" && !Array.isArray(raw.headers) ? raw.headers : null;

                  switch (t.type) {
                    case "EMAIL":
                      return { id: t.id, clientId, type: t.type, to: typeof raw?.to === "string" ? raw.to : "" };
                    case "TELEGRAM":
                      return {
                        id: t.id,
                        clientId,
                        type: t.type,
                        token: typeof raw?.token === "string" ? raw.token : "",
                        chatId: typeof raw?.chatId === "string" ? raw.chatId : "",
                      };
                    case "DISCORD":
                    case "SLACK":
                    case "WEBHOOK":
                      return {
                        id: t.id,
                        clientId,
                        type: t.type,
                        url: typeof raw?.url === "string" ? raw.url : "",
                        headers: headers ? JSON.stringify(headers, null, 2) : "",
                      };
                  }
                } catch {
                  // ignore
                }

                return { id: t.id, ...createTargetDraft(t.type) };
              })
            : [createTargetDraft("WEBHOOK")];

        setTargets(nextTargets);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load rule");
      } finally {
        setLoadingRule(false);
      }
    };

    run();
  }, [isEdit, ruleId]);

  const fetchRecentEmails = useCallback(async () => {
    setRecentEmailsLoading(true);
    setRecentEmailsError(null);
    try {
      const params = new URLSearchParams({ mode: "cursor", limit: "20" });
      if (mailboxId) params.set("mailboxId", mailboxId);
      const res = await fetch(`/api/emails?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setRecentEmails([]);
        setRecentEmailsError(data?.error || "Failed to load emails");
        return;
      }
      setRecentEmails(Array.isArray(data?.emails) ? (data.emails as EmailSummary[]) : []);
    } catch {
      setRecentEmails([]);
      setRecentEmailsError("Failed to load emails");
    } finally {
      setRecentEmailsLoading(false);
    }
  }, [mailboxId]);

  useEffect(() => {
    if (step !== "review") return;
    fetchRecentEmails();
  }, [fetchRecentEmails, step]);

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
      if (isEdit && !ruleId) {
        toast.error("Missing rule id");
        return;
      }

      const config = buildRuleConfig({
        conditionTree,
        templateText,
        templateSubject,
        templateHtml,
        templateWebhookBody,
        templateContentType,
      });
      const builtTargets = buildTargets(targets);

      const res = await fetch(isEdit ? `/api/forwards/${ruleId}` : "/api/forwards", {
        method: isEdit ? "PATCH" : "POST",
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
        toast.error(data?.error || (isEdit ? "Failed to update rule" : "Failed to create rule"));
        return;
      }
      toast.success(isEdit ? "Forward rule updated" : "Forward rule created");
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
          ...(mailboxId ? { mailboxId } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Test failed");
        return;
      }
      setTestPayload({ config, targets: builtTargets, ignoreConditions: true, ...(mailboxId ? { mailboxId } : {}) });
      setTestTargetLabel(label);
      setTestResult(data);
      setTestDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test failed");
    } finally {
      setTestingTargetId(null);
    }
  };

  const resetOverallTestSample = useCallback(() => {
    setOverallTestSample({ ...DEFAULT_TEST_EMAIL_SAMPLE, receivedAt: new Date().toISOString() });
  }, []);

  const handleOverallTest = async () => {
    const targetsError = validateStep("targets");
    if (targetsError) {
      toast.error(targetsError);
      return;
    }

    setOverallTesting(true);
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

      const requestBody: {
        mode: "dry_run";
        config: string;
        targets: CreateTargetPayload[];
        ignoreConditions?: boolean;
        mailboxId?: string;
        emailId?: string;
        sample?: ForwardTestSample;
      } = {
        mode: "dry_run",
        config,
        targets: builtTargets,
        ...(overallIgnoreConditions ? { ignoreConditions: true } : {}),
        ...(mailboxId ? { mailboxId } : {}),
      };

      const label = (() => {
        if (overallTestSource === "existing") return "Overall Test (existing email)";
        return "Overall Test";
      })();

      let samplePayload: ForwardTestSample | undefined;

      if (overallTestSource === "existing") {
        const emailId = overallTestEmailId.trim();
        if (!emailId) {
          toast.error("Please select an email to test");
          return;
        }
        requestBody.emailId = emailId;
      } else {
        const receivedAtInput = overallTestSample.receivedAt.trim();
        const receivedAt = receivedAtInput ? new Date(receivedAtInput) : null;
        const receivedAtIso =
          receivedAtInput && receivedAt && Number.isFinite(receivedAt.getTime())
            ? receivedAt.toISOString()
            : receivedAtInput
              ? null
              : undefined;

        if (receivedAtIso === null) {
          toast.error("ReceivedAt must be a valid ISO datetime");
          return;
        }

        samplePayload = {
          subject: overallTestSample.subject,
          fromAddress: overallTestSample.fromAddress,
          fromName: overallTestSample.fromName,
          toAddress: overallTestSample.toAddress,
          textBody: overallTestSample.textBody,
          htmlBody: overallTestSample.htmlBody,
          ...(receivedAtIso ? { receivedAt: receivedAtIso } : {}),
        };
        requestBody.sample = samplePayload;
      }

      const res = await fetch("/api/forwards/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Test failed");
        setTestResult(data);
        return;
      }

      setTestPayload({
        config,
        targets: builtTargets,
        ...(overallIgnoreConditions ? { ignoreConditions: true } : {}),
        ...(mailboxId ? { mailboxId } : {}),
        ...(requestBody.emailId ? { emailId: requestBody.emailId } : samplePayload ? { sample: samplePayload } : {}),
      });
      setTestTargetLabel(label);
      setTestResult(data);
      setTestDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test failed");
    } finally {
      setOverallTesting(false);
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
          ...(testPayload.ignoreConditions ? { ignoreConditions: true } : {}),
          ...(testPayload.mailboxId ? { mailboxId: testPayload.mailboxId } : {}),
          ...(testPayload.emailId ? { emailId: testPayload.emailId } : {}),
          ...(testPayload.sample ? { sample: testPayload.sample } : {}),
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

  const testResponse = useMemo(() => {
    if (!testResult || typeof testResult !== "object") return null;
    return testResult as {
      matched?: boolean;
      reason?: string;
      success?: boolean;
      error?: string;
      previews?: Array<
        | { index: number; ok: true; preview: { type: string; url?: string; headers?: Record<string, string>; body?: unknown; to?: string; subject?: string; text?: string; html?: string } }
        | { index: number; ok: false; error: string }
      >;
      results?: Array<{ index: number; success: boolean; message: string; responseCode?: number }>;
    };
  }, [testResult]);

  const testPreviews = useMemo(() => (Array.isArray(testResponse?.previews) ? testResponse!.previews : []), [testResponse]);
  const testResults = useMemo(() => (Array.isArray(testResponse?.results) ? testResponse!.results : []), [testResponse]);
  const canSendTest = Boolean(testPayload) && testPreviews.some((p) => p.ok);

  if (isEdit && loadingRule) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isEdit && loadError) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Edit Forward Rule</h1>
          <p className="text-muted-foreground">Unable to load the rule.</p>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
        <Button variant="outline" asChild>
          <Link href="/forwards">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{isEdit ? "Edit Forward Rule" : "New Forward Rule"}</h1>
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
                  Confirm everything looks right, then {isEdit ? "save the changes" : "create the rule"}.
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

              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <TestTube className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm font-medium">Overall Test</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Ignore conditions</Label>
                    <Switch checked={overallIgnoreConditions} onCheckedChange={setOverallIgnoreConditions} />
                  </div>
                </div>

                <Separator />

                <Tabs value={overallTestSource} onValueChange={(value) => setOverallTestSource(value as TestEmailSource)}>
                  <TabsList>
                    <TabsTrigger value="custom">Custom sample</TabsTrigger>
                    <TabsTrigger value="existing">Existing email</TabsTrigger>
                  </TabsList>

                  <TabsContent value="custom">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="text-xs text-muted-foreground">
                          Edit the sample email fields (template provided) and run a dry-run preview.
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={resetOverallTestSample}>
                            Use template
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setOverallTestSample((prev) => ({ ...prev, receivedAt: new Date().toISOString() }))}
                          >
                            Now
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Subject</Label>
                          <Input
                            value={overallTestSample.subject}
                            onChange={(e) => setOverallTestSample((prev) => ({ ...prev, subject: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>ReceivedAt (ISO)</Label>
                          <Input
                            placeholder={new Date().toISOString()}
                            value={overallTestSample.receivedAt}
                            onChange={(e) => setOverallTestSample((prev) => ({ ...prev, receivedAt: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>From name</Label>
                          <Input
                            value={overallTestSample.fromName}
                            onChange={(e) => setOverallTestSample((prev) => ({ ...prev, fromName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>From address</Label>
                          <Input
                            value={overallTestSample.fromAddress}
                            onChange={(e) => setOverallTestSample((prev) => ({ ...prev, fromAddress: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>To address</Label>
                        <Input
                          value={overallTestSample.toAddress}
                          onChange={(e) => setOverallTestSample((prev) => ({ ...prev, toAddress: e.target.value }))}
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Text body</Label>
                          <Textarea
                            value={overallTestSample.textBody}
                            onChange={(e) => setOverallTestSample((prev) => ({ ...prev, textBody: e.target.value }))}
                            rows={6}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label>HTML body</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setOverallTestSample((prev) => ({ ...prev, htmlBody: "" }))}
                              disabled={!overallTestSample.htmlBody.trim()}
                            >
                              Clear
                            </Button>
                          </div>
                          <Textarea
                            value={overallTestSample.htmlBody}
                            onChange={(e) => setOverallTestSample((prev) => ({ ...prev, htmlBody: e.target.value }))}
                            rows={6}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="existing">
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Email ID</Label>
                          <Input
                            placeholder="Select below or paste an email id"
                            value={overallTestEmailId}
                            onChange={(e) => setOverallTestEmailId(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label>Recent emails</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={fetchRecentEmails}
                              disabled={recentEmailsLoading}
                            >
                              {recentEmailsLoading ? "Refreshing..." : "Refresh"}
                            </Button>
                          </div>
                          <Select value={overallTestEmailId} onValueChange={setOverallTestEmailId}>
                            <SelectTrigger>
                              <SelectValue placeholder={recentEmailsLoading ? "Loading..." : "Pick an email"} />
                            </SelectTrigger>
                            <SelectContent>
                              {recentEmails.length === 0 ? (
                                <SelectItem value="__none__" disabled>
                                  No emails found
                                </SelectItem>
                              ) : (
                                recentEmails.map((email) => (
                                  <SelectItem key={email.id} value={email.id}>
                                    <div className="flex flex-col">
                                      <span className="truncate text-sm">{email.subject || "(No subject)"}</span>
                                      <span className="truncate text-xs text-muted-foreground">
                                        {(email.fromName || email.fromAddress)} · {email.mailbox?.address || "Mailbox"} ·{" "}
                                        {new Date(email.receivedAt).toLocaleString()}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {recentEmailsError && (
                        <div className="text-xs text-destructive">{recentEmailsError}</div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Uses the stored email body/HTML for a true end-to-end preview.
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-xs text-muted-foreground">
                    Dry-run builds previews only; use “Send Test” in the dialog to actually deliver.
                  </div>
                  <Button type="button" onClick={handleOverallTest} disabled={overallTesting}>
                    <TestTube className="mr-2 h-4 w-4" />
                    {overallTesting ? "Testing..." : "Run Dry-Run"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link href="/forwards">Cancel</Link>
                </Button>
                <Button onClick={handleCreate} disabled={saving || !isStepComplete("review")}>
                  {saving ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create Rule")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{testTargetLabel ? `Test: ${testTargetLabel}` : "Test Target"}</DialogTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={testResponse?.matched === false ? "secondary" : "default"}>
                {testResponse?.matched === false ? "Not matched" : "Matched"}
              </Badge>
              {typeof testResponse?.success === "boolean" && (
                <Badge variant={testResponse.success ? "default" : "destructive"}>
                  {testResponse.success ? "Sent" : "Failed"}
                </Badge>
              )}
              {testResponse?.reason === "conditions_not_met" && (
                <Badge variant="secondary">conditions_not_met</Badge>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="min-w-0">
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4">
                  {testResponse?.error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {testResponse.error}
                    </div>
                  )}

                  {testPreviews.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No previews.</div>
                  ) : (
                    <div className="space-y-4">
                      {testPreviews.map((p) => {
                        const sendResult = testResults.find((r) => r.index === p.index);
                        return (
                          <div key={p.index} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div className="text-sm font-medium">Target #{p.index + 1}</div>
                              <div className="flex flex-wrap items-center gap-2">
                                {"ok" in p && p.ok && <Badge variant="outline">{p.preview.type}</Badge>}
                                <Badge variant={p.ok ? "default" : "destructive"}>{p.ok ? "OK" : "Error"}</Badge>
                                {sendResult && (
                                  <Badge variant={sendResult.success ? "default" : "destructive"}>
                                    {sendResult.success ? "Sent" : "Failed"}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {!p.ok ? (
                              <div className="text-sm text-destructive">{p.error}</div>
                            ) : p.preview.type === "EMAIL" ? (
                              <div className="space-y-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">To</Label>
                                    <div className="text-sm">{p.preview.to}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Subject</Label>
                                    <div className="text-sm">{p.preview.subject}</div>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Text</Label>
                                  <pre className="max-h-[220px] overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50 whitespace-pre-wrap break-words">
                                    {p.preview.text}
                                  </pre>
                                </div>
                                {p.preview.html ? (
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">HTML</Label>
                                    <pre className="max-h-[220px] overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50 whitespace-pre-wrap break-words">
                                      {p.preview.html}
                                    </pre>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {"url" in p.preview && p.preview.url ? (
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">URL</Label>
                                    <div className="font-mono text-xs break-all">{p.preview.url}</div>
                                  </div>
                                ) : null}

                                {"headers" in p.preview && p.preview.headers ? (
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Headers</Label>
                                    <pre className="max-h-[160px] overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50 whitespace-pre-wrap break-words">
                                      {JSON.stringify(p.preview.headers, null, 2)}
                                    </pre>
                                  </div>
                                ) : null}

                                {"body" in p.preview ? (
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Body</Label>
                                    <pre className="max-h-[220px] overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50 whitespace-pre-wrap break-words">
                                      {typeof p.preview.body === "string" ? p.preview.body : JSON.stringify(p.preview.body, null, 2)}
                                    </pre>
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {sendResult ? (
                              <div className="text-xs text-muted-foreground">
                                {sendResult.message}
                                {typeof sendResult.responseCode === "number" ? ` (HTTP ${sendResult.responseCode})` : ""}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!canSendTest ? (
                    <div className="text-xs text-muted-foreground">
                      Fix target errors to enable sending a test.
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="raw" className="min-w-0">
              <ScrollArea className="max-h-[60vh] pr-4">
                <pre className="overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50 whitespace-pre-wrap break-words">
                  {testResult ? JSON.stringify(testResult, null, 2) : "No result"}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
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
              disabled={!canSendTest || sendingTest}
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
            {saving ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create Rule")}
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

export default function NewForwardRulePage() {
  return <ForwardRuleBuilderPage mode="create" />;
}
