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

    const { id } = await params;

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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const triggerType = searchParams.get("triggerType");
    const dispatched = searchParams.get("dispatched");
    const emailId = searchParams.get("emailId");

    // Build filter
    const where: {
      workflowId: string;
      triggerType?: string;
      dispatched?: boolean;
      emailId?: string;
    } = {
      workflowId: id,
    };

    if (triggerType) {
      where.triggerType = triggerType;
    }

    if (dispatched !== null && dispatched !== undefined) {
      where.dispatched = dispatched === "true";
    }

    if (emailId) {
      where.emailId = emailId;
    }

    const [dispatchLogs, total] = await Promise.all([
      prisma.workflowDispatchLog.findMany({
        where,
        include: {
          execution: {
            select: {
              id: true,
              status: true,
              startedAt: true,
              finishedAt: true,
              nodesExecuted: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.workflowDispatchLog.count({ where }),
    ]);

    // Calculate statistics
    const stats = await prisma.workflowDispatchLog.groupBy({
      by: ["dispatched"],
      where: { workflowId: id },
      _count: { id: true },
    });

    const dispatchedCount = stats.find((s) => s.dispatched)?._count?.id || 0;
    const skippedCount = stats.find((s) => !s.dispatched)?._count?.id || 0;

    return NextResponse.json({
      dispatchLogs,
      total,
      limit,
      offset,
      stats: {
        total,
        dispatched: dispatchedCount,
        skipped: skippedCount,
      },
    });
  } catch (error) {
    console.error("Error fetching dispatch logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch dispatch logs" },
      { status: 500 }
    );
  }
}
