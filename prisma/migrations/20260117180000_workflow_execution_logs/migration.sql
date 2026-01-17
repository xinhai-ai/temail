-- CreateTable: WorkflowExecutionLog (节点执行日志)
CREATE TABLE "workflow_execution_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "nodeLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "stepOrder" INTEGER NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "error" TEXT,
    "metadata" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "duration" INTEGER,
    CONSTRAINT "workflow_execution_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "workflow_executions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: WorkflowDispatchLog (调度日志)
CREATE TABLE "workflow_dispatch_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "emailId" TEXT,
    "emailFrom" TEXT,
    "emailTo" TEXT,
    "emailSubject" TEXT,
    "executionId" TEXT,
    "dispatched" BOOLEAN NOT NULL,
    "skipReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_dispatch_logs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflow_dispatch_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "workflow_executions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable: WorkflowExecution 添加执行路径字段
ALTER TABLE "workflow_executions" ADD COLUMN "executionPath" TEXT;
ALTER TABLE "workflow_executions" ADD COLUMN "nodesExecuted" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: WorkflowExecutionLog
CREATE INDEX "workflow_execution_logs_executionId_idx" ON "workflow_execution_logs"("executionId");
CREATE INDEX "workflow_execution_logs_nodeType_idx" ON "workflow_execution_logs"("nodeType");
CREATE INDEX "workflow_execution_logs_status_idx" ON "workflow_execution_logs"("status");

-- CreateIndex: WorkflowDispatchLog
CREATE UNIQUE INDEX "workflow_dispatch_logs_executionId_key" ON "workflow_dispatch_logs"("executionId");
CREATE INDEX "workflow_dispatch_logs_workflowId_idx" ON "workflow_dispatch_logs"("workflowId");
CREATE INDEX "workflow_dispatch_logs_emailId_idx" ON "workflow_dispatch_logs"("emailId");
CREATE INDEX "workflow_dispatch_logs_createdAt_idx" ON "workflow_dispatch_logs"("createdAt");
