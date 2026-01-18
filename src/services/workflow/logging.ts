import { prisma } from "@/lib/prisma";
import type {
  NodeLogEntry,
  NodeLogStatus,
  DispatchLogEntry,
  ExecutionPathNode,
  ExecutionSummary,
} from "@/lib/workflow/logging-types";

// Default max execution logs per workflow (can be overridden by system setting)
const DEFAULT_MAX_EXECUTION_LOGS = 100;

/**
 * Get the maximum number of execution logs to keep per workflow
 */
async function getMaxExecutionLogs(): Promise<number> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "workflow_max_execution_logs" },
    });
    if (setting?.value) {
      const parsed = parseInt(setting.value, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore errors, use default
  }
  return DEFAULT_MAX_EXECUTION_LOGS;
}

/**
 * Clean up old workflow execution logs that exceed the limit
 */
export async function cleanupWorkflowExecutionLogs(workflowId: string): Promise<number> {
  const maxLogs = await getMaxExecutionLogs();

  // Get the count of executions for this workflow
  const count = await prisma.workflowExecution.count({
    where: { workflowId },
  });

  if (count <= maxLogs) {
    return 0;
  }

  // Find executions to delete (oldest ones beyond the limit)
  const executionsToDelete = await prisma.workflowExecution.findMany({
    where: { workflowId },
    orderBy: { startedAt: "desc" },
    skip: maxLogs,
    select: { id: true },
  });

  if (executionsToDelete.length === 0) {
    return 0;
  }

  const idsToDelete = executionsToDelete.map((e) => e.id);

  // Delete execution logs first (cascade should handle this, but be explicit)
  await prisma.workflowExecutionLog.deleteMany({
    where: { executionId: { in: idsToDelete } },
  });

  // Delete the executions
  const result = await prisma.workflowExecution.deleteMany({
    where: { id: { in: idsToDelete } },
  });

  return result.count;
}

/**
 * WorkflowLogger - 工作流执行日志记录器
 * 用于记录节点执行的详细日志
 */
export class WorkflowLogger {
  private executionId: string;
  private stepCounter: number = 0;
  private pendingWrites: Promise<unknown>[] = [];
  private executionPath: ExecutionPathNode[] = [];
  private nodeLogIds: Map<string, string> = new Map();

  constructor(executionId: string) {
    this.executionId = executionId;
  }

  /**
   * 记录节点开始执行
   */
  async startNode(
    nodeId: string,
    nodeType: string,
    nodeLabel?: string,
    input?: unknown
  ): Promise<string> {
    const stepOrder = ++this.stepCounter;

    const writePromise = prisma.workflowExecutionLog.create({
      data: {
        executionId: this.executionId,
        nodeId,
        nodeType,
        nodeLabel,
        status: "RUNNING",
        stepOrder,
        input: input ? JSON.stringify(input) : null,
        startedAt: new Date(),
      },
    });

    this.pendingWrites.push(writePromise);

    const log = await writePromise;
    this.nodeLogIds.set(nodeId, log.id);

    return log.id;
  }

  /**
   * 记录节点执行成功
   */
  async completeNode(
    logId: string,
    output?: unknown,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const now = new Date();

    const writePromise = prisma.workflowExecutionLog.update({
      where: { id: logId },
      data: {
        status: "SUCCESS",
        output: output ? JSON.stringify(output) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        finishedAt: now,
        duration: await this.calculateDuration(logId, now),
      },
    });

    this.pendingWrites.push(writePromise);

    const log = await writePromise;
    this.executionPath.push({
      nodeId: log.nodeId,
      nodeType: log.nodeType,
      nodeLabel: log.nodeLabel || undefined,
      status: "SUCCESS",
      duration: log.duration || undefined,
    });
  }

  /**
   * 记录节点执行失败
   */
  async failNode(
    logId: string,
    error: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const now = new Date();

    const writePromise = prisma.workflowExecutionLog.update({
      where: { id: logId },
      data: {
        status: "FAILED",
        error,
        metadata: metadata ? JSON.stringify(metadata) : null,
        finishedAt: now,
        duration: await this.calculateDuration(logId, now),
      },
    });

    this.pendingWrites.push(writePromise);

    const log = await writePromise;
    this.executionPath.push({
      nodeId: log.nodeId,
      nodeType: log.nodeType,
      nodeLabel: log.nodeLabel || undefined,
      status: "FAILED",
      duration: log.duration || undefined,
    });
  }

  /**
   * 记录节点跳过
   */
  async skipNode(
    nodeId: string,
    nodeType: string,
    reason: string,
    nodeLabel?: string
  ): Promise<void> {
    const stepOrder = ++this.stepCounter;
    const now = new Date();

    const writePromise = prisma.workflowExecutionLog.create({
      data: {
        executionId: this.executionId,
        nodeId,
        nodeType,
        nodeLabel,
        status: "SKIPPED",
        stepOrder,
        metadata: JSON.stringify({ skipReason: reason }),
        startedAt: now,
        finishedAt: now,
        duration: 0,
      },
    });

    this.pendingWrites.push(writePromise);
    await writePromise;

    this.executionPath.push({
      nodeId,
      nodeType,
      nodeLabel,
      status: "SKIPPED",
      duration: 0,
    });
  }

  /**
   * 获取节点日志ID
   */
  getLogId(nodeId: string): string | undefined {
    return this.nodeLogIds.get(nodeId);
  }

  /**
   * 等待所有日志写入完成
   */
  async flush(): Promise<void> {
    await Promise.all(this.pendingWrites);
    this.pendingWrites = [];
  }

  /**
   * 获取执行路径
   */
  getExecutionPath(): ExecutionPathNode[] {
    return [...this.executionPath];
  }

  /**
   * 获取执行的节点数量
   */
  getNodesExecuted(): number {
    return this.stepCounter;
  }

  /**
   * 计算节点执行时长
   */
  private async calculateDuration(logId: string, endTime: Date): Promise<number> {
    const log = await prisma.workflowExecutionLog.findUnique({
      where: { id: logId },
      select: { startedAt: true },
    });

    if (!log) return 0;
    return endTime.getTime() - log.startedAt.getTime();
  }
}

/**
 * 记录工作流调度事件
 */
export async function logWorkflowDispatch(entry: DispatchLogEntry): Promise<string> {
  const log = await prisma.workflowDispatchLog.create({
    data: {
      workflowId: entry.workflowId,
      triggerType: entry.triggerType,
      emailId: entry.emailId,
      emailFrom: entry.emailFrom,
      emailTo: entry.emailTo,
      emailSubject: entry.emailSubject,
      executionId: entry.executionId,
      dispatched: entry.dispatched,
      skipReason: entry.skipReason,
    },
  });

  return log.id;
}

/**
 * 更新调度日志的执行ID
 */
export async function updateDispatchLogExecution(
  dispatchLogId: string,
  executionId: string
): Promise<void> {
  await prisma.workflowDispatchLog.update({
    where: { id: dispatchLogId },
    data: { executionId },
  });
}

/**
 * 获取执行摘要
 */
export async function getExecutionSummary(executionId: string): Promise<ExecutionSummary> {
  const logs = await prisma.workflowExecutionLog.findMany({
    where: { executionId },
    orderBy: { stepOrder: "asc" },
  });

  const successCount = logs.filter((l) => l.status === "SUCCESS").length;
  const failedCount = logs.filter((l) => l.status === "FAILED").length;
  const skippedCount = logs.filter((l) => l.status === "SKIPPED").length;
  const totalDuration = logs.reduce((sum, l) => sum + (l.duration || 0), 0);

  const executionPath: ExecutionPathNode[] = logs.map((l) => ({
    nodeId: l.nodeId,
    nodeType: l.nodeType,
    nodeLabel: l.nodeLabel || undefined,
    status: l.status as NodeLogStatus,
    duration: l.duration || undefined,
  }));

  return {
    totalNodes: logs.length,
    successCount,
    failedCount,
    skippedCount,
    totalDuration,
    executionPath,
  };
}
