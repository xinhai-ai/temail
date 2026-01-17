import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExecutionSummary } from "@/services/workflow/logging";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; executionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, executionId } = await params;

    // Verify workflow ownership
    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Get the execution with logs
    const execution = await prisma.workflowExecution.findFirst({
      where: {
        id: executionId,
        workflowId: id,
      },
      include: {
        nodeLogs: {
          orderBy: {
            stepOrder: "asc",
          },
        },
        dispatchLog: true,
      },
    });

    if (!execution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 404 }
      );
    }

    // Get execution summary
    const summary = await getExecutionSummary(executionId);

    // Parse JSON fields for convenience
    const parsedLogs = execution.nodeLogs.map((log) => ({
      ...log,
      input: log.input ? JSON.parse(log.input) : null,
      output: log.output ? JSON.parse(log.output) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    return NextResponse.json({
      execution: {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        triggeredBy: execution.triggeredBy,
        input: execution.input ? JSON.parse(execution.input) : null,
        output: execution.output ? JSON.parse(execution.output) : null,
        error: execution.error,
        executionPath: execution.executionPath
          ? JSON.parse(execution.executionPath)
          : null,
        nodesExecuted: execution.nodesExecuted,
        startedAt: execution.startedAt,
        finishedAt: execution.finishedAt,
      },
      nodeLogs: parsedLogs,
      dispatchLog: execution.dispatchLog,
      summary,
    });
  } catch (error) {
    console.error("Error fetching execution logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch execution logs" },
      { status: 500 }
    );
  }
}
