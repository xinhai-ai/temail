import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: emailId } = await params;

    // Verify email ownership via mailbox
    const email = await prisma.email.findFirst({
      where: {
        id: emailId,
        mailbox: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
        subject: true,
        fromAddress: true,
        toAddress: true,
        receivedAt: true,
      },
    });

    if (!email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Get all dispatch logs for this email
    const dispatchLogs = await prisma.workflowDispatchLog.findMany({
      where: {
        emailId,
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        execution: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            nodesExecuted: true,
            error: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get executions triggered by this email (for backward compatibility)
    const executions = await prisma.workflowExecution.findMany({
      where: {
        triggeredBy: `email:${emailId}`,
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: {
        startedAt: "desc",
      },
    });

    // Summary stats
    const totalDispatched = dispatchLogs.filter((l) => l.dispatched).length;
    const totalSkipped = dispatchLogs.filter((l) => !l.dispatched).length;
    const successfulExecutions = executions.filter((e) => e.status === "SUCCESS").length;
    const failedExecutions = executions.filter((e) => e.status === "FAILED").length;

    return NextResponse.json({
      email,
      dispatchLogs,
      executions,
      stats: {
        totalWorkflows: dispatchLogs.length,
        dispatched: totalDispatched,
        skipped: totalSkipped,
        successfulExecutions,
        failedExecutions,
      },
    });
  } catch (error) {
    console.error("Error fetching email workflow logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow logs" },
      { status: 500 }
    );
  }
}
