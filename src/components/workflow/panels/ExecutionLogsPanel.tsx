"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  ChevronDown,
  ChevronRight,
  Play,
  Mail,
  Timer,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ExecutionPathNode, ExecutionSummary } from "@/lib/workflow/logging-types";

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

interface ExecutionLogsPanelProps {
  workflowId: string;
}

export function ExecutionLogsPanel({ workflowId }: ExecutionLogsPanelProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workflows/${workflowId}/executions?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions);
      }
    } catch (error) {
      console.error("Failed to fetch executions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
  }, [workflowId]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No executions yet</p>
        <p className="text-xs mt-1">Workflow executions will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-end px-4 py-2 border-b flex-shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={fetchExecutions}
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-2 space-y-2">
          {executions.map((execution) => (
            <ExecutionItem
              key={execution.id}
              execution={execution}
              workflowId={workflowId}
              isSelected={selectedExecutionId === execution.id}
              onSelect={() =>
                setSelectedExecutionId(
                  selectedExecutionId === execution.id ? null : execution.id
                )
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ExecutionItemProps {
  execution: Execution;
  workflowId: string;
  isSelected: boolean;
  onSelect: () => void;
}

function ExecutionItem({
  execution,
  workflowId,
  isSelected,
  onSelect,
}: ExecutionItemProps) {
  const [details, setDetails] = useState<{
    nodeLogs: NodeLog[];
    summary: ExecutionSummary;
    dispatchLog?: DispatchLog;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (isSelected && !details) {
      const fetchDetails = async () => {
        setLoadingDetails(true);
        try {
          const res = await fetch(
            `/api/workflows/${workflowId}/executions/${execution.id}/logs`
          );
          if (res.ok) {
            const data = await res.json();
            setDetails({
              nodeLogs: data.nodeLogs,
              summary: data.summary,
              dispatchLog: data.dispatchLog,
            });
          }
        } catch (error) {
          console.error("Failed to fetch execution details:", error);
        } finally {
          setLoadingDetails(false);
        }
      };
      fetchDetails();
    }
  }, [isSelected, details, execution.id, workflowId]);

  const StatusIcon = getStatusIcon(execution.status);
  const statusColor = getStatusColor(execution.status);
  const triggerInfo = parseTriggerInfo(execution.triggeredBy);

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        isSelected && "border-primary"
      )}
    >
      <button
        onClick={onSelect}
        className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5", statusColor)}>
            <StatusIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge
                variant={execution.status === "SUCCESS" ? "default" : "secondary"}
                className="text-xs"
              >
                {execution.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {execution.nodesExecuted} nodes
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              {triggerInfo.type === "email" ? (
                <Mail className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              <span className="truncate">{triggerInfo.label}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {format(new Date(execution.startedAt), "MMM d, HH:mm:ss")}
              {execution.finishedAt && (
                <span className="ml-2">
                  <Timer className="h-3 w-3 inline mr-0.5" />
                  {formatDuration(
                    new Date(execution.finishedAt).getTime() -
                      new Date(execution.startedAt).getTime()
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="text-muted-foreground">
            {isSelected ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        </div>
      </button>

      {isSelected && (
        <div className="border-t bg-muted/30 p-3">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : details ? (
            <ExecutionDetails
              execution={execution}
              nodeLogs={details.nodeLogs}
              summary={details.summary}
              dispatchLog={details.dispatchLog}
            />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              Failed to load details
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface ExecutionDetailsProps {
  execution: Execution;
  nodeLogs: NodeLog[];
  summary: ExecutionSummary;
  dispatchLog?: DispatchLog;
}

function ExecutionDetails({
  execution,
  nodeLogs,
  summary,
  dispatchLog,
}: ExecutionDetailsProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-background rounded p-2">
          <div className="text-lg font-semibold">{summary.totalNodes}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="bg-background rounded p-2">
          <div className="text-lg font-semibold text-green-600">
            {summary.successCount}
          </div>
          <div className="text-xs text-muted-foreground">Success</div>
        </div>
        <div className="bg-background rounded p-2">
          <div className="text-lg font-semibold text-red-600">
            {summary.failedCount}
          </div>
          <div className="text-xs text-muted-foreground">Failed</div>
        </div>
        <div className="bg-background rounded p-2">
          <div className="text-lg font-semibold text-muted-foreground">
            {summary.skippedCount}
          </div>
          <div className="text-xs text-muted-foreground">Skipped</div>
        </div>
      </div>

      {/* Dispatch Info */}
      {dispatchLog && (
        <div className="bg-background rounded p-2">
          <div className="text-xs font-medium mb-1">Trigger</div>
          <div className="text-xs text-muted-foreground">
            {dispatchLog.triggerType === "email" && dispatchLog.emailSubject && (
              <div className="truncate">
                <Mail className="h-3 w-3 inline mr-1" />
                {dispatchLog.emailSubject}
              </div>
            )}
            {dispatchLog.emailFrom && (
              <div className="truncate mt-0.5">From: {dispatchLog.emailFrom}</div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {execution.error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded p-2">
          <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
            Error
          </div>
          <div className="text-xs text-red-600 dark:text-red-400">
            {execution.error}
          </div>
        </div>
      )}

      {/* Node Execution Timeline */}
      <div>
        <div className="text-xs font-medium mb-2">Execution Timeline</div>
        <div className="space-y-1">
          {nodeLogs.map((log, index) => {
            const StatusIcon = getStatusIcon(log.status);
            const statusColor = getStatusColor(log.status);
            const isExpanded = expandedNodes.has(log.id);

            return (
              <div key={log.id} className="relative">
                {/* Timeline connector */}
                {index < nodeLogs.length - 1 && (
                  <div className="absolute left-[9px] top-6 bottom-0 w-px bg-border" />
                )}

                <button
                  onClick={() => toggleNode(log.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/50">
                    <div className={cn("mt-0.5", statusColor)}>
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate">
                          {log.nodeLabel || log.nodeType}
                        </span>
                        {log.duration !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(log.duration)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.nodeType}
                      </div>
                    </div>
                    <div className="text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="ml-6 mt-1 mb-2 p-2 bg-background rounded border text-xs space-y-2">
                    {log.input !== null && log.input !== undefined && (
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          Input
                        </div>
                        <pre className="bg-muted p-2 rounded overflow-auto max-h-32 text-[10px]">
                          {String(JSON.stringify(log.input, null, 2))}
                        </pre>
                      </div>
                    )}
                    {log.output !== null && log.output !== undefined && (
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          Output
                        </div>
                        <pre className="bg-muted p-2 rounded overflow-auto max-h-32 text-[10px]">
                          {String(JSON.stringify(log.output, null, 2))}
                        </pre>
                      </div>
                    )}
                    {log.error && (
                      <div>
                        <div className="font-medium text-red-600 mb-1">Error</div>
                        <pre className="bg-red-50 dark:bg-red-950/20 p-2 rounded overflow-auto max-h-32 text-[10px] text-red-600">
                          {log.error}
                        </pre>
                      </div>
                    )}
                    {log.metadata !== null && log.metadata !== undefined && (
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          Metadata
                        </div>
                        <pre className="bg-muted p-2 rounded overflow-auto max-h-32 text-[10px]">
                          {String(JSON.stringify(log.metadata, null, 2))}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
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

function parseTriggerInfo(triggeredBy: string): { type: string; label: string } {
  if (triggeredBy.startsWith("email:")) {
    return { type: "email", label: "Email trigger" };
  }
  if (triggeredBy === "manual") {
    return { type: "manual", label: "Manual trigger" };
  }
  if (triggeredBy === "schedule") {
    return { type: "schedule", label: "Scheduled trigger" };
  }
  return { type: "unknown", label: triggeredBy };
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
