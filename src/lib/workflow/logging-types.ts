import type { NodeType } from "./types";

export type NodeLogStatus = "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

export interface NodeLogEntry {
  id?: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  nodeLabel?: string;
  status: NodeLogStatus;
  stepOrder: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  startedAt: Date;
  finishedAt?: Date;
  duration?: number;
}

export interface DispatchLogEntry {
  workflowId: string;
  workflowName?: string;
  triggerType: "email" | "schedule" | "manual";
  emailId?: string;
  emailFrom?: string;
  emailTo?: string;
  emailSubject?: string;
  executionId?: string;
  dispatched: boolean;
  skipReason?: string;
}

export interface ExecutionPathNode {
  nodeId: string;
  nodeType: string;
  nodeLabel?: string;
  status: NodeLogStatus;
  duration?: number;
}

export interface ExecutionSummary {
  totalNodes: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  totalDuration: number;
  executionPath: ExecutionPathNode[];
}
