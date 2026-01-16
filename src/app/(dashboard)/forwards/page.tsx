"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Forward, Trash2, Power, PowerOff, Mail, MessageCircle, Hash, Globe, TestTube } from "lucide-react";
import { toast } from "sonner";

interface Mailbox {
  id: string;
  address: string;
}

interface ForwardRule {
  id: string;
  name: string;
  type: string;
  status: string;
  config: string;
  mailbox?: { address: string };
  mailboxId?: string;
  lastTriggered?: string;
}

const forwardTypes = [
  { value: "EMAIL", label: "Email", icon: Mail },
  { value: "TELEGRAM", label: "Telegram", icon: MessageCircle },
  { value: "DISCORD", label: "Discord", icon: Hash },
  { value: "SLACK", label: "Slack", icon: Hash },
  { value: "WEBHOOK", label: "Webhook", icon: Globe },
];

type ConditionField = "subject" | "fromAddress" | "toAddress" | "textBody";
type ConditionOperator = "contains" | "equals" | "startsWith" | "endsWith" | "regex";

type ConditionRow = {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
};

export default function ForwardsPage() {
  const ALL_MAILBOXES_SELECT_VALUE = "__all__";
  const [rules, setRules] = useState<ForwardRule[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testRuleId, setTestRuleId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<unknown>(null);
  const [sendingTest, setSendingTest] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("WEBHOOK");
  const [mailboxId, setMailboxId] = useState<string>("");

  // Type-specific config
  const [emailTo, setEmailTo] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookHeaders, setWebhookHeaders] = useState("");

  // Conditions (optional)
  const [conditionLogic, setConditionLogic] = useState<"and" | "or">("and");
  const [conditions, setConditions] = useState<ConditionRow[]>([]);

  // Templates (optional)
  const [templateText, setTemplateText] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateHtml, setTemplateHtml] = useState("");
  const [templateWebhookBody, setTemplateWebhookBody] = useState("");
  const [templateContentType, setTemplateContentType] = useState("");

  const fetchData = async () => {
    const [rulesRes, mailboxesRes] = await Promise.all([
      fetch("/api/forwards"),
      fetch("/api/mailboxes"),
    ]);
    const [rulesData, mailboxesData] = await Promise.all([
      rulesRes.json(),
      mailboxesRes.json(),
    ]);
    setRules(rulesData);
    setMailboxes(mailboxesData);
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      await fetchData();
    };
    run();
  }, []);

  const parseHeaders = () => {
    if (!webhookHeaders.trim()) return {};
    const parsed = JSON.parse(webhookHeaders);
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
  };

  const buildConfig = () => {
    const trimmedConditions = conditions
      .map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value.trim(),
      }))
      .filter((c) => c.value.length > 0);

    const conditionTree =
      trimmedConditions.length > 0
        ? {
            kind: conditionLogic,
            conditions: trimmedConditions.map((c) => ({
              kind: "match",
              field: c.field,
              operator: c.operator,
              value: c.value,
            })),
          }
        : undefined;

    const template: Record<string, string> = {};

    if (type === "EMAIL") {
      if (templateSubject.trim()) template.subject = templateSubject.trim();
      if (templateText.trim()) template.text = templateText;
      if (templateHtml.trim()) template.html = templateHtml;
    } else if (type === "WEBHOOK") {
      if (templateWebhookBody.trim()) template.webhookBody = templateWebhookBody;
      if (templateContentType.trim()) template.contentType = templateContentType.trim();
    } else {
      if (templateText.trim()) template.text = templateText;
    }

    switch (type) {
      case "EMAIL":
        return JSON.stringify({
          version: 2,
          destination: { type: "EMAIL", to: emailTo },
          ...(conditionTree ? { conditions: conditionTree } : {}),
          ...(Object.keys(template).length > 0 ? { template } : {}),
        });
      case "TELEGRAM":
        return JSON.stringify({
          version: 2,
          destination: { type: "TELEGRAM", token: telegramToken, chatId: telegramChatId },
          ...(conditionTree ? { conditions: conditionTree } : {}),
          ...(Object.keys(template).length > 0 ? { template } : {}),
        });
      case "DISCORD":
      case "SLACK":
      case "WEBHOOK":
        return JSON.stringify({
          version: 2,
          destination: {
            type,
            url: webhookUrl,
            headers: parseHeaders(),
          },
          ...(conditionTree ? { conditions: conditionTree } : {}),
          ...(Object.keys(template).length > 0 ? { template } : {}),
        });
      default:
        return JSON.stringify({ version: 2, destination: { type, url: webhookUrl, headers: {} } });
    }
  };

  const resetForm = () => {
    setName("");
    setType("WEBHOOK");
    setMailboxId("");
    setEmailTo("");
    setTelegramToken("");
    setTelegramChatId("");
    setWebhookUrl("");
    setWebhookHeaders("");
    setConditionLogic("and");
    setConditions([]);
    setTemplateText("");
    setTemplateSubject("");
    setTemplateHtml("");
    setTemplateWebhookBody("");
    setTemplateContentType("");
  };

  const handleCreate = async () => {
    if (!name) {
      toast.error("Please enter a name");
      return;
    }

    if (type === "EMAIL" && !emailTo.trim()) {
      toast.error("Email recipient is required");
      return;
    }
    if (type === "TELEGRAM" && (!telegramToken.trim() || !telegramChatId.trim())) {
      toast.error("Telegram token and chat ID are required");
      return;
    }
    if ((type === "DISCORD" || type === "SLACK" || type === "WEBHOOK") && !webhookUrl.trim()) {
      toast.error("Webhook URL is required");
      return;
    }

    try {
      const config = buildConfig();

      const res = await fetch("/api/forwards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          config,
          mailboxId: mailboxId || null,
        }),
      });

      if (res.ok) {
        toast.success("Forward rule created");
        setOpen(false);
        resetForm();
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create rule");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid configuration format");
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch(`/api/forwards/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Test failed");
        return;
      }
      setTestRuleId(id);
      setTestResult(data);
      setTestDialogOpen(true);
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(null);
    }
  };

  const handleSendTest = async () => {
    if (!testRuleId) return;
    setSendingTest(true);
    try {
      const res = await fetch(`/api/forwards/${testRuleId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "send" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Test failed");
        return;
      }
      toast.success("Test sent!");
      setTestResult(data);
    } catch {
      toast.error("Test failed");
    } finally {
      setSendingTest(false);
    }
  };

  const handleToggle = async (id: string, status: string) => {
    const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await fetch(`/api/forwards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    const res = await fetch(`/api/forwards/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Rule deleted");
      fetchData();
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
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forward Rules</h1>
          <p className="text-muted-foreground mt-1">
            Configure email forwarding to external services
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Forward Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
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
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All mailboxes" />
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

              <div className="space-y-2">
                <Label>Forward Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {forwardTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <t.icon className="h-4 w-4" />
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
                            {/* Email Config */}
              {type === "EMAIL" && (
                <div className="space-y-2">
                  <Label>Forward to Email Address</Label>
                  <Input
                    type="email"
                    placeholder="forward@example.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                </div>
              )}

              {/* Telegram Config */}
              {type === "TELEGRAM" && (
                <>
                  <div className="space-y-2">
                    <Label>Bot Token</Label>
                    <Input
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Chat ID</Label>
                    <Input
                      placeholder="-1001234567890"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Discord/Slack/Webhook Config */}
              {(type === "DISCORD" || type === "SLACK" || type === "WEBHOOK") && (
                <>
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <Input
                      placeholder="https://..."
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Headers (JSON, optional)</Label>
                    <Textarea
                      placeholder='{"Authorization": "Bearer xxx"}'
                      value={webhookHeaders}
                      onChange={(e) => setWebhookHeaders(e.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              )}

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Conditions (optional)</Label>
                  <Select value={conditionLogic} onValueChange={(v) => setConditionLogic(v as "and" | "or")}>
                    <SelectTrigger className="h-8 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="and">Match all</SelectItem>
                      <SelectItem value="or">Match any</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {conditions.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No conditions. This rule matches all emails.</div>
                ) : (
                  <div className="space-y-2">
                    {conditions.map((c, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <Select
                            value={c.field}
                            onValueChange={(value) =>
                              setConditions((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, field: value as ConditionField } : row))
                              )
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="subject">Subject</SelectItem>
                              <SelectItem value="fromAddress">From</SelectItem>
                              <SelectItem value="toAddress">To</SelectItem>
                              <SelectItem value="textBody">Text</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-4">
                          <Select
                            value={c.operator}
                            onValueChange={(value) =>
                              setConditions((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, operator: value as ConditionOperator } : row))
                              )
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contains">contains</SelectItem>
                              <SelectItem value="equals">equals</SelectItem>
                              <SelectItem value="startsWith">startsWith</SelectItem>
                              <SelectItem value="endsWith">endsWith</SelectItem>
                              <SelectItem value="regex">regex</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Input
                            className="h-8"
                            placeholder="Value"
                            value={c.value}
                            onChange={(e) =>
                              setConditions((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, value: e.target.value } : row))
                              )
                            }
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setConditions((prev) => prev.filter((_, i) => i !== index))}
                            aria-label="Remove condition"
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConditions((prev) => [...prev, { field: "subject", operator: "contains", value: "" }])}
                >
                  Add condition
                </Button>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <Label className="text-sm">Template (optional)</Label>
                <div className="text-xs text-muted-foreground">
                  Variables: <span className="font-mono">{`{{subject}} {{fromAddress}} {{fromName}} {{toAddress}} {{textBody}} {{receivedAt}} {{mailboxId}}`}</span>
                </div>

                {(type === "TELEGRAM" || type === "DISCORD" || type === "SLACK") && (
                  <div className="space-y-2">
                    <Label>Text Template</Label>
                    <Textarea
                      placeholder="New email: {{subject}}"
                      value={templateText}
                      onChange={(e) => setTemplateText(e.target.value)}
                      rows={5}
                    />
                  </div>
                )}

                {type === "EMAIL" && (
                  <>
                    <div className="space-y-2">
                      <Label>Subject Template</Label>
                      <Input
                        placeholder="[TEmail] {{subject}}"
                        value={templateSubject}
                        onChange={(e) => setTemplateSubject(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Text Template</Label>
                      <Textarea
                        placeholder="{{textBody}}"
                        value={templateText}
                        onChange={(e) => setTemplateText(e.target.value)}
                        rows={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>HTML Template (optional)</Label>
                      <Textarea
                        placeholder="{{htmlBody}}"
                        value={templateHtml}
                        onChange={(e) => setTemplateHtml(e.target.value)}
                        rows={5}
                      />
                    </div>
                  </>
                )}

                {type === "WEBHOOK" && (
                  <>
                    <div className="space-y-2">
                      <Label>Webhook Body Template</Label>
                      <Textarea
                        placeholder='{"subject": "{{subject}}", "from": "{{fromAddress}}"}'
                        value={templateWebhookBody}
                        onChange={(e) => setTemplateWebhookBody(e.target.value)}
                        rows={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Content-Type (optional)</Label>
                      <Input
                        placeholder="application/json"
                        value={templateContentType}
                        onChange={(e) => setTemplateContentType(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <Button onClick={handleCreate} className="w-full">
                Create Rule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">
              {JSON.stringify(testResult, null, 2)}
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
              disabled={!testRuleId || sendingTest}
            >
              {sendingTest ? "Sending..." : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rules.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Forward className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No forward rules yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Create a rule to forward emails</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mailbox</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        rule.status === "ACTIVE"
                          ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {rule.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {rule.mailbox?.address || "All"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTest(rule.id)}
                        disabled={testing === rule.id}
                      >
                        <TestTube className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(rule.id, rule.status)}
                      >
                        {rule.status === "ACTIVE" ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(rule.id)}
                        className="hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
