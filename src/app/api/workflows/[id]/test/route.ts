import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkflowEngine } from "@/services/workflow/engine";
import { logWorkflowDispatch, updateDispatchLogExecution, getExecutionSummary } from "@/services/workflow/logging";
import type { WorkflowConfig, EmailContext } from "@/lib/workflow/types";
import { readJsonBody } from "@/lib/request";
import { validateWorkflowConfig } from "@/lib/workflow/schema";
import { validateWorkflow } from "@/lib/workflow/utils";

function getOptionalString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const bodyResult = await readJsonBody(request, { maxBytes: 400_000 });
    if (!bodyResult.ok) {
      return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
    }
    const rawBody = bodyResult.data;
    const body =
      rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>) : {};

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

    // Get test email context from request body or use default
    const now = Date.now();
    const emailContext: EmailContext = {
      id: getOptionalString(body, "emailId") ?? `test-email-${now}`,
      messageId: getOptionalString(body, "messageId") ?? `<test-${now}@test.local>`,
      fromAddress: getOptionalString(body, "fromAddress") ?? "test@example.com",
      fromName: getOptionalString(body, "fromName") ?? "Test Sender",
      toAddress: getOptionalString(body, "toAddress") ?? "recipient@example.com",
      subject: getOptionalString(body, "subject") ?? "Test Email Subject",
      textBody: getOptionalString(body, "textBody") ?? "This is a test email body for workflow testing.",
      htmlBody: getOptionalString(body, "htmlBody") ?? "<p>This is a test email body for workflow testing.</p>",
      receivedAt: new Date(),
    };

    // Use provided config or current workflow config
    const configValue = body["config"];
    const config =
      configValue && typeof configValue === "object"
        ? (configValue as unknown)
        : (() => {
            try {
              return JSON.parse(workflow.config) as unknown;
            } catch {
              return null;
            }
          })();

    const cfgParse = validateWorkflowConfig(config);
    if (!cfgParse.success) {
      return NextResponse.json({ error: "Invalid workflow config" }, { status: 400 });
    }

    const checks = validateWorkflow(cfgParse.data);
    const errors = checks.filter((e) => e.type === "error");
    if (errors.length > 0) {
      return NextResponse.json({ error: "Workflow config is not executable", details: errors }, { status: 400 });
    }

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: id,
        status: "RUNNING",
        triggeredBy: "test:manual",
        input: JSON.stringify(emailContext),
      },
    });

    // Log the test dispatch
    const dispatchLogId = await logWorkflowDispatch({
      workflowId: id,
      workflowName: workflow.name,
      triggerType: "manual",
      emailId: emailContext.id,
      emailFrom: emailContext.fromAddress,
      emailTo: emailContext.toAddress,
      emailSubject: emailContext.subject,
      dispatched: true,
    });

    await updateDispatchLogExecution(dispatchLogId, execution.id);

    // Execute workflow synchronously (wait for completion)
    const engine = new WorkflowEngine(id, execution.id, cfgParse.data as WorkflowConfig, true);

    try {
      await engine.execute(emailContext);
    } catch (error) {
      // Engine handles its own error logging, we just need to continue
      console.error("Workflow test execution error:", error);
    }

    // Get final execution state
    const finalExecution = await prisma.workflowExecution.findUnique({
      where: { id: execution.id },
      include: {
        nodeLogs: {
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    if (!finalExecution) {
      return NextResponse.json(
        { error: "Execution not found" },
        { status: 500 }
      );
    }

    // Get execution summary
    const summary = await getExecutionSummary(execution.id);

    // Parse node logs for response
    const nodeLogs = finalExecution.nodeLogs.map((log) => ({
      id: log.id,
      nodeId: log.nodeId,
      nodeType: log.nodeType,
      nodeLabel: log.nodeLabel,
      status: log.status,
      stepOrder: log.stepOrder,
      input: log.input ? JSON.parse(log.input) : null,
      output: log.output ? JSON.parse(log.output) : null,
      error: log.error,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
      startedAt: log.startedAt,
      finishedAt: log.finishedAt,
      duration: log.duration,
    }));

    return NextResponse.json({
      success: finalExecution.status === "SUCCESS",
      execution: {
        id: finalExecution.id,
        status: finalExecution.status,
        error: finalExecution.error,
        startedAt: finalExecution.startedAt,
        finishedAt: finalExecution.finishedAt,
        nodesExecuted: finalExecution.nodesExecuted,
        executionPath: finalExecution.executionPath
          ? JSON.parse(finalExecution.executionPath)
          : null,
      },
      nodeLogs,
      summary,
      testInput: emailContext,
    });
  } catch (error) {
    console.error("Error testing workflow:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to test workflow" },
      { status: 500 }
    );
  }
}
