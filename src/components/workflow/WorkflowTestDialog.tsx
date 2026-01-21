"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  Loader2,
  ChevronDown,
  ChevronRight,
  Mail,
  Timer,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { WorkflowConfig } from "@/lib/workflow/types";

interface TestEmailData {
  fromAddress: string;
  fromName: string;
  toAddress: string;
  subject: string;
  textBody: string;
}

interface NodeLog {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeLabel?: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";
  stepOrder: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  duration?: number;
}

interface ExecutionSummary {
  totalNodes: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  totalDuration: number;
}

interface TestResult {
  success: boolean;
  execution: {
    id: string;
    status: string;
    error?: string;
    startedAt: string;
    finishedAt?: string;
    nodesExecuted: number;
  };
  nodeLogs: NodeLog[];
  summary: ExecutionSummary;
  testInput: TestEmailData;
}

interface WorkflowTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string | null;
  workflowName: string;
  getConfig: () => WorkflowConfig;
}

type Translator = (key: string, values?: Record<string, unknown>) => string;

export function WorkflowTestDialog({
  open,
  onOpenChange,
  workflowId,
  workflowName,
  getConfig,
}: WorkflowTestDialogProps) {
  const t = useTranslations("workflows");
  const [testEmail, setTestEmail] = useState<TestEmailData>(() => ({
    fromAddress: "sender@example.com",
    fromName: t("testDialog.default.fromName"),
    toAddress: "recipient@example.com",
    subject: t("testDialog.default.subject"),
    textBody: t("testDialog.default.textBody"),
  }));
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [activeTab, setActiveTab] = useState<"input" | "result">("input");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const handleTest = async () => {
    if (!workflowId) {
      toast.error(t("testDialog.toast.saveFirst"));
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const config = getConfig();

      const res = await fetch(`/api/workflows/${workflowId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...testEmail,
          config,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("testDialog.toast.testFailed"));
        return;
      }

      setResult(data);
      setActiveTab("result");

      if (data.success) {
        toast.success(t("testDialog.toast.completedSuccess"));
      } else {
        toast.error(t("testDialog.toast.completedErrors"));
      }
    } catch (error) {
      toast.error(t("testDialog.toast.runFailed"));
      console.error("Test error:", error);
    } finally {
      setTesting(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setResult(null);
      setActiveTab("input");
      setExpandedNodes(new Set());
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            {t("testDialog.title", { name: workflowName })}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "input" | "result")}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="mx-6 mt-4 w-fit">
            <TabsTrigger value="input">{t("testDialog.tabs.input")}</TabsTrigger>
            <TabsTrigger value="result" disabled={!result}>
              {t("testDialog.tabs.results")} {result && (
                <Badge
                  variant={result.success ? "default" : "destructive"}
                  className="ml-2 text-xs"
                >
                  {result.success ? t("testDialog.result.success") : t("testDialog.result.failed")}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="flex-1 min-h-0 overflow-auto px-6 pb-4 mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("testDialog.description")}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fromAddress">{t("testDialog.form.fromAddress")}</Label>
                  <Input
                    id="fromAddress"
                    value={testEmail.fromAddress}
                    onChange={(e) =>
                      setTestEmail({ ...testEmail, fromAddress: e.target.value })
                    }
                    placeholder="sender@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromName">{t("testDialog.form.fromName")}</Label>
                  <Input
                    id="fromName"
                    value={testEmail.fromName}
                    onChange={(e) =>
                      setTestEmail({ ...testEmail, fromName: e.target.value })
                    }
                    placeholder={t("testDialog.form.placeholders.fromName")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toAddress">{t("testDialog.form.toAddress")}</Label>
                <Input
                  id="toAddress"
                  value={testEmail.toAddress}
                  onChange={(e) =>
                    setTestEmail({ ...testEmail, toAddress: e.target.value })
                  }
                  placeholder="recipient@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">{t("testDialog.form.subject")}</Label>
                <Input
                  id="subject"
                  value={testEmail.subject}
                  onChange={(e) =>
                    setTestEmail({ ...testEmail, subject: e.target.value })
                  }
                  placeholder={t("testDialog.form.placeholders.subject")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="textBody">{t("testDialog.form.textBody")}</Label>
                <Textarea
                  id="textBody"
                  value={testEmail.textBody}
                  onChange={(e) =>
                    setTestEmail({ ...testEmail, textBody: e.target.value })
                  }
                  placeholder={t("testDialog.form.placeholders.textBody")}
                  rows={6}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="result" className="flex-1 min-h-0 overflow-auto px-6 pb-4 mt-4">
            {result && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-4 gap-3">
                  <SummaryCard
                    label={t("testDialog.summary.totalNodes")}
                    value={result.summary.totalNodes}
                  />
                  <SummaryCard
                    label={t("testDialog.summary.success")}
                    value={result.summary.successCount}
                    color="text-green-600"
                  />
                  <SummaryCard
                    label={t("testDialog.summary.failed")}
                    value={result.summary.failedCount}
                    color="text-red-600"
                  />
                  <SummaryCard
                    label={t("testDialog.summary.duration")}
                    value={formatDuration(result.summary.totalDuration)}
                    isText
                  />
                </div>

                {/* Execution Status */}
                <div className={cn(
                  "p-4 rounded-lg border",
                  result.success
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                    : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
                )}>
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={cn(
                      "font-medium",
                      result.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                    )}>
                      {result.success ? t("testDialog.status.executedSuccess") : t("testDialog.status.executedFailed")}
                    </span>
                  </div>
                  {result.execution.error && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                      {result.execution.error}
                    </p>
                  )}
                </div>

                {/* Node Execution Timeline */}
                <div>
                  <h4 className="text-sm font-medium mb-3">{t("testDialog.timeline.title")}</h4>
                  <div className="space-y-2">
                    {result.nodeLogs.map((log, index) => (
                      <NodeLogItem
                        key={log.id}
                        log={log}
                        isLast={index === result.nodeLogs.length - 1}
                        isExpanded={expandedNodes.has(log.id)}
                        onToggle={() => toggleNode(log.id)}
                        t={t}
                      />
                    ))}
                    {result.nodeLogs.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t("testDialog.timeline.emptyTitle")}</p>
                        <p className="text-xs mt-1">{t("testDialog.timeline.emptyHint")}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Test Input Summary */}
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Mail className="h-4 w-4" />
                    {t("testDialog.emailSummary.title")}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <div><span className="text-muted-foreground">{t("testDialog.emailSummary.from")}</span> {result.testInput.fromName} &lt;{result.testInput.fromAddress}&gt;</div>
                    <div><span className="text-muted-foreground">{t("testDialog.emailSummary.to")}</span> {result.testInput.toAddress}</div>
                    <div><span className="text-muted-foreground">{t("testDialog.emailSummary.subject")}</span> {result.testInput.subject}</div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={handleClose}>
            {t("testDialog.footer.close")}
          </Button>
          <Button onClick={handleTest} disabled={testing || !workflowId}>
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("testDialog.footer.running")}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {t("testDialog.footer.run")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  color?: string;
  isText?: boolean;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <div className={cn("text-2xl font-semibold", color)}>
        {isText ? value : value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function NodeLogItem({
  log,
  isLast,
  isExpanded,
  onToggle,
  t,
}: {
  log: NodeLog;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  t: Translator;
}) {
  const statusColor = getStatusColor(log.status);

  const renderStatusIcon = () => {
    const Icon = getStatusIcon(log.status);
    return <Icon className="h-5 w-5" />;
  };

  const statusLabel = getStatusLabel(t, log.status);
  const timelineMeta = formatTimelineMeta(t, log);

  return (
    <div className="relative">
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />
      )}

      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
          <div className={cn("mt-0.5", statusColor)}>
            {renderStatusIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {log.nodeLabel || log.nodeType}
              </span>
              <Badge variant="outline" className="text-xs">
                {statusLabel}
              </Badge>
              {log.duration !== undefined && (
                <span className="text-xs text-muted-foreground">
                  <Timer className="h-3 w-3 inline mr-0.5" />
                  {formatDuration(log.duration)}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{log.nodeType}</div>
            {log.error && (
              <div className="text-xs text-red-600 mt-1">{log.error}</div>
            )}
          </div>
          <div className="text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="ml-8 mt-1 mb-2 p-3 bg-muted/30 rounded-lg border space-y-3 text-sm">
          {log.input !== null && log.input !== undefined && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {t("testDialog.log.input")}
              </div>
              <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-32">
                {String(JSON.stringify(log.input, null, 2))}
              </pre>
            </div>
          )}
          {log.output !== null && log.output !== undefined && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {t("testDialog.log.output")}
              </div>
              <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-32">
                {String(JSON.stringify(log.output, null, 2))}
              </pre>
            </div>
          )}
          {log.metadata !== null && log.metadata !== undefined && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                {t("testDialog.log.metadata")}
              </div>
              <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-32">
                {String(JSON.stringify(log.metadata, null, 2))}
              </pre>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {timelineMeta}
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusLabel(t: Translator, status: NodeLog["status"]) {
  switch (status) {
    case "RUNNING":
      return t("testDialog.log.status.running");
    case "SUCCESS":
      return t("testDialog.log.status.success");
    case "FAILED":
      return t("testDialog.log.status.failed");
    case "SKIPPED":
      return t("testDialog.log.status.skipped");
    default:
      return status;
  }
}

function formatTimelineMeta(t: Translator, log: NodeLog) {
  const parts: string[] = [t("testDialog.log.step", { step: log.stepOrder })];

  if (log.startedAt) {
    parts.push(
      t("testDialog.log.started", {
        time: format(new Date(log.startedAt), "HH:mm:ss.SSS"),
      })
    );
  }

  if (log.finishedAt) {
    parts.push(
      t("testDialog.log.finished", {
        time: format(new Date(log.finishedAt), "HH:mm:ss.SSS"),
      })
    );
  }

  return parts.join(" | ");
}

function getStatusIcon(status: string) {
  switch (status) {
    case "SUCCESS":
      return CheckCircle2;
    case "FAILED":
      return XCircle;
    case "RUNNING":
      return Clock;
    case "SKIPPED":
      return SkipForward;
    default:
      return Clock;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "SUCCESS":
      return "text-green-600";
    case "FAILED":
      return "text-red-600";
    case "RUNNING":
      return "text-blue-600";
    case "SKIPPED":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}
