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

export class WorkflowEngine {
  private workflowId: string;
  private executionId: string;
  private config: WorkflowConfig;
  private context: ExecutionContext;
  private aborted: boolean = false;
  private logger: WorkflowLogger;

  constructor(workflowId: string, executionId: string, config: WorkflowConfig, isTestMode: boolean = false) {
    this.workflowId = workflowId;
    this.executionId = executionId;
    this.config = config;
    this.context = {
      variables: {},
      logs: [],
      isTestMode,
    };
    this.logger = new WorkflowLogger(executionId);
  }

  async execute(emailContext?: EmailContext): Promise<void> {
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

    const node = this.config.nodes.find((n) => n.id === nodeId);
    if (!node) {
      this.log(nodeId, "trigger:manual", "failed", `Node not found: ${nodeId}`);
      return;
    }

    const startTime = Date.now();
    const nodeLabel = (node.data as { label?: string })?.label;

    // Build input for logging
    const nodeInput = {
      nodeConfig: node.data,
      emailContext: this.context.email,
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
