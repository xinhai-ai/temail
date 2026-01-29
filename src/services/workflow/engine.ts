import { prisma } from "@/lib/prisma";
import type {
  WorkflowConfig,
  WorkflowNode,
  ExecutionContext,
  ExecutionLog,
  EmailContext,
  NodeType,
} from "@/lib/workflow/types";
import { NODE_DEFINITIONS } from "@/lib/workflow/types";
import { topologicalSort, getNextNodes } from "@/lib/workflow/utils";
import { executeNode } from "./executor";
import { WorkflowLogger, cleanupWorkflowExecutionLogs } from "./logging";
import { getOrCreateEmailPreviewLink } from "@/services/email-preview-links";
import { assertUserGroupFeatureEnabled } from "@/services/usergroups/policy";

const DEFAULT_MAX_STEPS = 1_000;
const DEFAULT_MAX_DURATION_MS = 26 * 60 * 60_000;
const DEFAULT_MAX_LOG_STRING_CHARS = 2_000;
const DEFAULT_MAX_LOG_OBJECT_DEPTH = 6;

const SECRET_KEY_PATTERN = /(token|secret|password|api[_-]?key|authorization)/i;

function truncateForLogs(value: string | undefined, maxChars = DEFAULT_MAX_LOG_STRING_CHARS): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}…`;
}

function redactSecrets(value: unknown, depth: number = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= DEFAULT_MAX_LOG_OBJECT_DEPTH) return "[REDACTED]";

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => redactSecrets(item, depth + 1));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        out[key] = "[REDACTED]";
        continue;
      }
      if (key.toLowerCase() === "headers" && v && typeof v === "object" && !Array.isArray(v)) {
        const headersObj = v as Record<string, unknown>;
        const redactedHeaders: Record<string, unknown> = {};
        for (const [headerName, headerValue] of Object.entries(headersObj)) {
          if (SECRET_KEY_PATTERN.test(headerName)) {
            redactedHeaders[headerName] = "[REDACTED]";
          } else {
            redactedHeaders[headerName] = truncateForLogs(typeof headerValue === "string" ? headerValue : String(headerValue));
          }
        }
        out[key] = redactedHeaders;
        continue;
      }
      out[key] = redactSecrets(v, depth + 1);
    }
    return out;
  }

  if (typeof value === "string") return truncateForLogs(value);
  return value;
}

function buildSafeEmailContextForLogs(email: EmailContext | undefined): EmailContext | undefined {
  if (!email) return undefined;
  return {
    ...email,
    subject: truncateForLogs(email.subject, 512) || email.subject,
    textBody: truncateForLogs(email.textBody),
    htmlBody: truncateForLogs(email.htmlBody),
  };
}

export class WorkflowEngine {
  private workflowId: string;
  private executionId: string;
  private config: WorkflowConfig;
  private context: ExecutionContext;
  private aborted: boolean = false;
  private logger: WorkflowLogger;
  private startedAtMs: number = Date.now();
  private stepsExecuted: number = 0;
  private maxSteps: number;
  private maxDurationMs: number;

  constructor(
    workflowId: string,
    executionId: string,
    config: WorkflowConfig,
    isTestMode: boolean = false,
    options?: { maxSteps?: number; maxDurationMs?: number }
  ) {
    this.workflowId = workflowId;
    this.executionId = executionId;
    this.config = config;
    this.context = {
      variables: {},
      logs: [],
      isTestMode,
    };
    this.logger = new WorkflowLogger(executionId);
    this.maxSteps = typeof options?.maxSteps === "number" && Number.isFinite(options.maxSteps) && options.maxSteps > 0
      ? Math.floor(options.maxSteps)
      : DEFAULT_MAX_STEPS;
    this.maxDurationMs = typeof options?.maxDurationMs === "number" && Number.isFinite(options.maxDurationMs) && options.maxDurationMs > 0
      ? Math.floor(options.maxDurationMs)
      : DEFAULT_MAX_DURATION_MS;
  }

  async execute(emailContext?: EmailContext): Promise<void> {
    this.startedAtMs = Date.now();
    if (emailContext) {
      this.context.email = emailContext;
      if (!this.context.isTestMode) {
        try {
          const link = await getOrCreateEmailPreviewLink(emailContext.id);
          if (link?.url) {
            this.context.email = { ...emailContext, previewUrl: link.url };
          }
        } catch (error) {
          console.error("[workflow] Failed to create preview link:", error);
        }
      }
    }

    try {
      await this.updateExecutionStatus("RUNNING");

      // Find trigger node
      const triggerNode = this.config.nodes.find((n) =>
        n.type.startsWith("trigger:")
      );

      if (!triggerNode) {
        throw new Error("No trigger node found");
      }

      // Execute workflow starting from trigger
      await this.executeFromNode(triggerNode.id);

      // Reaching `control:end` is a normal termination (still SUCCESS).
      await this.updateExecutionStatus("SUCCESS");
    } catch (error) {
      console.error("Workflow execution error:", error);
      await this.updateExecutionStatus(
        "FAILED",
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }

  private async executeFromNode(nodeId: string): Promise<void> {
    if (this.aborted) return;
    if (Date.now() - this.startedAtMs > this.maxDurationMs) {
      throw new Error(`Workflow execution timed out after ${this.maxDurationMs}ms`);
    }
    this.stepsExecuted += 1;
    if (this.stepsExecuted > this.maxSteps) {
      throw new Error(`Workflow exceeded maximum steps (${this.maxSteps})`);
    }

    const node = this.config.nodes.find((n) => n.id === nodeId);
    if (!node) {
      this.log(nodeId, "trigger:manual", "failed", `Node not found: ${nodeId}`);
      return;
    }

    const startTime = Date.now();
    const nodeLabel = (node.data as { label?: string })?.label;

    // Build input for logging
    const nodeInput = {
      nodeConfig: redactSecrets(node.data),
      emailContext: buildSafeEmailContextForLogs(this.context.email),
      variables: this.context.variables,
    };

    // Start node logging
    const logId = await this.logger.startNode(
      node.id,
      node.type,
      nodeLabel,
      nodeInput
    );

    try {
      // Execute the node
      const result = await executeNode(node, this.context);

      const duration = Date.now() - startTime;
      this.log(node.id, node.type, "success", "Executed successfully", duration, result);

      // Complete node logging
      await this.logger.completeNode(logId, result, {
        duration,
        nextNodes: this.getNextNodesToExecute(node, result),
      });

      // Handle special cases
      if (node.type === "control:end") {
        this.aborted = true;
        return;
      }

      // Find next nodes to execute
      const nextNodeIds = this.getNextNodesToExecute(node, result);

      // Execute next nodes
      for (const nextId of nextNodeIds) {
        await this.executeFromNode(nextId);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : "Execution failed";
      this.log(node.id, node.type, "failed", message, duration);

      // Fail node logging
      await this.logger.failNode(logId, message, { duration });

      throw error;
    }
  }

  private getNextNodesToExecute(
    node: WorkflowNode,
    executionResult: unknown
  ): string[] {
    const definition = NODE_DEFINITIONS[node.type];

    // Legacy keyword boolean mode (backward compatibility)
    if (node.type === "condition:keyword" && typeof executionResult === "boolean") {
      const handle = executionResult ? "true" : "false";
      return getNextNodes(node.id, this.config.edges, handle);
    }

    // Multi-way classification nodes
    if (definition?.outputs === "multi") {
      const category = executionResult as string;
      const categoryNodes = getNextNodes(node.id, this.config.edges, category);
      if (categoryNodes.length > 0) {
        return categoryNodes;
      }
      return getNextNodes(node.id, this.config.edges, "default");
    }

    // Binary conditional nodes
    if (definition?.outputs === "conditional") {
      const matched = Boolean(executionResult);
      const handle = matched ? "true" : "false";
      return getNextNodes(node.id, this.config.edges, handle);
    }

    // For regular nodes, follow all outgoing edges
    return getNextNodes(node.id, this.config.edges);
  }

  private log(
    nodeId: string,
    nodeType: NodeType,
    status: "success" | "failed" | "skipped",
    message?: string,
    duration?: number,
    output?: unknown
  ): void {
    const log: ExecutionLog = {
      nodeId,
      nodeType,
      status,
      message,
      timestamp: new Date(),
      duration,
      output,
    };

    this.context.logs.push(log);
  }

  private async updateExecutionStatus(
    status: "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED",
    error?: string
  ): Promise<void> {
    // Ensure all logs are written
    await this.logger.flush();

    const updateData: {
      status: "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
      logs?: string;
      output?: string;
      error?: string;
      finishedAt?: Date;
      executionPath?: string;
      nodesExecuted?: number;
    } = {
      status,
      logs: JSON.stringify(this.context.logs),
    };

    if (status === "SUCCESS" || status === "FAILED" || status === "CANCELLED") {
      updateData.finishedAt = new Date();
      updateData.output = JSON.stringify({
        variables: this.context.variables,
        logsCount: this.context.logs.length,
      });
      updateData.executionPath = JSON.stringify(this.logger.getExecutionPath());
      updateData.nodesExecuted = this.logger.getNodesExecuted();
    }

    if (error) {
      updateData.error = error;
    }

    await prisma.workflowExecution.update({
      where: { id: this.executionId },
      data: updateData,
    });

    // Clean up old execution logs when execution finishes
    if (status === "SUCCESS" || status === "FAILED" || status === "CANCELLED") {
      try {
        const deletedCount = await cleanupWorkflowExecutionLogs(this.workflowId);
        if (deletedCount > 0) {
          console.log(`[workflow] Cleaned up ${deletedCount} old execution logs for workflow ${this.workflowId}`);
        }
      } catch (cleanupError) {
        console.error("[workflow] Failed to cleanup execution logs:", cleanupError);
      }
    }
  }
}

// Helper function to trigger workflow execution
export async function triggerWorkflow(
  workflowId: string,
  triggeredBy: string,
  emailContext?: EmailContext
): Promise<string> {
  // Get workflow
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const feature = await assertUserGroupFeatureEnabled({ userId: workflow.userId, feature: "workflow" });
  if (!feature.ok) {
    throw new Error(feature.error);
  }

  if (workflow.status !== "ACTIVE") {
    throw new Error("Workflow is not active");
  }

  const config = JSON.parse(workflow.config) as WorkflowConfig;

  // Create execution record
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId,
      status: "RUNNING",
      triggeredBy,
      input: emailContext ? JSON.stringify(emailContext) : null,
    },
  });

  // Execute workflow (async, don't wait)
  const engine = new WorkflowEngine(workflowId, execution.id, config);
  engine.execute(emailContext).catch((error) => {
    console.error("Workflow execution error:", error);
  });

  return execution.id;
}
