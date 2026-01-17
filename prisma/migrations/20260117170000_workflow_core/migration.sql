-- CreateTable: Workflow (工作流定义)
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "config" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "userId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "workflows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflows_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable: WorkflowExecution (工作流执行实例)
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "triggeredBy" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "logs" TEXT,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: Workflow
CREATE INDEX "workflows_userId_idx" ON "workflows"("userId");
CREATE INDEX "workflows_mailboxId_idx" ON "workflows"("mailboxId");
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex: WorkflowExecution
CREATE INDEX "workflow_executions_workflowId_idx" ON "workflow_executions"("workflowId");
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");
CREATE INDEX "workflow_executions_startedAt_idx" ON "workflow_executions"("startedAt");
