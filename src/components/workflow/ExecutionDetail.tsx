"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import {
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  Mail,
  Timer,
  Loader2,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ExecutionPathNode, ExecutionSummary } from "@/lib/workflow/logging-types";
import { useLocale, useTranslations } from "next-intl";

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

interface Execution {
  id: string;
  workflowId: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  triggeredBy: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  executionPath?: ExecutionPathNode[];
  nodesExecuted: number;
  startedAt: string;
  finishedAt?: string;
}

interface DispatchLog {
  id: string;
  triggerType: string;
  emailId?: string;
  emailFrom?: string;
  emailTo?: string;
  emailSubject?: string;
  dispatched: boolean;
  skipReason?: string;
  createdAt: string;
}

interface ExecutionDetailProps {
  workflowId: string;
  executionId: string;
  open: boolean;
  onClose: () => void;
}

export function ExecutionDetail({
  workflowId,
  executionId,
  open,
  onClose,
}: ExecutionDetailProps) {
  const t = useTranslations("workflows");
  const locale = useLocale();
  const dateFnsLocale = locale === "zh" ? zhCN : enUS;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    execution: Execution;
    nodeLogs: NodeLog[];
    summary: ExecutionSummary;
    dispatchLog?: DispatchLog;
  } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && executionId) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `/api/workflows/${workflowId}/executions/${executionId}/logs`
          );
          if (res.ok) {
            const result = await res.json();
            setData({
              execution: result.execution,
              nodeLogs: result.nodeLogs,
              summary: result.summary,
              dispatchLog: result.dispatchLog,
            });
          }
        } catch (error) {
          console.error("Failed to fetch execution details:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [open, executionId, workflowId]);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("executionDetail.title")}
            {data?.execution && (
              <Badge
                variant={
                  data.execution.status === "SUCCESS" ? "default" : "secondary"
                }
              >
                {getExecutionStatusLabel(t, data.execution.status)}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : data ? (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Execution Info */}
              <div className="grid grid-cols-2 gap-4">
                <InfoCard
                  label={t("executionDetail.info.started")}
                  value={format(
                    new Date(data.execution.startedAt),
                    "MMM d, yyyy HH:mm:ss",
                    { locale: dateFnsLocale }
                  )}
                />
                <InfoCard
                  label={t("executionDetail.info.finished")}
                  value={
                    data.execution.finishedAt
                      ? format(
                          new Date(data.execution.finishedAt),
                          "MMM d, yyyy HH:mm:ss",
                          { locale: dateFnsLocale }
                        )
                      : t("executionDetail.info.running")
                  }
                />
                <InfoCard
                  label={t("executionDetail.info.duration")}
                  value={
                    data.execution.finishedAt
                      ? formatDuration(
                          new Date(data.execution.finishedAt).getTime() -
                            new Date(data.execution.startedAt).getTime()
                        )
                      : t("executionDetail.info.inProgress")
                  }
                />
                <InfoCard
                  label={t("executionDetail.info.trigger")}
                  value={parseTriggerInfo(data.execution.triggeredBy, t).label}
                />
              </div>

              {/* Summary Stats */}
              <div>
                <h4 className="text-sm font-medium mb-2">{t("executionDetail.summary.title")}</h4>
                <div className="grid grid-cols-4 gap-2">
                  <StatCard
                    label={t("executionDetail.summary.totalNodes")}
                    value={data.summary.totalNodes}
                  />
                  <StatCard
                    label={t("executionDetail.summary.success")}
                    value={data.summary.successCount}
                    color="text-green-600"
                  />
                  <StatCard
                    label={t("executionDetail.summary.failed")}
                    value={data.summary.failedCount}
                    color="text-red-600"
                  />
                  <StatCard
                    label={t("executionDetail.summary.skipped")}
                    value={data.summary.skippedCount}
                    color="text-muted-foreground"
                  />
                </div>
              </div>

              {/* Trigger Details */}
              {data.dispatchLog && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t("executionDetail.triggerDetails.title")}</h4>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {data.dispatchLog.triggerType}
                      </Badge>
                      {data.dispatchLog.dispatched ? (
                        <Badge variant="default" className="bg-green-600">
                          {t("executionDetail.triggerDetails.dispatched")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t("executionDetail.triggerDetails.skipped")}</Badge>
                      )}
                    </div>
                    {data.dispatchLog.emailSubject && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t("executionDetail.triggerDetails.subject")}</span>
                        {data.dispatchLog.emailSubject}
                      </div>
                    )}
                    {data.dispatchLog.emailFrom && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t("executionDetail.triggerDetails.from")}</span>
                        {data.dispatchLog.emailFrom}
                      </div>
                    )}
                    {data.dispatchLog.emailTo && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">{t("executionDetail.triggerDetails.to")}</span>
                        {data.dispatchLog.emailTo}
                      </div>
                    )}
                    {data.dispatchLog.skipReason && (
                      <div className="text-sm text-amber-600">
                        <span className="font-medium">{t("executionDetail.triggerDetails.skipReason")}</span>
                        {data.dispatchLog.skipReason}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {data.execution.error && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-red-600">
                    {t("executionDetail.errorTitle")}
                  </h4>
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
                    <pre className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap">
                      {data.execution.error}
                    </pre>
                  </div>
                </div>
              )}

              {/* Node Execution Timeline */}
              <div>
                <h4 className="text-sm font-medium mb-2">{t("executionDetail.timeline.title")}</h4>
                <div className="space-y-1">
                  {data.nodeLogs.map((log, index) => {
                    const StatusIcon = getStatusIcon(log.status);
                    const statusColor = getStatusColor(log.status);
                    const isExpanded = expandedNodes.has(log.id);

                    return (
                      <div key={log.id} className="relative">
                        {/* Timeline connector */}
                        {index < data.nodeLogs.length - 1 && (
                          <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />
                        )}

                        <button
                          onClick={() => toggleNode(log.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                            <div className={cn("mt-0.5", statusColor)}>
                              <StatusIcon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {log.nodeLabel || log.nodeType}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {getNodeStatusLabel(t, log.status)}
                                </Badge>
                                {log.duration !== undefined && (
                                  <span className="text-xs text-muted-foreground">
                                    <Timer className="h-3 w-3 inline mr-0.5" />
                                    {formatDuration(log.duration)}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {log.nodeType}
                              </div>
                              {log.error && (
                                <div className="text-sm text-red-600 mt-1">
                                  {log.error}
                                </div>
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
                          <div className="ml-8 mt-1 mb-2 p-3 bg-muted/30 rounded-lg border space-y-3">
                            {log.input !== null && log.input !== undefined && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                  {t("executionDetail.log.input")}
                                </div>
                                <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-40">
                                  {String(JSON.stringify(log.input, null, 2))}
                                </pre>
                              </div>
                            )}
                            {log.output !== null && log.output !== undefined && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                  {t("executionDetail.log.output")}
                                </div>
                                <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-40">
                                  {String(JSON.stringify(log.output, null, 2))}
                                </pre>
                              </div>
                            )}
                            {log.metadata !== null && log.metadata !== undefined && (
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                  {t("executionDetail.log.metadata")}
                                </div>
                                <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-40">
                                  {String(JSON.stringify(log.metadata, null, 2))}
                                </pre>
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {formatNodeTimelineMeta(t, log)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Input/Output */}
              {data.execution.input !== null && data.execution.input !== undefined && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t("executionDetail.executionInput")}</h4>
                  <pre className="bg-muted/50 p-3 rounded-lg text-xs overflow-auto max-h-40">
                    {String(JSON.stringify(data.execution.input, null, 2))}
                  </pre>
                </div>
              )}

              {data.execution.output !== null && data.execution.output !== undefined && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{t("executionDetail.executionOutput")}</h4>
                  <pre className="bg-muted/50 p-3 rounded-lg text-xs overflow-auto max-h-40">
                    {String(JSON.stringify(data.execution.output, null, 2))}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            {t("executionDetail.loadFailed")}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <div className={cn("text-2xl font-semibold", color)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// Helper functions
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

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

function parseTriggerInfo(triggeredBy: string, t: Translator): { type: string; label: string } {
  if (triggeredBy.startsWith("email:")) {
    return { type: "email", label: t("executionDetail.triggerLabels.email") };
  }
  if (triggeredBy === "manual") {
    return { type: "manual", label: t("executionDetail.triggerLabels.manual") };
  }
  if (triggeredBy === "schedule") {
    return { type: "schedule", label: t("executionDetail.triggerLabels.schedule") };
  }
  return { type: "unknown", label: triggeredBy };
}

function getExecutionStatusLabel(t: Translator, status: Execution["status"]) {
  switch (status) {
    case "RUNNING":
      return t("executionDetail.status.running");
    case "SUCCESS":
      return t("executionDetail.status.success");
    case "FAILED":
      return t("executionDetail.status.failed");
    case "CANCELLED":
      return t("executionDetail.status.cancelled");
    default:
      return status;
  }
}

function getNodeStatusLabel(t: Translator, status: NodeLog["status"]) {
  switch (status) {
    case "RUNNING":
      return t("executionDetail.nodeStatus.running");
    case "SUCCESS":
      return t("executionDetail.nodeStatus.success");
    case "FAILED":
      return t("executionDetail.nodeStatus.failed");
    case "SKIPPED":
      return t("executionDetail.nodeStatus.skipped");
    default:
      return status;
  }
}

function formatNodeTimelineMeta(t: Translator, log: NodeLog) {
  const parts: string[] = [t("executionDetail.log.step", { step: log.stepOrder })];

  if (log.startedAt) {
    parts.push(
      t("executionDetail.log.started", {
        time: format(new Date(log.startedAt), "HH:mm:ss.SSS"),
      })
    );
  }

  if (log.finishedAt) {
    parts.push(
      t("executionDetail.log.finished", {
        time: format(new Date(log.finishedAt), "HH:mm:ss.SSS"),
      })
    );
  }

  return parts.join(" | ");
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
